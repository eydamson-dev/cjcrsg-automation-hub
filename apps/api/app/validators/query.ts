import vine from '@vinejs/vine'

export const paginationValidator = vine.compile(
  vine.object({
    limit: vine.number().optional(),
    offset: vine.number().optional(),
  })
)

export const uuidParamsValidator = vine.compile(
  vine.object({
    id: vine.string().uuid(),
  })
)

export const idValidator = vine.compile(vine.object({ id: vine.string().uuid() }))
