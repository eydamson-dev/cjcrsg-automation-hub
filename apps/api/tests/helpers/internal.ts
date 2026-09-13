import { randomUUID } from 'node:crypto'
import type { ApiClient, ApiRequest } from '@japa/api-client'
import env from '#start/env'
import { signInternal, type HmacBody } from '#services/hmac'

export function internalSecret(): string {
  return env.get('INTERNAL_API_SECRET')
}

interface SignInput {
  method: string
  pathname: string
  body?: HmacBody
  timestamp?: string
  requestId?: string
  secret?: string
}

export function signInternalRequest(input: SignInput): string {
  return signInternal({
    secret: input.secret ?? internalSecret(),
    method: input.method,
    pathname: input.pathname,
    timestamp: input.timestamp ?? String(Math.floor(Date.now() / 1000)),
    requestId: input.requestId ?? randomUUID(),
    body: input.body ?? {},
  })
}

interface HeaderOverrides {
  timestamp?: string
  requestId?: string
  signature?: string
}

function attachHeaders(
  request: ApiRequest<any, any, any>,
  input: SignInput & HeaderOverrides
): void {
  const timestamp = input.timestamp ?? String(Math.floor(Date.now() / 1000))
  const requestId = input.requestId ?? randomUUID()
  const signature = input.signature ?? signInternalRequest({ ...input, timestamp, requestId })
  request.header('x-signature', signature)
  request.header('x-timestamp', timestamp)
  request.header('x-request-id', requestId)
}

export function signedGet(
  client: ApiClient,
  pathname: string,
  overrides: HeaderOverrides = {}
): ApiRequest<any, any, any> {
  const input: SignInput = { method: 'GET', pathname, ...overrides }
  const request = client.get(pathname)
  attachHeaders(request, input)
  return request
}

export function signedPost(
  client: ApiClient,
  pathname: string,
  body: HmacBody = {},
  overrides: HeaderOverrides = {}
): ApiRequest<any, any, any> {
  const input: SignInput = { method: 'POST', pathname, body, ...overrides }
  const request = client.post(pathname)
  attachHeaders(request, input)
  return request.json(body)
}
