import { randomUUID } from 'node:crypto'
import { Exception } from '@adonisjs/core/exceptions'
import { prisma } from '#db/prisma'
import { assertTransition } from '../domain/post_state_machine.js'
import { writeAuditLog, AuditAction } from './audit_service.js'
import { postDetailInclude, serializePostDetail } from '../serializers/post.js'
import type { AuthenticatedUser } from '../types/auth.js'
import type { PostDetail } from '../types/post.js'
import type { CreatePostOutput, UpdatePostFields } from '../validators/posts.js'

export const ResourceNotFoundException = new Exception('Resource not found', {
  status: 404,
  code: 'E_RESOURCE_NOT_FOUND',
})

const EDITABLE_STATUSES = ['DRAFT', 'READY']

function notFound(): never {
  throw ResourceNotFoundException
}

async function loadDetail(id: string): Promise<PostDetail> {
  const post = await prisma.post.findUnique({ where: { id }, include: postDetailInclude })
  if (!post) notFound()
  return serializePostDetail(post)
}

export class PostService {
  async create(payload: CreatePostOutput, actor: { user: AuthenticatedUser; ip: string }) {
    const { type, title, caption, scheduledAt, templateId, assetId } = payload

    if (type === 'IMAGE' && !assetId) {
      throw new Exception('assetId is required for IMAGE posts', {
        status: 422,
        code: 'E_VALIDATION_ERROR',
      })
    }

    if (type === 'BIBLE_VERSE') {
      const hasVerse = !!(
        payload.translation &&
        payload.book &&
        payload.chapter &&
        payload.verseStart &&
        payload.verseEnd &&
        payload.verseText
      )
      if (!hasVerse) {
        throw new Exception(
          'BIBLE_VERSE posts require translation, book, chapter, verseStart, verseEnd, verseText',
          {
            status: 422,
            code: 'E_VALIDATION_ERROR',
          }
        )
      }
      if ((payload.verseEnd ?? 0) < (payload.verseStart ?? 0)) {
        throw new Exception('verseEnd must be >= verseStart', {
          status: 422,
          code: 'E_VALIDATION_ERROR',
        })
      }
    }

    if (templateId && !(await prisma.canvaTemplate.findUnique({ where: { id: templateId } }))) {
      throw new Exception('templateId does not exist', { status: 422, code: 'E_VALIDATION_ERROR' })
    }

    const post = await prisma.post.create({
      data: {
        type,
        title,
        caption,
        scheduledAt,
        templateId,
        status: 'DRAFT',
        createdBy: actor.user.id,
        updatedBy: actor.user.id,
        bibleVerse: type === 'BIBLE_VERSE' ? { create: this.verseData(payload) } : undefined,
        postAssets:
          type === 'IMAGE' && assetId
            ? { create: { assetId, role: 'SOURCE_IMAGE', sortOrder: 0 } }
            : undefined,
      },
      include: postDetailInclude,
    })

    await writeAuditLog({
      userId: actor.user.id,
      action: AuditAction.POST_CREATED,
      entityType: 'post',
      entityId: post.id,
      metadata: { type },
      ipAddress: actor.ip,
    })

    return serializePostDetail(post)
  }

  async detail(id: string): Promise<PostDetail> {
    return loadDetail(id)
  }

  async update(
    id: string,
    payload: UpdatePostFields,
    actor: { user: AuthenticatedUser; ip: string }
  ) {
    const existing = await prisma.post.findUnique({ where: { id }, include: { bibleVerse: true } })
    if (!existing) notFound()

    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw new Exception(`Cannot edit a post in status ${existing.status}`, {
        status: 409,
        code: 'E_NOT_EDITABLE',
      })
    }

    const verseRelation = this.verseRelation(payload, existing.bibleVerse !== null)
    const hasEditableVerseChanges = this.anyVerseChange(payload)

