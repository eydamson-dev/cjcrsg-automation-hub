import vine from '@vinejs/vine'

export const listTemplatesValidator = vine.compile(
  vine.object({
    type: vine.enum(['BIBLE_VERSE', 'IMAGE'] as const).optional(),
    active: vine.boolean().optional(),
  })
)

export const createTemplateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(200),
    type: vine.enum(['BIBLE_VERSE', 'IMAGE'] as const),
    canvaTemplateId: vine.string().trim().maxLength(200).optional(),
    canvaDesignId: vine.string().trim().maxLength(200).optional(),
    thumbnailAssetId: vine.string().uuid().optional(),
  })
)

export const updateTemplateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(200).optional(),
    type: vine.enum(['BIBLE_VERSE', 'IMAGE'] as const).optional(),
    canvaTemplateId: vine.string().trim().maxLength(200).optional(),
    canvaDesignId: vine.string().trim().maxLength(200).optional(),
    thumbnailAssetId: vine.string().uuid().optional(),
    active: vine.boolean().optional(),
  })
)
