import { prisma } from '#db/prisma'
import type { Prisma } from '../../generated/prisma/client.js'

export const AuditAction = {
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_LOGOUT: 'USER_LOGOUT',
  POST_CREATED: 'POST_CREATED',
  POST_UPDATED: 'POST_UPDATED',
  POST_APPROVED: 'POST_APPROVED',
  POST_SCHEDULED: 'POST_SCHEDULED',
  POST_PUBLISHED: 'POST_PUBLISHED',
  POST_FAILED: 'POST_FAILED',
  POST_RETRIED: 'POST_RETRIED',
  CANVA_CONNECTED: 'CANVA_CONNECTED',
  FACEBOOK_CONNECTED: 'FACEBOOK_CONNECTED',
  TEMPLATE_CREATED: 'TEMPLATE_CREATED',
} as const

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction]

interface AuditLogInput {
  userId?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  metadata?: Record<string, unknown> | null
  ipAddress?: string | null
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    userId: input.userId ?? null,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    ipAddress: input.ipAddress ?? null,
  }
  if (input.metadata) {
    data.metadata = input.metadata as unknown as Prisma.InputJsonValue
  }

  await prisma.auditLog.create({ data })
}
