import { createHmac, timingSafeEqual } from 'node:crypto'

export const HMAC_HEADER_SIGNATURE = 'x-signature'
export const HMAC_HEADER_TIMESTAMP = 'x-timestamp'
export const HMAC_HEADER_REQUEST_ID = 'x-request-id'

export type HmacBody = Record<string, unknown>

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Recursively sorts object keys so both the signer and the verifier compute
 * the same canonical body regardless of insertion order.
 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  if (isObject(value)) {
    const keys = Object.keys(value).sort()
    const parts = keys.map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    return `{${parts.join(',')}}`
  }
  return JSON.stringify(value)
}

export function canonicalBody(body: HmacBody): string {
  if (!body || Object.keys(body).length === 0) return ''
  return stableStringify(body)
}

/**
 * Builds the canonical string the signature covers.
 *
 * `<METHOD>\n<pathname>\n<X-Timestamp>\n<X-Request-Id>\n<canonicalBody>`
 */
export function canonicalString(input: {
  method: string
  pathname: string
  timestamp: string
  requestId: string
  body: string
}): string {
  return [input.method, input.pathname, input.timestamp, input.requestId, input.body].join('\n')
}

export function signInternal(input: {
  secret: string
  method: string
  pathname: string
  timestamp: string
  requestId: string
  body: HmacBody
}): string {
  const canonical = canonicalString({
    method: input.method,
    pathname: input.pathname,
    timestamp: input.timestamp,
    requestId: input.requestId,
    body: canonicalBody(input.body),
  })
  return createHmac('sha256', input.secret).update(canonical).digest('hex')
}

export function verifyInternalSignature(input: {
  secret: string
  signature: string
  method: string
  pathname: string
  timestamp: string
  requestId: string
  body: HmacBody
}): boolean {
  const expected = signInternal(input)
  const provided = Buffer.from(input.signature)
  const expectedBuffer = Buffer.from(expected)
  if (provided.length !== expectedBuffer.length) return false
  return timingSafeEqual(provided, expectedBuffer)
}
