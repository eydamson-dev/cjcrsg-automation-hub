import { randomUUID } from 'node:crypto'
import { Exception } from '@adonisjs/core/exceptions'
import { prisma } from '#db/prisma'
import { assertTransition } from '#domain/post_state_machine'
import { isAutoRetryable } from '#domain/retry_policy'
import { decryptToken } from '#services/token_crypto'
import { storage } from '../storage/index.js'
import { canvasProviderFor, facebookProviderFor } from '../providers/index.js'
import type { CanvasGenerateResult, FacebookPublishResult } from '../providers/provider_types.js'
import { postDetailInclude, serializePostDetail } from '#serializers/post'
import { writeAuditLog, AuditAction } from '#services/audit_service'
import { StorageNotFoundException } from '#services/storage/filesystem_storage'
import type { JobType, StorageProvider } from '../../../generated/prisma/client.js'
import type { PostDetail } from '../../types/post.js'

export const JobNotFoundException = new Exception('Job not found', {
  status: 404,
  code: 'E_JOB_NOT_FOUND',
})

export const JobNotRunnableException = new Exception('Job is not in a runnable state', {
  status: 409,
  code: 'E_JOB_NOT_RUNNING',
})

export interface ClaimPayload {
  id: string
  jobType: JobType
  postId: string
  publicationId: string | null
  attempts: number
  maxAttempts: number
  idempotencyKey: string | null
  post: {
    id: string
    type: string
    status: string
    caption: string | null
  }
  page: { id: string; externalPageId: string; name: string | null } | null
  mediaKeys: string[]
}

export class InternalJobService {
  async claim(jobType: JobType): Promise<ClaimPayload | null> {
    const claimed = await this.claimPending(jobType)
    if (claimed) return this.withMediaKeys(claimed)

    const autoRetry = await this.createAutoRetry(jobType)
    if (autoRetry) return this.withMediaKeys(autoRetry)

    return null
  }

