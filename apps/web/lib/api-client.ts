export class ApiError extends Error {
  status: number
  code: string | undefined

  constructor(status: number, code: string | undefined, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const BASE_URL = '/api/v1'

export interface ApiErrorBody {
  message?: string
  code?: string
  errors?: Array<{ message: string; field?: string }>
}

export type QueryValue = string | number | boolean | undefined | null

function withQuery(path: string, params?: Record<string, QueryValue>) {
  if (!params) return path
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  return qs ? `${path}?${qs}` : path
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = init.body
    ? { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) }
    : { ...(init.headers as Record<string, string>) }

  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'same-origin',
    ...init,
    headers,
  })

  if (res.status === 204) {
    return undefined as T
  }

  const contentType = res.headers.get('content-type') ?? ''
  const body: ApiErrorBody | T = contentType.includes('application/json') ? await res.json() : null

  if (!res.ok) {
    const err = body as ApiErrorBody
    const message = err.message ?? err.errors?.[0]?.message ?? `Request failed (${res.status})`
    throw new ApiError(res.status, err.code, message)
  }

  return body as T
}

export const api = {
  get: <T>(path: string, params?: Record<string, QueryValue>) => apiRequest<T>(withQuery(path, params), { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
}

export async function uploadRequest<T>(path: string, file: File): Promise<T> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const err = (body ?? {}) as ApiErrorBody
    const message = err.message ?? err.errors?.[0]?.message ?? `Request failed (${res.status})`
    throw new ApiError(res.status, err.code, message)
  }
  return body as T
}