    const post = await prisma.$transaction(async (tx) => {
      const updated = await tx.post.update({
        where: { id },
        data: {
          title: payload.title !== undefined ? payload.title : existing.title,
          caption: payload.caption !== undefined ? payload.caption : existing.caption,
          scheduledAt:
            payload.scheduledAt !== undefined ? payload.scheduledAt : existing.scheduledAt,
          templateId: payload.templateId !== undefined ? payload.templateId : existing.templateId,
          updatedBy: actor.user.id,
          ...(hasEditableVerseChanges && existing.type === 'BIBLE_VERSE' && verseRelation
            ? { bibleVerse: verseRelation }
            : {}),
        },
        include: postDetailInclude,
      })

      if (payload.assetId && existing.type === 'IMAGE') {
        await tx.postAsset.deleteMany({ where: { postId: id, role: 'SOURCE_IMAGE' } })
        await tx.postAsset.create({
          data: { postId: id, assetId: payload.assetId, role: 'SOURCE_IMAGE', sortOrder: 0 },
        })
      }

      return updated
    })

    await writeAuditLog({
      userId: actor.user.id,
      action: AuditAction.POST_UPDATED,
      entityType: 'post',
      entityId: id,
      ipAddress: actor.ip,
    })

    return serializePostDetail(post)
  }

  async delete(id: string, actor: { user: AuthenticatedUser; ip: string }): Promise<void> {
    const existing = await prisma.post.findUnique({ where: { id } })
    if (!existing) notFound()

    if (![...EDITABLE_STATUSES, 'CANCELLED'].includes(existing.status)) {
      throw new Exception(`Cannot delete a post in status ${existing.status}`, {
        status: 409,
        code: 'E_NOT_DELETABLE',
      })
    }

    await prisma.$transaction(async (tx) => {
      await tx.bibleVersePost.deleteMany({ where: { postId: id } })
      await tx.postAsset.deleteMany({ where: { postId: id } })
      await tx.post.delete({ where: { id } })
      await tx.auditLog.deleteMany({ where: { entityType: 'post', entityId: id } })
    })
    await writeAuditLog({
      userId: actor.user.id,
      action: AuditAction.POST_UPDATED,
      entityType: 'post',
      entityId: id,
      metadata: { action: 'delete' },
      ipAddress: actor.ip,
    })
  }

  async duplicate(id: string, actor: { user: AuthenticatedUser; ip: string }) {
    const existing = await prisma.post.findUnique({
      where: { id },
      include: { bibleVerse: true, postAssets: true },
    })
    if (!existing) notFound()

    const post = await prisma.post.create({
      data: {
        type: existing.type,
        title: `${existing.title ?? ''} (copy)`,
        caption: existing.caption,
        templateId: existing.templateId,
        status: 'DRAFT',
        createdBy: actor.user.id,
        updatedBy: actor.user.id,
        bibleVerse:
          existing.type === 'BIBLE_VERSE' && existing.bibleVerse
            ? {
                create: {
                  translation: existing.bibleVerse.translation,
                  book: existing.bibleVerse.book,
                  chapter: existing.bibleVerse.chapter,
                  verseStart: existing.bibleVerse.verseStart,
                  verseEnd: existing.bibleVerse.verseEnd,
                  verseText: existing.bibleVerse.verseText,
                },
              }
            : undefined,
        postAssets:
          existing.postAssets.length > 0
            ? {
                create: existing.postAssets.map((link) => ({
                  assetId: link.assetId,
                  role: link.role,
                  sortOrder: link.sortOrder,
                })),
              }
            : undefined,
      },
      include: postDetailInclude,
    })

    await writeAuditLog({
      userId: actor.user.id,
      action: AuditAction.POST_DUPLICATED,
      entityType: 'post',
      entityId: post.id,
      metadata: { sourcePostId: id },
      ipAddress: actor.ip,
    })

    return serializePostDetail(post)
  }

  async design(id: string, templateId: string, actor: { user: AuthenticatedUser; ip: string }) {
    const existing = await prisma.post.findUnique({ where: { id } })
    if (!existing) notFound()

    const template = await prisma.canvaTemplate.findUnique({ where: { id: templateId } })
    if (!template || !template.active) {
      throw new Exception('templateId does not exist or is not active', {
        status: 422,
        code: 'E_VALIDATION_ERROR',
      })
    }
    if (template.type !== existing.type) {
      throw new Exception('Template type does not match the post type', {
        status: 422,
        code: 'E_VALIDATION_ERROR',
      })
    }

    if (existing.status === 'DRAFT') {
      assertTransition(existing.status, 'READY')
      await prisma.post.update({
        where: { id },
        data: { status: 'READY', updatedBy: actor.user.id },
      })
    }

    const ready = await prisma.post.findUniqueOrThrow({ where: { id } })
    assertTransition(ready.status, 'PROCESSING')
    const processing = await prisma.post.update({
      where: { id },
      data: { status: 'PROCESSING', templateId, updatedBy: actor.user.id },
    })
    assertTransition(processing.status, 'DESIGN_READY')

    const post = await prisma.post.update({
      where: { id },
      data: { status: 'DESIGN_READY', updatedBy: actor.user.id },
      include: postDetailInclude,
    })

    await writeAuditLog({
      userId: actor.user.id,
      action: AuditAction.POST_UPDATED,
      entityType: 'post',
      entityId: id,
      metadata: { action: 'design', templateId },
      ipAddress: actor.ip,
    })

    return serializePostDetail(post)
  }

  async approve(id: string, actor: { user: AuthenticatedUser; ip: string }) {
    return this.transition(id, 'APPROVED', AuditAction.POST_APPROVED, actor)
  }

  async schedule(id: string, scheduledAt: Date, actor: { user: AuthenticatedUser; ip: string }) {
    const existing = await prisma.post.findUnique({ where: { id } })
    if (!existing) notFound()

    if (scheduledAt.getTime() <= Date.now()) {
      throw new Exception('scheduledAt must be in the future', {
        status: 422,
        code: 'E_VALIDATION_ERROR',
      })
    }

    assertTransition(existing.status, 'SCHEDULED')

    const post = await prisma.post.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt, updatedBy: actor.user.id },
      include: postDetailInclude,
    })

    await writeAuditLog({
      userId: actor.user.id,
      action: AuditAction.POST_SCHEDULED,
      entityType: 'post',
      entityId: id,
      metadata: { scheduledAt: scheduledAt.toISOString() },
      ipAddress: actor.ip,
    })

    return serializePostDetail(post)
  }

  async publish(id: string, socialPageId: string, actor: { user: AuthenticatedUser; ip: string }) {
    const existing = await prisma.post.findUnique({ where: { id } })
    if (!existing) notFound()

    const page = await prisma.socialPage.findFirst({
      where: { id: socialPageId, isActive: true },
    })
    if (!page) {
      throw new Exception('socialPageId does not exist or is not active', {
        status: 422,
        code: 'E_VALIDATION_ERROR',
      })
    }

    assertTransition(existing.status, 'PUBLISHING')

    const idempotencyKey = randomUUID()
    const post = await prisma.$transaction(async (tx) => {
      const updated = await tx.post.update({
        where: { id },
        data: { status: 'PUBLISHING', updatedBy: actor.user.id },
      })
      const publication = await tx.postPublication.create({
        data: {
          postId: id,
          socialPageId,
          status: 'PENDING',
          idempotencyKey,
        },
      })
      await tx.publishingJob.create({
        data: {
          postId: id,
          publicationId: publication.id,
          jobType: 'PUBLISH_FACEBOOK',
          status: 'PENDING',
          idempotencyKey,
        },
      })
      return updated
    })

    const detail = await this.detail(post.id)

    await writeAuditLog({
      userId: actor.user.id,
      action: AuditAction.POST_PUBLISHED,
      entityType: 'post',
      entityId: id,
      metadata: { socialPageId, status: 'queued' },
      ipAddress: actor.ip,
    })

    return detail
  }

  async retry(id: string, actor: { user: AuthenticatedUser; ip: string }) {
    const existing = await prisma.post.findUnique({ where: { id } })
    if (!existing) notFound()

    const failedPublication = await prisma.postPublication.findFirst({
      where: { postId: id, status: 'FAILED' },
      orderBy: { updatedAt: 'desc' },
    })
    if (!failedPublication) {
      throw new Exception('No failed publication to retry', {
        status: 409,
        code: 'E_NOTHING_TO_RETRY',
      })
    }

    const lastJob = await prisma.publishingJob.findFirst({
      where: { publicationId: failedPublication.id },
      orderBy: { attempts: 'desc' },
    })
    const attempts = (lastJob?.attempts ?? 0) + 1
    if (attempts > (lastJob?.maxAttempts ?? 5)) {
      throw new Exception('Retry limit reached, manual intervention required', {
        status: 409,
        code: 'E_RETRY_LIMIT',
      })
    }

    assertTransition(existing.status, 'PUBLISHING')

    const post = await prisma.$transaction(async (tx) => {
      const updated = await tx.post.update({
        where: { id },
        data: { status: 'PUBLISHING', updatedBy: actor.user.id },
      })
      await tx.postPublication.update({
        where: { id: failedPublication.id },
        data: { status: 'PENDING', errorCode: null, errorMessage: null },
      })
      await tx.publishingJob.create({
        data: {
          postId: id,
          publicationId: failedPublication.id,
          jobType: 'PUBLISH_FACEBOOK',
          status: 'PENDING',
          attempts,
          idempotencyKey: failedPublication.idempotencyKey ?? randomUUID(),
        },
      })
      return updated
    })

    const detail = await this.detail(post.id)

    await writeAuditLog({
      userId: actor.user.id,
      action: AuditAction.POST_RETRIED,
      entityType: 'post',
      entityId: id,
      metadata: { attempts },
      ipAddress: actor.ip,
    })

    return detail
  }

  async cancel(id: string, actor: { user: AuthenticatedUser; ip: string }) {
    const existing = await prisma.post.findUnique({ where: { id } })
    if (!existing) notFound()

    assertTransition(existing.status, 'CANCELLED')

    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id },
        data: { status: 'CANCELLED', updatedBy: actor.user.id },
      })
      await tx.publishingJob.updateMany({
        where: { postId: id, status: { in: ['PENDING', 'RUNNING'] } },
        data: { status: 'CANCELLED' },
      })
      await tx.postPublication.updateMany({
        where: { postId: id, status: { in: ['PENDING'] } },
        data: { status: 'CANCELLED' },
      })
    })

    await writeAuditLog({
      userId: actor.user.id,
      action: AuditAction.POST_CANCELLED,
      entityType: 'post',
      entityId: id,
      ipAddress: actor.ip,
    })

    return this.detail(id)
  }

  private verseData(payload: CreatePostOutput) {
    return {
      translation: payload.translation!,
      book: payload.book!,
      chapter: payload.chapter!,
      verseStart: payload.verseStart!,
      verseEnd: payload.verseEnd!,
      verseText: payload.verseText!,
    }
  }

  private anyVerseChange(payload: UpdatePostFields): boolean {
    return (
      payload.translation !== undefined ||
      payload.book !== undefined ||
      payload.chapter !== undefined ||
      payload.verseStart !== undefined ||
      payload.verseEnd !== undefined ||
      payload.verseText !== undefined
    )
  }

  private verseRelation(payload: UpdatePostFields, exists: boolean) {
    if (!exists) {
      const complete = this.anyVerseChange(payload)
      return complete
        ? {
            create: {
              translation: payload.translation ?? '',
              book: payload.book ?? '',
              chapter: payload.chapter ?? 1,
              verseStart: payload.verseStart ?? 1,
              verseEnd: payload.verseEnd ?? 1,
              verseText: payload.verseText ?? '',
            },
          }
        : undefined
    }
    return {
      update: {
        ...(payload.translation !== undefined ? { translation: payload.translation } : {}),
        ...(payload.book !== undefined ? { book: payload.book } : {}),
        ...(payload.chapter !== undefined ? { chapter: payload.chapter } : {}),
        ...(payload.verseStart !== undefined ? { verseStart: payload.verseStart } : {}),
        ...(payload.verseEnd !== undefined ? { verseEnd: payload.verseEnd } : {}),
        ...(payload.verseText !== undefined ? { verseText: payload.verseText } : {}),
      },
    }
  }

  private async transition(
    id: string,
    to: 'APPROVED',
    action: string,
    actor: { user: AuthenticatedUser; ip: string }
  ) {
    const existing = await prisma.post.findUnique({ where: { id } })
    if (!existing) notFound()

    assertTransition(existing.status, to)

    const post = await prisma.post.update({
      where: { id },
      data: { status: to, updatedBy: actor.user.id },
      include: postDetailInclude,
    })

    await writeAuditLog({
      userId: actor.user.id,
      action,
      entityType: 'post',
      entityId: id,
      ipAddress: actor.ip,
    })

    return serializePostDetail(post)
  }
}

export const postService = new PostService()