  async runDesign(
    jobId: string
  ): Promise<{ ok: boolean; post?: PostDetail; error?: { code: string; message: string } }> {
    const job = await this.findJob(jobId, 'GENERATE_DESIGN')
    if (this.requireRunnable(job) === 'SUCCEEDED') {
      return { ok: true, post: await this.detail(job.postId) }
    }

    const post = await prisma.post.findUniqueOrThrow({
      where: { id: job.postId },
      include: { template: true, postAssets: { include: { asset: true } } },
    })

    const source = post.postAssets.find(({ role }) => role === 'SOURCE_IMAGE')?.asset
    let sourceBytes: Buffer | undefined
    if (source) {
      try {
        sourceBytes = await storage().get(source.storageKey)
      } catch (error) {
        if (!(error instanceof StorageNotFoundException)) throw error
      }
    }

    let result: CanvasGenerateResult
    try {
      const provider = canvasProviderFor(job)
      result = await provider.generateDesign({
        postId: post.id,
        template: {
          id: post.template?.id ?? '',
          type: post.type,
          canvaTemplateId: post.template?.canvaTemplateId ?? null,
        },
        sourceBytes,
        sourceMimeType: source?.mimeType,
      })
    } catch (error) {
      return this.failJob(job.id, 'E_MOCK_DESIGN_FAILED', this.messageOf(error))
    }

    await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          filename: `generated-${post.id}.png`,
          mimeType: result.exportMimeType,
          sizeBytes: result.sizeBytes,
          storageProvider: 'local' as StorageProvider,
          storageKey: result.exportStorageKey,
          width: null,
          height: null,
          sha256: result.sha256,
        },
      })
      await tx.postAsset.upsert({
        where: { postId_assetId: { postId: post.id, assetId: asset.id } },
        create: { postId: post.id, assetId: asset.id, role: 'GENERATED_IMAGE', sortOrder: 1 },
        update: {},
      })
      assertTransition(post.status, 'DESIGN_READY')
      await tx.post.update({ where: { id: post.id }, data: { status: 'DESIGN_READY' } })
      await tx.publishingJob.update({
        where: { id: job.id },
        data: { status: 'SUCCEEDED', completedAt: new Date() },
      })
    })

    await writeAuditLog({
      userId: null,
      action: AuditAction.POST_UPDATED,
      entityType: 'post',
      entityId: post.id,
      metadata: { action: 'design', designId: result.designId, source: 'internal' },
      ipAddress: 'internal',
    })

    return { ok: true, post: await this.detail(post.id) }
  }

  async runPublish(
    jobId: string
  ): Promise<{ ok: boolean; post?: PostDetail; error?: { code: string; message: string } }> {
    const job = await this.findJob(jobId, 'PUBLISH_FACEBOOK')
    if (this.requireRunnable(job) === 'SUCCEEDED') {
      return { ok: true, post: await this.detail(job.postId) }
    }

    const publication = await prisma.postPublication.findUniqueOrThrow({
      where: { id: job.publicationId! },
      include: {
        socialPage: { include: { account: true } },
        post: { include: { postAssets: { include: { asset: true } } } },
      },
    })

    if (publication.externalPostId) {
      await prisma.publishingJob.update({
        where: { id: job.id },
        data: { status: 'SUCCEEDED', completedAt: new Date() },
      })
      return { ok: true, post: await this.detail(job.postId) }
    }

    const accessToken = decryptToken(publication.socialPage.account.accessTokenEncrypted)
    if (!accessToken) {
      return this.failJob(job.id, 'E_MISSING_TOKEN', 'The social page has no access token')
    }

    const media =
      publication.post.postAssets.find(({ role }) => role === 'GENERATED_IMAGE')?.asset ??
      publication.post.postAssets.find(({ role }) => role === 'SOURCE_IMAGE')?.asset

    let result: FacebookPublishResult
    try {
      const provider = facebookProviderFor(job)
      result = await provider.publish({
        postId: publication.post.id,
        caption: publication.post.caption,
        mediaStorageKey: media?.storageKey,
        accessToken,
        pageExternalId: publication.socialPage.externalPageId,
      })
    } catch (error) {
      return this.failJob(job.id, 'E_MOCK_FACEBOOK_FAILED', this.messageOf(error))
    }

    await prisma.$transaction(async (tx) => {
      await tx.postPublication.update({
        where: { id: publication.id },
        data: {
          status: 'PUBLISHED',
          externalPostId: result.externalPostId,
          externalUrl: result.externalUrl,
          publishedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      })
      assertTransition(publication.post.status, 'PUBLISHED')
      await tx.post.update({
        where: { id: publication.post.id },
        data: { status: 'PUBLISHED' },
      })
      await tx.post.updateMany({
        where: { id: publication.post.id, publishedAt: null },
        data: { publishedAt: new Date() },
      })
      await tx.publishingJob.update({
        where: { id: job.id },
        data: { status: 'SUCCEEDED', completedAt: new Date() },
      })
    })

    await writeAuditLog({
      userId: null,
      action: AuditAction.POST_PUBLISHED,
      entityType: 'post',
      entityId: publication.post.id,
      metadata: { action: 'publish', externalPostId: result.externalPostId, source: 'internal' },
      ipAddress: 'internal',
    })

    return { ok: true, post: await this.detail(job.postId) }
  }

  async fail(
    jobId: string,
    code: string,
    message: string
  ): Promise<{ ok: true; job: { id: string; status: string } }> {
    const job = await prisma.publishingJob.findFirst({
      where: { id: jobId },
      include: { publication: true },
    })
    if (!job) throw JobNotFoundException
    if (job.status === 'SUCCEEDED' || job.status === 'CANCELLED') {
      return { ok: true, job: { id: jobId, status: job.status } }
    }
    if (!['PENDING', 'RUNNING'].includes(job.status)) throw JobNotRunnableException

    if (job.publication?.status === 'PUBLISHED') {
      await prisma.publishingJob.update({
        where: { id: jobId },
        data: { status: 'SUCCEEDED', completedAt: new Date(), lastError: null },
      })
      return { ok: true, job: { id: jobId, status: 'SUCCEEDED' } }
    }

    await prisma.$transaction(async (tx) => {
      await tx.publishingJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', lastError: message, completedAt: new Date() },
      })
      if (job.publication) {
        await tx.postPublication.update({
          where: { id: job.publication.id },
          data: { status: 'FAILED', errorCode: code, errorMessage: message },
        })
        const post = await tx.post.findUniqueOrThrow({ where: { id: job.postId } })
        if (post.status === 'PUBLISHING') {
          await tx.post.update({ where: { id: job.postId }, data: { status: 'FAILED' } })
        }
      }
    })

    await writeAuditLog({
      userId: null,
      action: AuditAction.POST_FAILED,
      entityType: 'post',
      entityId: job.postId,
      metadata: { action: 'job-failed', jobId, code },
      ipAddress: 'internal',
    })

    return { ok: true, job: { id: jobId, status: 'FAILED' } }
  }

  async listDueScheduled(now: Date) {
    const posts = await prisma.post.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
      orderBy: { scheduledAt: 'asc' },
      include: { postAssets: { where: { role: 'GENERATED_IMAGE' }, include: { asset: true } } },
    })

    const activePage = await prisma.socialPage.findFirst({
      where: { isActive: true, provider: 'FACEBOOK' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, externalPageId: true, name: true },
    })

    return {
      items: posts.map((post) => ({
        id: post.id,
        scheduledAt: post.scheduledAt,
        caption: post.caption,
        mediaKeys: post.postAssets.map(({ asset }) => asset.storageKey),
        page: activePage,
      })),
      page: activePage,
    }
  }

  async enqueueForPublish(postId: string) {
    const page =
      (await prisma.socialPage.findFirst({
        where: { isActive: true, provider: 'FACEBOOK' },
        orderBy: { createdAt: 'asc' },
      })) ?? null

    if (!page) {
      throw new Exception('No active Facebook page to publish to', {
        status: 422,
        code: 'E_NO_ACTIVE_PAGE',
      })
    }

    return this.enqueueJob(postId, page.id, 'internal-scheduler')
  }

  async enqueueJob(postId: string, socialPageId: string, source: string) {
    const post = await prisma.post.findUnique({ where: { id: postId } })
    if (!post) throw JobNotFoundException
    assertTransition(post.status, 'PUBLISHING')

    const idempotencyKey = randomUUID()
    const created = await prisma.$transaction(async (tx) => {
      await tx.post.update({ where: { id: postId }, data: { status: 'PUBLISHING' } })
      const publication = await tx.postPublication.create({
        data: { postId, socialPageId, status: 'PENDING', idempotencyKey },
      })
      const job = await tx.publishingJob.create({
        data: {
          postId,
          publicationId: publication.id,
          jobType: 'PUBLISH_FACEBOOK',
          status: 'PENDING',
          idempotencyKey,
        },
      })
      return job
    })

    await writeAuditLog({
      userId: null,
      action: AuditAction.POST_PUBLISHED,
      entityType: 'post',
      entityId: postId,
      metadata: { socialPageId, status: 'queued', source },
      ipAddress: 'internal',
    })

    return { postId, publicationId: created.publicationId!, job: created }
  }

  private async claimPending(jobType: JobType): Promise<ClaimPayload | null> {
    const candidate = await prisma.publishingJob.findFirst({
      where: { jobType, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        post: { select: { id: true, type: true, status: true, caption: true } },
        publication: {
          include: { socialPage: { select: { id: true, externalPageId: true, name: true } } },
        },
      },
    })
    if (!candidate) return null

    const claimed = await prisma.publishingJob.updateMany({
      where: { id: candidate.id, status: 'PENDING' },
      data: { status: 'RUNNING', startedAt: new Date() },
    })
    if (claimed.count === 0) return null

    return {
      id: candidate.id,
      jobType: candidate.jobType,
      postId: candidate.postId,
      publicationId: candidate.publicationId,
      attempts: candidate.attempts,
      maxAttempts: candidate.maxAttempts,
      idempotencyKey: candidate.idempotencyKey,
      post: candidate.post,
      page: candidate.publication?.socialPage ?? null,
      mediaKeys: [],
    }
  }

  private async createAutoRetry(jobType: JobType): Promise<ClaimPayload | null> {
    const now = new Date()
    const failed = await prisma.publishingJob.findFirst({
      where: { jobType, status: 'FAILED' },
      orderBy: { updatedAt: 'asc' },
      include: {
        post: { select: { id: true, type: true, status: true, caption: true } },
        publication: {
          include: { socialPage: { select: { id: true, externalPageId: true, name: true } } },
        },
      },
    })
    if (!failed) return null
    if (!isAutoRetryable(failed, now)) return null

    const created = await prisma.publishingJob.create({
      data: {
        postId: failed.postId,
        publicationId: failed.publicationId,
        jobType,
        status: 'PENDING',
        attempts: failed.attempts + 1,
        maxAttempts: failed.maxAttempts,
        idempotencyKey: failed.idempotencyKey,
        lastError: null,
      },
    })

    const isPublish = jobType === 'PUBLISH_FACEBOOK'
    const publication = failed.publication

    if (isPublish) {
      if (publication) {
        await prisma.postPublication.update({
          where: { id: publication.id },
          data: { status: 'PENDING', errorCode: null, errorMessage: null },
        })
      }
      assertTransition(failed.post.status, 'PUBLISHING')
      await prisma.post.update({ where: { id: failed.postId }, data: { status: 'PUBLISHING' } })
    }

    const claimed = await prisma.publishingJob.updateMany({
      where: { id: created.id, status: 'PENDING' },
      data: { status: 'RUNNING', startedAt: now },
    })
    if (claimed.count === 0) return null

    await writeAuditLog({
      userId: null,
      action: isPublish ? AuditAction.POST_RETRIED : AuditAction.POST_UPDATED,
      entityType: 'post',
      entityId: failed.postId,
      metadata: { source: 'internal-auto-retry', attempts: created.attempts, jobType },
      ipAddress: 'internal',
    })

    return {
      id: created.id,
      jobType: created.jobType,
      postId: created.postId,
      publicationId: created.publicationId,
      attempts: created.attempts,
      maxAttempts: created.maxAttempts,
      idempotencyKey: created.idempotencyKey,
      post: failed.post,
      page: publication?.socialPage ?? null,
      mediaKeys: [],
    }
  }

  private async withMediaKeys(payload: ClaimPayload): Promise<ClaimPayload> {
    if (payload.mediaKeys.length > 0) return payload
    const links = await prisma.postAsset.findMany({
      where: { postId: payload.postId, role: 'GENERATED_IMAGE' },
      include: { asset: true },
    })
    return { ...payload, mediaKeys: links.map(({ asset }) => asset.storageKey) }
  }

  private async findJob(jobId: string, jobType: JobType) {
    const job = await prisma.publishingJob.findFirst({
      where: { id: jobId, jobType },
      include: { publication: true },
    })
    if (!job) throw JobNotFoundException
    return job
  }

  private requireRunnable(job: { status: string }) {
    if (job.status === 'SUCCEEDED') return 'SUCCEEDED'
    if (['PENDING', 'RUNNING'].includes(job.status)) return 'RUNNABLE'
    throw JobNotRunnableException
  }

  private async detail(postId: string): Promise<PostDetail> {
    const post = await prisma.post.findUniqueOrThrow({
      where: { id: postId },
      include: postDetailInclude,
    })
    return serializePostDetail(post)
  }

  private async failJob(
    jobId: string,
    code: string,
    message: string
  ): Promise<{ ok: false; error: { code: string; message: string } }> {
    await this.fail(jobId, code, message)
    return { ok: false, error: { code, message } }
  }

  private messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}

export const internalJobService = new InternalJobService()
