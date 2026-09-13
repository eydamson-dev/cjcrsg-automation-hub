import type { PostStatus } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

const VARIANTS: Record<PostStatus, 'default' | 'secondary' | 'outline' | 'destructive' | 'success'> = {
  DRAFT: 'secondary',
  READY: 'outline',
  PROCESSING: 'outline',
  DESIGN_READY: 'outline',
  APPROVED: 'outline',
  SCHEDULED: 'default',
  PUBLISHING: 'outline',
  PUBLISHED: 'success',
  FAILED: 'destructive',
  CANCELLED: 'secondary',
  ARCHIVED: 'secondary',
}

export function StatusBadge({ status }: { status: PostStatus }) {
  return <Badge variant={VARIANTS[status]}>{status.replace('_', ' ')}</Badge>
}