import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { sessionService } from '#services/session_service'

export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = await sessionService.verify(ctx)

    if (!user) {
      throw new Exception('You are not signed in', { status: 401, code: 'E_UNAUTHENTICATED' })
    }

    ctx.auth = { user }
    return next()
  }
}
