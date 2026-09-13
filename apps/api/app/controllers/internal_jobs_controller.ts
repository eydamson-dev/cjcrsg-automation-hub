import type { HttpContext } from '@adonisjs/core/http'
import { internalJobService } from '#services/jobs/internal_job_service'
import {
  claimJobValidator,
  enqueueValidator,
  jobIdValidator,
  resultValidator,
  schedulerDueValidator,
} from '#validators/internal'

export default class InternalJobsController {
  async next(ctx: HttpContext) {
    const { jobType } = await claimJobValidator.validate(ctx.request.qs())
    const job = await internalJobService.claim(jobType)
    if (!job) {
      return ctx.response.noContent()
    }
    return { job }
  }

  async design(ctx: HttpContext) {
    const { jobId } = await jobIdValidator.validate(ctx.request.all())
    return internalJobService.runDesign(jobId)
  }

  async publish(ctx: HttpContext) {
    const { jobId } = await jobIdValidator.validate(ctx.request.all())
    return internalJobService.runPublish(jobId)
  }

  async result(ctx: HttpContext) {
    const payload = await resultValidator.validate(ctx.request.all())
    const code = payload.code ?? 'E_INTERNAL_JOB_FAILED'
    const message = payload.message ?? 'Workflow reported a failure'
    return internalJobService.fail(payload.jobId, code, message)
  }

  async due(ctx: HttpContext) {
    const payload = await schedulerDueValidator.validate(ctx.request.qs())
    const now = payload.now ? new Date(payload.now) : new Date()
    return internalJobService.listDueScheduled(now)
  }

  async enqueue(ctx: HttpContext) {
    const { postId } = await enqueueValidator.validate(ctx.request.all())
    const item = await internalJobService.enqueueForPublish(postId)
    return { jobId: item.job.id, postId: item.postId, publicationId: item.publicationId }
  }
}
