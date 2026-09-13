'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { postsApi } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function StatCard({ label, total }: { label: string; total: number | undefined }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{total ?? '…'}</p>
      </CardContent>
    </Card>
  )
}

function useStatusTotal(status: string) {
  return useQuery({ queryKey: ['posts', 'status', status], queryFn: () => postsApi.list({ status, limit: 1 }) })
}

export default function DashboardPage() {
  const drafts = useStatusTotal('DRAFT')
  const scheduled = useStatusTotal('SCHEDULED')
  const published = useStatusTotal('PUBLISHED')
  const failed = useStatusTotal('FAILED')

  const upcoming = useQuery({
    queryKey: ['posts', 'upcoming'],
    queryFn: () => postsApi.list({ status: 'SCHEDULED', limit: 20 }),
    select: (data) =>
      data.items
        .filter((post) => post.scheduledAt && new Date(post.scheduledAt).getTime() > Date.now())
        .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
        .slice(0, 5),
  })

  const recent = useQuery({ queryKey: ['posts', 'recent'], queryFn: () => postsApi.list({ limit: 8 }) })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/posts/new" className="text-sm text-primary underline-offset-4 hover:underline">
          New post
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Drafts" total={drafts.data?.total} />
        <StatCard label="Scheduled" total={scheduled.data?.total} />
        <StatCard label="Published" total={published.data?.total} />
        <StatCard label="Failed" total={failed.data?.total} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.data?.length ? (
              <ul className="space-y-3">
                {upcoming.data.map((post) => (
                  <li key={post.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/posts/${post.id}`} className="line-clamp-1 hover:underline">
                      {post.title ?? post.caption ?? 'Untitled'}
                    </Link>
                    <span className="shrink-0 text-muted-foreground">{formatDateTime(post.scheduledAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {recent.data?.items.map((post) => (
                <li key={post.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/posts/${post.id}`} className="line-clamp-1 hover:underline">
                    {post.title ?? post.caption ?? 'Untitled'}
                  </Link>
                  <StatusBadge status={post.status} />
                </li>
              ))}
              {!recent.data?.items.length ? <p className="text-sm text-muted-foreground">No posts yet.</p> : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}