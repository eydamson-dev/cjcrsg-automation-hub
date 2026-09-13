import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import { prisma } from '#db/prisma'
import { authUserRequired } from '#types/auth'
import { writeAuditLog, AuditAction } from '#services/audit_service'
import {
  listTemplatesValidator,
  createTemplateValidator,
  updateTemplateValidator,
} from '#validators/templates'
import { uuidParamsValidator } from '#validators/query'

function serializeTemplate(template: {
  id: string
  name: string
  type: 'BIBLE_VERSE' | 'IMAGE'
  canvaTemplateId: string | null
  canvaDesignId: string | null
  thumbnailAssetId: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: template.id,
    name: template.name,
    type: template.type,
    canvaTemplateId: template.canvaTemplateId,
    canvaDesignId: template.canvaDesignId,
    thumbnailAssetId: template.thumbnailAssetId,
    active: template.active,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  }
}

export default class TemplatesController {
  async index(ctx: HttpContext) {
    const payload = await listTemplatesValidator.validate(ctx.request.qs())

    const where = {
      ...(payload.type ? { type: payload.type } : {}),
      ...(payload.active !== undefined ? { active: payload.active } : {}),
    }

    const templates = await prisma.canvaTemplate.findMany({ where, orderBy: { name: 'asc' } })
    return { items: templates.map(serializeTemplate) }
  }

  async store(ctx: HttpContext) {
    const payload = await createTemplateValidator.validate(ctx.request.all())

    if (
      payload.thumbnailAssetId &&
      !(await prisma.asset.findUnique({ where: { id: payload.thumbnailAssetId } }))
    ) {
      throw new Exception('thumbnailAssetId does not exist', {
        status: 422,
        code: 'E_VALIDATION_ERROR',
      })
    }

    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }
    const template = await prisma.canvaTemplate.create({ data: { ...payload } })

    await writeAuditLog({
      userId: actor.user.id,
      action: AuditAction.TEMPLATE_CREATED,
      entityType: 'canva_template',
      entityId: template.id,
      ipAddress: actor.ip,
    })

    return ctx.response.created(serializeTemplate(template))
  }

  async update(ctx: HttpContext) {
    const { id } = await uuidParamsValidator.validate(ctx.params)
    const payload = await updateTemplateValidator.validate(ctx.request.all())

    const existing = await prisma.canvaTemplate.findUnique({ where: { id } })
    if (!existing) {
      throw new Exception('Template not found', { status: 404, code: 'E_TEMPLATE_NOT_FOUND' })
    }

    if (
      payload.thumbnailAssetId &&
      !(await prisma.asset.findUnique({ where: { id: payload.thumbnailAssetId } }))
    ) {
      throw new Exception('thumbnailAssetId does not exist', {
        status: 422,
        code: 'E_VALIDATION_ERROR',
      })
    }

    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }
    const template = await prisma.canvaTemplate.update({ where: { id }, data: { ...payload } })

    await writeAuditLog({
      userId: actor.user.id,
      action: AuditAction.TEMPLATE_UPDATED,
      entityType: 'canva_template',
      entityId: id,
      ipAddress: actor.ip,
    })

    return serializeTemplate(template)
  }

  async destroy(ctx: HttpContext) {
    const { id } = await uuidParamsValidator.validate(ctx.params)

    const existing = await prisma.canvaTemplate.findUnique({ where: { id } })
    if (!existing) {
      throw new Exception('Template not found', { status: 404, code: 'E_TEMPLATE_NOT_FOUND' })
    }

    const postsLinked = await prisma.post.count({ where: { templateId: id } })
    if (postsLinked > 0) {
      throw new Exception(`Template is used by ${postsLinked} post(s)`, {
        status: 409,
        code: 'E_TEMPLATE_IN_USE',
      })
    }

    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }
    await prisma.canvaTemplate.delete({ where: { id } })

    await writeAuditLog({
      userId: actor.user.id,
      action: AuditAction.TEMPLATE_DELETED,
      entityType: 'canva_template',
      entityId: id,
      ipAddress: actor.ip,
    })

    return ctx.response.noContent()
  }
}
