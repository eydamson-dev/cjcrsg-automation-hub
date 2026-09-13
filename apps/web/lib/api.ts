import { api, uploadRequest, type QueryValue } from './api-client'
import type {
  Asset,
  CreatePostInput,
  ListResult,
  PostDetail,
  PostSummary,
  SocialAccountRecord,
  SocialPage,
  Template,
  UpdatePostInput,
  User,
} from './types'

export const authApi = {
  login: (email: string, password: string) => api.post<{ user: User }>('/auth/login', { email, password }),
  logout: () => api.del<void>('/auth/logout'),
  me: () => api.get<{ user: User }>('/auth/me'),
}

export const postsApi = {
  list: (params: { q?: string; status?: string; type?: string; limit?: number; offset?: number }) =>
    api.get<ListResult<PostSummary>>('/posts', params as Record<string, QueryValue>),
  get: (id: string) => api.get<PostDetail>(`/posts/${id}`),
  create: (input: CreatePostInput) => api.post<PostDetail>('/posts', input),
  update: (id: string, input: UpdatePostInput) => api.patch<PostDetail>(`/posts/${id}`, input),
  remove: (id: string) => api.del<void>(`/posts/${id}`),
  duplicate: (id: string) => api.post<PostDetail>(`/posts/${id}/duplicate`),
  design: (id: string, templateId: string) => api.post<PostDetail>(`/posts/${id}/design`, { templateId }),
  approve: (id: string) => api.post<PostDetail>(`/posts/${id}/approve`),
  schedule: (id: string, scheduledAt: string) => api.post<PostDetail>(`/posts/${id}/schedule`, { scheduledAt }),
  cancel: (id: string) => api.post<PostDetail>(`/posts/${id}/cancel`),
  publish: (id: string, socialPageId: string) => api.post<PostDetail>(`/posts/${id}/publish`, { socialPageId }),
  retry: (id: string) => api.post<PostDetail>(`/posts/${id}/retry`),
}

export const assetsApi = {
  list: (params: { limit?: number; offset?: number; mimeType?: string } = {}) =>
    api.get<ListResult<Asset>>('/assets', params as Record<string, QueryValue>),
  remove: (id: string) => api.del<void>(`/assets/${id}`),
  contentUrl: (id: string) => `/api/v1/assets/${id}/content`,
  upload: (file: File) => uploadRequest<Asset>('/assets', file),
}

export const templatesApi = {
  list: (params: { type?: string; active?: boolean } = {}) =>
    api.get<{ items: Template[] }>('/canva/templates', params as Record<string, QueryValue>),
  create: (input: Partial<Template>) => api.post<Template>('/canva/templates', input),
  update: (id: string, input: Partial<Template>) => api.patch<Template>(`/canva/templates/${id}`, input),
  remove: (id: string) => api.del<void>(`/canva/templates/${id}`),
}

export const socialApi = {
  accounts: () => api.get<{ items: SocialAccountRecord[] }>('/social/accounts'),
  pages: (accountId?: string) =>
    api.get<{ items: SocialPage[] }>('/social/pages', { accountId } as Record<string, QueryValue>),
  connect: (input: {
    accountName: string
    accessToken: string
    refreshToken?: string
    tokenExpiresAt?: string
    pages?: Array<{ externalPageId: string; name?: string }>
  }) => api.post<SocialAccountRecord>('/social/facebook/connect', input),
}