import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import env from '#start/env'
import {
  HMAC_HEADER_REQUEST_ID,
  HMAC_HEADER_SIGNATURE,
  HMAC_HEADER_TIMESTAMP,
  verifyInternalSignature,
  type HmacBody,
} from '../services/hmac.js'

const InternalUnauthorized = new Exception('Unauthorized internal request', {
  status: 401,
  code: 'E_UNAUTHORIZED',
})

export default class InternalAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const secret = env.get('INTERNAL_API_SECRET')

    const signature = ctx.request.header(HMAC_HEADER_SIGNATURE)
    const rawTimestamp = ctx.request.header(HMAC_HEADER_TIMESTAMP)
    const requestId = ctx.request.header(HMAC_HEADER_REQUEST_ID)

    if (!signature || !rawTimestamp || !requestId) {
      throw InternalUnauthorized
    }

    const timestamp = Number(rawTimestamp)
    if (!Number.isFinite(timestamp)) {
      throw InternalUnauthorized
    }

    const windowSeconds = env.get('INTERNAL_API_TIMESTAMP_WINDOW', 300)
    if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > windowSeconds) {
      throw InternalUnauthorized
    }

    const method = ctx.request.method().toUpperCase()
    const pathname = ctx.request.parsedUrl.pathname

    const valid = verifyInternalSignature({
      secret,
      signature,
      method,
      pathname,
      timestamp: rawTimestamp,
      requestId,
      body: (ctx.request.body() ?? {}) as HmacBody,
    })

    if (!valid) {
      throw InternalUnauthorized
    }

    return next()
  }
}
