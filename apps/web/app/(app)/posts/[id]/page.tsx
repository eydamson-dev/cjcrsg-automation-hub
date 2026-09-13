'use client'

import { use } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { assetsApi, postsApi } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { StatusBadge } from '@/components/status-badge'
import { PostActions } from '@/components/post-actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const queryClient = useQueryClient()
  const post = useQuery({
    queryKey: ['post', id],
    queryFn: () => postsApi.get(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'PROCESSING' || status === 'PUBLISHING' ? 5000 : false
    },
  })

  const design = useMutation({
    mutationFn: () => postsApi.design(id, post.data!.templateId!),
    onSuccess: () => {
      toast.success('Design queued')
      queryClient.invalidateQueries({ queryKey: ['post', id] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (post.isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (post.isError) return <p className="text-destructive">{(post.error as Error).message}</p>

  const item = post.data!
  const failedDesignJob = item.jobs.some(
    (job) => job.jobType === 'GENERATE_DESIGN' && job.status === 'FAILED'
  )
  const canDesign =
    item.status === 'DRAFT' ||
    item.status === 'READY' ||
    (item.status === 'PROCESSING' && failedDesignJob)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/posts" className="text-sm text-primary underline-offset-4 hover:underline">
            ← Posts
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{item.title ?? 'Untitled post'}</h1>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={item.status} />
            <span className="text-sm text-muted-foreground">{item.type.replace('_', ' ').toLowerCase()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canDesign && item.templateId ? (
            <Button onClick={() => design.mutate()} disabled={design.isPending}>
              {design.isPending ? 'Generating…' : 'Generate design'}
            </Button>
          ) : null}
          <PostActions postId={item.id} status={item.status} asEditLink />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {item.bibleVerse ? (
              <blockquote className="border-l-4 pl-4 text-muted-foreground">
                <p>{item.bibleVerse.verseText}</p>
                <footer className="mt-1 text-sm font-medium text-foreground">
                  {item.bibleVerse.translation} — {item.bibleVerse.book} {item.bibleVerse.chapter}:
                  {item.bibleVerse.verseStart === item.bibleVerse.verseEnd
                    ? item.bibleVerse.verseStart
                    : `${item.bibleVerse.verseStart}–${item.bibleVerse.verseEnd}`}
                </footer>
              </blockquote>
            ) : null}
            {item.caption ? <p className="text-sm">{item.caption}</p> : null}
            {item.template ? (
              <p className="text-sm text-muted-foreground">Template: <span className="font-medium text-foreground">{item.template.name}</span></p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assets</CardTitle>
            <CardDescription>Source and generated images</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {item.assets.map(({ role, asset }) => (
              <div key={`${role}-${asset.id}`} className="space-y-1">
                <img src={assetsApi.contentUrl(asset.id)} alt={asset.filename} className="aspect-square w-full rounded-md border object-cover" />
                <p className="truncate text-xs text-muted-foreground">{asset.filename}</p>
              </div>
            ))}
            {!item.assets.length ? <p className="text-sm text-muted-foreground">No assets attached.</p> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent><p className="text-sm">{formatDateTime(item.scheduledAt)}</p></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Publications</CardTitle>
            <CardDescription>Per-platform publishing status</CardDescription>
          </CardHeader>
          <CardContent>
            {item.publications.length ? (
              <ul className="space-y-2 text-sm">
                {item.publications.map((publication) => (
                  <li key={publication.id} className="flex items-center justify-between">
                    <span>{publication.status}</span>
                    <span className="text-muted-foreground">{publication.externalPostId ?? 'no external id yet'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Not published yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
            <CardDescription>Publishing job history</CardDescription>
          </CardHeader>
          <CardContent>
            {item.jobs.length ? (
              <ul className="space-y-2 text-sm">
                {item.jobs.map((job) => (
                  <li key={job.id} className="flex items-center justify-between">
                    <span>{job.jobType.replace('_', ' ').toLowerCase()}</span>
                    <span className="text-muted-foreground">
                      {job.status} · attempt {job.attempts}/{job.maxAttempts}
                      {job.lastError ? ` · ${job.lastError}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No jobs yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}