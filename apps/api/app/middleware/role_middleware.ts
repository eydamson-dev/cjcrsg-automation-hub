import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Role } from '../../generated/prisma/client.js'

export function createRoleMiddleware(allowedRoles: Role[]) {
  return class RoleController {
    async handle(ctx: HttpContext, next: NextFn) {
      const user = ctx.auth?.user

      if (!user) {
        throw new Exception('You are not signed in', { status: 401, code: 'E_UNAUTHENTICATED' })
      }

      if (!allowedRoles.includes(user.role)) {
        throw new Exception('You do not have permission to perform this action', {
          status: 403,
          code: 'E_FORBIDDEN',
        })
      }

      return next()
    }
  }
}

export const AdminRoleMiddleware = createRoleMiddleware(['ADMIN'])
export const EditorRoleMiddleware = createRoleMiddleware(['ADMIN', 'EDITOR'])
