import type { HttpContext } from '@adonisjs/core/http'
import { prisma } from '#db/prisma'
import { authUserRequired } from '#types/auth'
import { postService } from '#services/post_service'
import { serializePostSummary } from '#serializers/post'
import { optionalDate, parseDate } from '#utils/date'
import {
  createPostValidator,
  listPostsValidator,
  schedulePostValidator,
  publishPostValidator,
  designPostValidator,
  updatePostValidator,
} from '#validators/posts'
import { uuidParamsValidator } from '#validators/query'

const MAX_LIMIT = 100

function normalizePagination(req: Record<string, unknown>) {
  const limit = Math.min(
    Math.max(typeof req.limit === 'number' ? req.limit : req.limit ? Number(req.limit) : 20, 1),
    MAX_LIMIT
  )
  const offset = typeof req.offset === 'number' ? req.offset : req.offset ? Number(req.offset) : 0
  return { limit, offset }
}

export default class PostsController {
  async index(ctx: HttpContext) {
    const payload = await listPostsValidator.validate(ctx.request.qs())
    const { limit, offset } = normalizePagination({ limit: payload.limit, offset: payload.offset })

    const where = {
      ...(payload.type ? { type: payload.type } : {}),
      ...(payload.status ? { status: payload.status } : {}),
      ...(payload.q
        ? {
            OR: [
              { title: { contains: payload.q } },
              { caption: { contains: payload.q } },
              { bibleVerse: { is: { book: { contains: payload.q } } } },
              { bibleVerse: { is: { translation: { contains: payload.q } } } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.post.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
      prisma.post.count({ where }),
    ])

    return { items: items.map(serializePostSummary), total, limit, offset }
  }

  async store(ctx: HttpContext) {
    const payload = await createPostValidator.validate(ctx.request.all())
    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }
    const withDates = { ...payload, scheduledAt: optionalDate(payload.scheduledAt) }
    return ctx.response.created(await postService.create(withDates, actor))
  }

  async bibleVerse(ctx: HttpContext) {
    const payload = await createPostValidator.validate({
      ...ctx.request.all(),
      type: 'BIBLE_VERSE',
    })
    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }
    const withDates = { ...payload, scheduledAt: optionalDate(payload.scheduledAt) }
    return ctx.response.created(await postService.create(withDates, actor))
  }

  async show(ctx: HttpContext) {
    const { id } = await uuidParamsValidator.validate(ctx.params)
    return postService.detail(id)
  }

  async update(ctx: HttpContext) {
    const { id } = await uuidParamsValidator.validate(ctx.params)
    const payload = await updatePostValidator.validate(ctx.request.all())
    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }
    const withDates = { ...payload, scheduledAt: optionalDate(payload.scheduledAt) }
    return postService.update(id, withDates, actor)
  }

  async destroy(ctx: HttpContext) {
    const { id } = await uuidParamsValidator.validate(ctx.params)
    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }
    await postService.delete(id, actor)
    return ctx.response.noContent()
  }

  async design(ctx: HttpContext) {
    const { id } = await uuidParamsValidator.validate(ctx.params)
    const { templateId } = await designPostValidator.validate(ctx.request.all())
    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }
    return postService.design(id, templateId, actor)
  }

  async approve(ctx: HttpContext) {
    const { id } = await uuidParamsValidator.validate(ctx.params)
    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }
    return postService.approve(id, actor)
  }

  async schedule(ctx: HttpContext) {
    const { id } = await uuidParamsValidator.validate(ctx.params)
    const { scheduledAt } = await schedulePostValidator.validate(ctx.request.all())
    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }
    return postService.schedule(id, parseDate(scheduledAt, 'scheduledAt'), actor)
  }

  async publish(ctx: HttpContext) {
    const { id } = await uuidParamsValidator.validate(ctx.params)
    const { socialPageId } = await publishPostValidator.validate(ctx.request.all())
    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }
    return postService.publish(id, socialPageId, actor)
  }

  async retry(ctx: HttpContext) {
    const { id } = await uuidParamsValidator.validate(ctx.params)
    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }
    return postService.retry(id, actor)
  }

  async cancel(ctx: HttpContext) {
    const { id } = await uuidParamsValidator.validate(ctx.params)
    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }
    return postService.cancel(id, actor)
  }

  async duplicate(ctx: HttpContext) {
    const { id } = await uuidParamsValidator.validate(ctx.params)
    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }
    return ctx.response.created(await postService.duplicate(id, actor))
  }
}
