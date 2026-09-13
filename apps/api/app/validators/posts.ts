import vine from '@vinejs/vine'
import type { PostStatus, PostType } from '../../generated/prisma/client.js'

const verseFields = {
  translation: vine.string().trim().minLength(1).maxLength(50).optional(),
  book: vine.string().trim().minLength(1).maxLength(100).optional(),
  chapter: vine.number().positive().optional(),
  verseStart: vine.number().positive().optional(),
  verseEnd: vine.number().positive().optional(),
  verseText: vine.string().trim().minLength(1).maxLength(2000).optional(),
}

const sharedFields = {
  type: vine.enum(['BIBLE_VERSE', 'IMAGE'] as const),
  title: vine.string().trim().maxLength(200).optional(),
  caption: vine.string().trim().maxLength(5000).optional(),
  scheduledAt: vine.string().optional(),
  templateId: vine.string().uuid().optional(),
}

export const createPostValidator = vine.compile(
  vine.object({
    ...sharedFields,
    ...verseFields,
    assetId: vine.string().uuid().optional(),
  })
)

export const updatePostValidator = vine.compile(
  vine.object({
    ...verseFields,
    title: vine.string().trim().maxLength(200).optional(),
    caption: vine.string().trim().maxLength(5000).optional(),
    scheduledAt: vine.string().optional(),
    templateId: vine.string().uuid().optional(),
    assetId: vine.string().uuid().optional(),
  })
)

export const listPostsValidator = vine.compile(
  vine.object({
    limit: vine.number().optional(),
    offset: vine.number().optional(),
    type: vine.enum(['BIBLE_VERSE', 'IMAGE'] as const).optional(),
    status: vine
      .enum([
        'DRAFT',
        'READY',
        'PROCESSING',
        'DESIGN_READY',
        'APPROVED',
        'SCHEDULED',
        'PUBLISHING',
        'PUBLISHED',
        'FAILED',
        'CANCELLED',
        'ARCHIVED',
      ] as const)
      .optional(),
    q: vine.string().trim().maxLength(200).optional(),
  })
)

export const schedulePostValidator = vine.compile(
  vine.object({
    scheduledAt: vine.string(),
  })
)

export const publishPostValidator = vine.compile(
  vine.object({
    socialPageId: vine.string().uuid(),
  })
)

export const designPostValidator = vine.compile(
  vine.object({
    templateId: vine.string().uuid(),
  })
)

export type CreatePostOutput = {
  type: PostType
  title?: string
  caption?: string
  scheduledAt?: Date
  templateId?: string
  assetId?: string
} & {
  translation?: string
  book?: string
  chapter?: number
  verseStart?: number
  verseEnd?: number
  verseText?: string
}

export type ListPostsFilters = {
  limit: number
  offset: number
  type?: PostType
  status?: PostStatus
  q?: string
}

export type UpdatePostFields = {
  title?: string
  caption?: string
  scheduledAt?: Date
  templateId?: string
  assetId?: string
  translation?: string
  book?: string
  chapter?: number
  verseStart?: number
  verseEnd?: number
  verseText?: string
}
