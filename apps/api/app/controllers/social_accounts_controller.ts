import type { HttpContext } from '@adonisjs/core/http'
import { prisma } from '#db/prisma'
import { authUserRequired } from '#types/auth'
import { writeAuditLog, AuditAction } from '#services/audit_service'
import { connectFacebookValidator, listPagesValidator } from '#validators/social'
import { optionalDate } from '#utils/date'
import { encryptToken } from '#services/token_crypto'

function serializeAccount(account: {
  id: string
  provider: 'FACEBOOK'
  accountName: string | null
  tokenExpiresAt: Date | null
  createdAt: Date
  updatedAt: Date
  _count?: { pages: number }
  pages?: Array<{ id: string; externalPageId: string; name: string | null; isActive: boolean }>
}) {
  return {
    id: account.id,
    provider: account.provider,
    accountName: account.accountName,
    tokenExpiresAt: account.tokenExpiresAt,
    hasAccessToken: true,
    pageCount: account._count?.pages ?? account.pages?.length ?? 0,
    pages: account.pages?.map((page) => ({
      id: page.id,
      externalPageId: page.externalPageId,
      name: page.name,
      isActive: page.isActive,
    })),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }
}

export default class SocialAccountsController {
  async accounts() {
    const accounts = await prisma.socialAccount.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        pages: { select: { id: true, externalPageId: true, name: true, isActive: true } },
        _count: { select: { pages: true } },
      },
    })

    return { items: accounts.map(serializeAccount) }
  }

  async connectFacebook(ctx: HttpContext) {
    const payload = await connectFacebookValidator.validate(ctx.request.all())

    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }

    const account = await prisma.socialAccount.create({
      data: {
        provider: 'FACEBOOK',
        accountName: payload.accountName,
        accessTokenEncrypted: encryptToken(payload.accessToken),
        ...(payload.refreshToken
          ? { refreshTokenEncrypted: encryptToken(payload.refreshToken) }
          : {}),
        ...(payload.tokenExpiresAt ? { tokenExpiresAt: optionalDate(payload.tokenExpiresAt) } : {}),
        pages: {
          create:
            payload.pages?.map((page: { externalPageId: string; name?: string }) => ({
              provider: 'FACEBOOK',
              externalPageId: page.externalPageId,
              name: page.name,
            })) ?? [],
        },
      },
      include: {
        pages: { select: { id: true, externalPageId: true, name: true, isActive: true } },
        _count: { select: { pages: true } },
      },
    })

    await writeAuditLog({
      userId: actor.user.id,
      action: AuditAction.SOCIAL_FACEBOOK_CONNECTED,
      entityType: 'social_account',
      entityId: account.id,
      ipAddress: actor.ip,
    })

    return ctx.response.created(serializeAccount(account))
  }

  async pages(ctx: HttpContext) {
    const payload = await listPagesValidator.validate(ctx.request.qs())

    const pages = await prisma.socialPage.findMany({
      where: payload.accountId ? { socialAccountId: payload.accountId } : undefined,
      orderBy: { name: 'asc' },
    })

    return {
      items: pages.map((page) => ({
        id: page.id,
        socialAccountId: page.socialAccountId,
        provider: page.provider,
        externalPageId: page.externalPageId,
        name: page.name,
        isActive: page.isActive,
      })),
    }
  }
}
