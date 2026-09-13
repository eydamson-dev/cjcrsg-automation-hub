import type { Role } from '../../generated/prisma/client.js'

export interface AuthenticatedUser {
  id: string
  name: string
  email: string
  role: Role
}

export interface SessionUser {
  token: string
  tokenHash: string
}

declare module '@adonisjs/core/http' {
  interface HttpContext {
    auth?: {
      user: AuthenticatedUser
    }
  }
}

export function authUserRequired(
  ctx: import('@adonisjs/core/http').HttpContext
): AuthenticatedUser {
  if (!ctx.auth) {
    throw new Error('AuthMiddleware did not run before this route')
  }
  return ctx.auth.user
}
