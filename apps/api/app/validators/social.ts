import vine from '@vinejs/vine'
import type { SocialProvider } from '../../generated/prisma/client.js'

export const connectFacebookValidator = vine.compile(
  vine.object({
    accountName: vine.string().trim().minLength(1).maxLength(100),
    accessToken: vine.string().minLength(16),
    refreshToken: vine.string().optional(),
    tokenExpiresAt: vine.string().optional(),
    pages: vine
      .array(
        vine.object({
          externalPageId: vine.string().trim().minLength(1).maxLength(200),
          name: vine.string().trim().maxLength(200).optional(),
        })
      )
      .optional(),
  })
)

export const listPagesValidator = vine.compile(
  vine.object({
    accountId: vine.string().uuid().optional(),
  })
)

export type ConnectFacebookOutput = {
  accountName: string
  accessToken: string
  refreshToken?: string
  tokenExpiresAt?: Date
  provider: SocialProvider
  pages: Array<{ externalPageId: string; name?: string }>
}
