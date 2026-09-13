import type { Post, Prisma } from '../../generated/prisma/client.js'
import type { PostDetail, PostSummary } from '../types/post.js'

type PostWithRelations = Prisma.PostGetPayload<{
  include: {
    bibleVerse: true
    template: { select: { id: true; name: true; type: true } }
    postAssets: { include: { asset: true }; orderBy: { sortOrder: 'asc' } }
    publications: true
    jobs: true
    creator: { select: { id: true; name: true; email: true } }
  }
}>

function toSummary(post: Post): PostSummary {
  return {
    id: post.id,
    type: post.type,
    status: post.status,
    title: post.title,
    caption: post.caption,
    scheduledAt: post.scheduledAt,
    publishedAt: post.publishedAt,
    templateId: post.templateId,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  }
}

export function serializePostSummary(post: Post): PostSummary {
  return toSummary(post)
}

export function serializePostDetail(post: PostWithRelations): PostDetail {
  return {
    ...toSummary(post),
    bibleVerse: post.bibleVerse
      ? {
          translation: post.bibleVerse.translation,
          book: post.bibleVerse.book,
          chapter: post.bibleVerse.chapter,
          verseStart: post.bibleVerse.verseStart,
          verseEnd: post.bibleVerse.verseEnd,
          verseText: post.bibleVerse.verseText,
        }
      : null,
    template: post.template,
    assets: post.postAssets.map(({ role, sortOrder, asset }) => ({
      role,
      sortOrder,
      asset: {
        id: asset.id,
        filename: asset.filename,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        width: asset.width,
        height: asset.height,
      },
    })),
    publications: post.publications.map((publication) => ({
      id: publication.id,
      socialPageId: publication.socialPageId,
      status: publication.status,
      externalPostId: publication.externalPostId,
      externalUrl: publication.externalUrl,
      publishedAt: publication.publishedAt,
    })),
    jobs: post.jobs.map((job) => ({
      id: job.id,
      jobType: job.jobType,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      lastError: job.lastError,
    })),
    createdBy: post.creator,
  }
}

export const postDetailInclude = {
  bibleVerse: true,
  template: { select: { id: true, name: true, type: true } },
  postAssets: {
    include: { asset: true },
    orderBy: { sortOrder: 'asc' as const },
  },
  publications: {
    orderBy: { createdAt: 'desc' as const },
  },
  jobs: {
    orderBy: { createdAt: 'desc' as const },
  },
  creator: { select: { id: true, name: true, email: true } },
} satisfies Prisma.PostInclude
