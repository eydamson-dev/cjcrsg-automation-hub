import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import { prisma } from '#db/prisma'
import { writeAuditLog, AuditAction } from '#services/audit_service'
import { sessionService } from '#services/session_service'
import type { AuthenticatedUser } from '#types/auth'
import { verifyPassword } from '#utils/password'
import { loginValidator } from '#validators/auth'

function toAuthed(user: {
  id: string
  name: string
  email: string
  role: AuthenticatedUser['role']
}) {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

export default class AuthController {
  async login(ctx: HttpContext) {
    const payload = await loginValidator.validate(ctx.request.all())

    const user = await prisma.user.findUnique({ where: { email: payload.email.toLowerCase() } })

    if (!user || !user.isActive) {
      await writeAuditLog({
        userId: user?.id ?? null,
        action: AuditAction.USER_LOGIN_FAILED,
        ipAddress: ctx.request.ip(),
      })
      throw new Exception('Invalid credentials', { status: 401, code: 'E_INVALID_CREDENTIALS' })
    }

    const passwordMatches = await verifyPassword(user.passwordHash, payload.password)
    if (!passwordMatches) {
      await writeAuditLog({
        userId: user.id,
        action: AuditAction.USER_LOGIN_FAILED,
        ipAddress: ctx.request.ip(),
      })
      throw new Exception('Invalid credentials', { status: 401, code: 'E_INVALID_CREDENTIALS' })
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    await sessionService.login(toAuthed(user), ctx)
    await writeAuditLog({
      userId: user.id,
      action: AuditAction.USER_LOGIN,
      ipAddress: ctx.request.ip(),
    })

    return { user: toAuthed(user) }
  }

  async logout(ctx: HttpContext) {
    const user = ctx.auth?.user
    await sessionService.logout(ctx)

    if (user) {
      await writeAuditLog({
        userId: user.id,
        action: AuditAction.USER_LOGOUT,
        ipAddress: ctx.request.ip(),
      })
    }

    return ctx.response.noContent()
  }

  async me(ctx: HttpContext) {
    const user = ctx.auth!.user
    return { user }
  }

  async refresh(ctx: HttpContext) {
    const user = await sessionService.rotate(ctx)

    if (!user) {
      throw new Exception('You are not signed in', { status: 401, code: 'E_UNAUTHENTICATED' })
    }

    ctx.auth = { user }
    return { user }
  }
}
