import { createError } from '@adonisjs/core/exceptions'
import type { PostStatus } from '../../generated/prisma/client.js'

export const InvalidTransitionException = createError(
  'Invalid post status transition',
  'E_INVALID_TRANSITION',
  409
)

export const POST_STATUS_TRANSITIONS: Record<PostStatus, readonly PostStatus[]> = {
  DRAFT: ['READY', 'CANCELLED', 'ARCHIVED'],
  READY: ['PROCESSING', 'CANCELLED', 'ARCHIVED'],
  PROCESSING: ['DESIGN_READY'],
  DESIGN_READY: ['APPROVED'],
  APPROVED: ['SCHEDULED'],
  SCHEDULED: ['PUBLISHING', 'CANCELLED'],
  PUBLISHING: ['PUBLISHED', 'FAILED'],
  FAILED: ['PUBLISHING', 'CANCELLED'],
  PUBLISHED: [],
  CANCELLED: [],
  ARCHIVED: [],
}

export function canTransition(from: PostStatus, to: PostStatus): boolean {
  return POST_STATUS_TRANSITIONS[from].includes(to)
}

export function assertTransition(from: PostStatus, to: PostStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionException(`${from} -> ${to} is not a valid transition`)
  }
}

export function allowedTransitions(status: PostStatus): PostStatus[] {
  return [...POST_STATUS_TRANSITIONS[status]]
}
