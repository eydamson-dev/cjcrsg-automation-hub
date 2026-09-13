import type { PostStatus, PostType } from '../../generated/prisma/client.js'

export interface PostSummary {
  id: string
  type: PostType
  status: PostStatus
  title: string | null
  caption: string | null
  scheduledAt: Date | null
  templateId: string | null
  createdAt: Date
  updatedAt: Date
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
  asset: {
    id: string
    filename: string
    mimeType: string
    sizeBytes: number
    width: number | null
    height: number | null
  }
}

export interface PublicationSummary {
  id: string
  socialPageId: string
  status: 'PENDING' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED' | 'CANCELLED'
  externalPostId: string | null
  externalUrl: string | null
  publishedAt: Date | null
}

export interface JobSummary {
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
  publications: PublicationSummary[]
  jobs: JobSummary[]
  createdBy: { id: string; name: string; email: string } | null
}
