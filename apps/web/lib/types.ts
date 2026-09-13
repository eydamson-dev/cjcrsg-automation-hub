export type PostType = 'BIBLE_VERSE' | 'IMAGE'
export type Role = 'ADMIN' | 'EDITOR'

export type PostStatus =
  | 'DRAFT'
  | 'READY'
  | 'PROCESSING'
  | 'DESIGN_READY'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'CANCELLED'
  | 'ARCHIVED'

export interface User {
  id: string
  name: string
  email: string
  role: Role
}

export interface ListResult<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface PostSummary {
  id: string
  type: PostType
  status: PostStatus
  title: string | null
  caption: string | null
  scheduledAt: string | null
  templateId: string | null
  createdAt: string
  updatedAt: string
}

export interface PostBibleVerse {
  translation: string
  book: string
  chapter: number
  verseStart: number
  verseEnd: number
  verseText: string
}

export interface PostAsset {
  role: 'SOURCE_IMAGE' | 'GENERATED_IMAGE' | 'PREVIEW' | 'ATTACHMENT'
  sortOrder: number
  asset: AssetRecord
}

export interface AssetRecord {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
}

export interface PublicationRecord {
  id: string
  socialPageId: string
  status: 'PENDING' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED' | 'CANCELLED'
  externalPostId: string | null
  externalUrl: string | null
  publishedAt: string | null
}

export interface JobRecord {
  id: string
  jobType: 'GENERATE_DESIGN' | 'EXPORT_DESIGN' | 'PUBLISH_FACEBOOK'
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
  attempts: number
  maxAttempts: number
  lastError: string | null
}

export interface PostDetail extends PostSummary {
  bibleVerse: PostBibleVerse | null
  template: { id: string; name: string; type: PostType } | null
  assets: PostAsset[]
  publications: PublicationRecord[]
  jobs: JobRecord[]
  createdBy: { id: string; name: string; email: string } | null
}

export interface Asset {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  sha256: string | null
  createdAt: string
}

export interface Template {
  id: string
  name: string
  type: PostType
  canvaTemplateId: string | null
  canvaDesignId: string | null
  thumbnailAssetId: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface SocialAccountRecord {
  id: string
  provider: 'FACEBOOK'
  accountName: string | null
  tokenExpiresAt: string | null
  hasAccessToken: boolean
  pageCount: number
  pages?: Array<{ id: string; externalPageId: string; name: string | null; isActive: boolean }>
  createdAt: string
  updatedAt: string
}

export interface SocialPage {
  id: string
  socialAccountId: string
  provider: 'FACEBOOK'
  externalPageId: string
  name: string | null
  isActive: boolean
}

export interface CreatePostInput {
  type: PostType
  title?: string
  caption?: string
  scheduledAt?: string
  templateId?: string
  assetId?: string
  translation?: string
  book?: string
  chapter?: number
  verseStart?: number
  verseEnd?: number
  verseText?: string
}

export interface UpdatePostInput {
  title?: string
  caption?: string
  scheduledAt?: string
  templateId?: string
  assetId?: string
  translation?: string
  book?: string
  chapter?: number
  verseStart?: number
  verseEnd?: number
  verseText?: string
}