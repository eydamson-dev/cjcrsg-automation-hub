import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import { authUserRequired } from '#types/auth'
import { assetService } from '#services/asset_service'
import { listAssetsValidator } from '#validators/assets'
import { uuidParamsValidator } from '#validators/query'

export default class AssetsController {
  async index(ctx: HttpContext) {
    const payload = await listAssetsValidator.validate(ctx.request.qs())
    const limit = Math.min(Math.max(payload.limit ?? 20, 1), 100)
    const offset = payload.offset ?? 0

    return assetService.list({ limit, offset, mimeType: payload.mimeType })
  }

  async store(ctx: HttpContext) {
    const file = ctx.request.file('file')
    if (!file) {
      throw new Exception('Missing file field', { status: 422, code: 'E_VALIDATION_ERROR' })
    }
    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }
    return ctx.response.created(await assetService.upload(file, actor))
  }

  async show(ctx: HttpContext) {
    const { id } = await uuidParamsValidator.validate(ctx.params)
    return assetService.detail(id)
  }

  async content(ctx: HttpContext) {
    const { id } = await uuidParamsValidator.validate(ctx.params)
    const { buffer, asset } = await assetService.content(id)

    ctx.response.header('Content-Type', asset.mimeType)
    ctx.response.header('Content-Length', asset.sizeBytes)
    ctx.response.header('Cache-Control', 'private, max-age=3600')
    return ctx.response.send(buffer)
  }

  async destroy(ctx: HttpContext) {
    const { id } = await uuidParamsValidator.validate(ctx.params)
    const actor = { user: authUserRequired(ctx), ip: ctx.request.ip() }
    await assetService.delete(id, actor)
    return ctx.response.noContent()
  }
}
