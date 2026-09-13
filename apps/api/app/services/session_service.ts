import { createHash, randomBytes } from 'node:crypto'
import sessionConfig from '#config/session'
import { prisma } from '#db/prisma'
import type { HttpContext } from '@adonisjs/core/http'
import type { AuthenticatedUser, SessionUser } from '../types/auth.js'

const lifetimeMs = () => sessionConfig.lifetimeDays * 24 * 60 * 60 * 1000

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export class SessionService {
  async login(user: AuthenticatedUser, ctx: HttpContext): Promise<void> {
    await this.createSession(user, ctx)
  }

  async createSession(user: AuthenticatedUser, ctx: HttpContext): Promise<string> {
    const token = randomBytes(32).toString('base64url')
    const tokenHash = sha256(token)

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + lifetimeMs()),
        ipAddress: ctx.request.ip(),
        userAgent: ctx.request.header('user-agent'),
      },
    })

    this.setCookie(ctx, token)
    return token
  }

  getSessionUser(ctx: HttpContext): SessionUser | null {
    const raw = ctx.request.plainCookie(sessionConfig.name)
    if (typeof raw !== 'string' || raw.length === 0) {
      return null
    }
    return { token: raw, tokenHash: sha256(raw) }
  }

  async verify(ctx: HttpContext): Promise<AuthenticatedUser | null> {
    const session = this.getSessionUser(ctx)
    if (!session) return null

    const row = await prisma.session.findUnique({
      where: { tokenHash: session.tokenHash },
      include: { user: true },
    })

    if (!row || row.expiresAt.getTime() <= Date.now()) {
      if (row) {
        await prisma.session.delete({ where: { id: row.id } })
      }
      ctx.response.clearCookie(sessionConfig.name, { path: '/' })
      return null
    }

    if (!row.user.isActive) {
      await prisma.session.delete({ where: { id: row.id } })
      ctx.response.clearCookie(sessionConfig.name, { path: '/' })
      return null
    }

    row.expiresAt = new Date(Date.now() + lifetimeMs())
    await prisma.session.update({ where: { id: row.id }, data: { expiresAt: row.expiresAt } })
    this.setCookie(ctx, session.token)

    return {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      role: row.user.role,
    }
  }

  async logout(ctx: HttpContext): Promise<void> {
    const session = this.getSessionUser(ctx)
    if (session) {
      await prisma.session.deleteMany({ where: { tokenHash: session.tokenHash } })
    }
    ctx.response.clearCookie(sessionConfig.name, { path: '/' })
  }

  async rotate(ctx: HttpContext): Promise<AuthenticatedUser | null> {
    const current = this.getSessionUser(ctx)
    if (!current) return null

    const row = await prisma.session.findUnique({
      where: { tokenHash: current.tokenHash },
      include: { user: true },
    })

    if (!row || row.expiresAt.getTime() <= Date.now() || !row.user.isActive) {
      if (row) {
        await prisma.session.delete({ where: { id: row.id } })
      }
      ctx.response.clearCookie(sessionConfig.name, { path: '/' })
      return null
    }

    await prisma.session.delete({ where: { id: row.id } })
    await this.createSession(
      { id: row.user.id, name: row.user.name, email: row.user.email, role: row.user.role },
      ctx
    )

    return {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      role: row.user.role,
    }
  }

  private setCookie(ctx: HttpContext, token: string): void {
    ctx.response.plainCookie(sessionConfig.name, token, {
      ...sessionConfig.cookie,
      maxAge: sessionConfig.lifetimeDays * 24 * 60 * 60,
    })
  }
}

export const sessionService = new SessionService()
