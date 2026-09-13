import vine from '@vinejs/vine'

export const claimJobValidator = vine.compile(
  vine.object({
    jobType: vine.enum(['GENERATE_DESIGN', 'PUBLISH_FACEBOOK'] as const),
  })
)

export const jobIdValidator = vine.compile(
  vine.object({
    jobId: vine.string().uuid(),
  })
)

export const resultValidator = vine.compile(
  vine.object({
    jobId: vine.string().uuid(),
    code: vine.string().trim().maxLength(100).optional(),
    message: vine.string().trim().maxLength(2000).optional(),
  })
)

export const schedulerDueValidator = vine.compile(
  vine.object({
    now: vine.string().optional(),
  })
)

export const enqueueValidator = vine.compile(
  vine.object({
    postId: vine.string().uuid(),
  })
)
