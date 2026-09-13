import vine from '@vinejs/vine'

export const listAssetsValidator = vine.compile(
  vine.object({
    limit: vine.number().optional(),
    offset: vine.number().optional(),
    mimeType: vine.string().trim().maxLength(100).optional(),
  })
)
