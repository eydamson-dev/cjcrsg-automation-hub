'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil } from 'lucide-react'
import { postsApi, socialApi } from '@/lib/api'
import type { PostStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const EDITABLE = ['DRAFT', 'READY']

export function PostActions({ postId, status, asEditLink = false }: { postId: string; status: PostStatus; asEditLink?: boolean }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [pageId, setPageId] = useState('')

  const pagesQuery = useQuery({ queryKey: ['social/pages'], queryFn: () => socialApi.pages(), enabled: publishOpen })

  const action = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      toast.success('Done')
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.invalidateQueries({ queryKey: ['post', postId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function dispatch(fn: () => Promise<unknown>) {
    action.mutate(fn)
  }

  const editable = EDITABLE.includes(status)
  const canCancel = ['DRAFT', 'READY', 'SCHEDULED', 'FAILED'].includes(status)
  const canDelete = ['DRAFT', 'READY', 'CANCELLED'].includes(status)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Post actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Post actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push(`/posts/${postId}`)}>View</DropdownMenuItem>
          {asEditLink && editable ? (
            <DropdownMenuItem onClick={() => router.push(`/posts/${postId}/edit`)}>
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => dispatch(() => postsApi.duplicate(postId))}>Duplicate</DropdownMenuItem>
          {status === 'DESIGN_READY' ? (
            <DropdownMenuItem onClick={() => dispatch(() => postsApi.approve(postId))}>Approve</DropdownMenuItem>
          ) : null}
          {status === 'DESIGN_READY' || status === 'APPROVED' ? (
            <DropdownMenuItem onClick={() => setScheduleOpen(true)}>Schedule…</DropdownMenuItem>
          ) : null}
          {status === 'SCHEDULED' ? (
            <DropdownMenuItem onClick={() => setPublishOpen(true)}>Publish…</DropdownMenuItem>
          ) : null}
          {status === 'FAILED' ? (
            <DropdownMenuItem onClick={() => dispatch(() => postsApi.retry(postId))}>Retry</DropdownMenuItem>
          ) : null}
          {canCancel ? <DropdownMenuItem onClick={() => dispatch(() => postsApi.cancel(postId))}>Cancel</DropdownMenuItem> : null}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
                Delete…
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule post</DialogTitle>
            <DialogDescription>Pick a future date and time.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="scheduledAt">Scheduled at</Label>
            <Input id="scheduledAt" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!scheduledAt}
              onClick={() => {
                dispatch(() => postsApi.schedule(postId, new Date(scheduledAt).toISOString()))
                setScheduleOpen(false)
              }}
            >
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish post</DialogTitle>
            <DialogDescription>Choose the Facebook page to publish to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Facebook page</Label>
            <Select value={pageId} onValueChange={setPageId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a page" />
              </SelectTrigger>
              <SelectContent>
                {(pagesQuery.data?.items ?? []).map((page) => (
                  <SelectItem key={page.id} value={page.id}>
                    {page.name ?? page.externalPageId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!pageId}
              onClick={() => {
                dispatch(() => postsApi.publish(postId, pageId))
                setPublishOpen(false)
              }}
            >
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete post</DialogTitle>
            <DialogDescription>This permanently removes the post. This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Keep post
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                dispatch(() => postsApi.remove(postId))
                setDeleteOpen(false)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}