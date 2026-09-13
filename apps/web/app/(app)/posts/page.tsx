'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { postsApi } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { StatusBadge } from '@/components/status-badge'
import { PostActions } from '@/components/post-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const STATUSES = ['DRAFT', 'READY', 'PROCESSING', 'DESIGN_READY', 'APPROVED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED', 'ARCHIVED'] as const

const LIMIT = 20

export default function PostsPage() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [offset, setOffset] = useState(0)

  const posts = useQuery({
    queryKey: ['posts', { q, status, type, offset }],
    queryFn: () => postsApi.list({ q: q || undefined, status: status || undefined, type: type || undefined, limit: LIMIT, offset }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Posts</h1>
        <Button asChild>
          <Link href="/posts/new">New post</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Input placeholder="Search title or caption…" value={q} onChange={(event) => { setQ(event.target.value); setOffset(0) }} />
        </div>
        <div className="w-40">
          <Select value={status} onValueChange={(value) => { setStatus(value === 'all' ? '' : value); setOffset(0) }}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select value={type} onValueChange={(value) => { setType(value === 'all' ? '' : value); setOffset(0) }}>
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="BIBLE_VERSE">Bible verse</SelectItem>
              <SelectItem value="IMAGE">Image</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.data?.items.map((post) => (
              <TableRow key={post.id}>
                <TableCell><StatusBadge status={post.status} /></TableCell>
                <TableCell>{post.type.replace('_', ' ').toLowerCase()}</TableCell>
                <TableCell>
                  <Link href={`/posts/${post.id}`} className="line-clamp-2 hover:underline">
                    {post.title ?? post.caption ?? 'Untitled'}
                  </Link>
                </TableCell>
                <TableCell>{formatDateTime(post.scheduledAt)}</TableCell>
                <TableCell>{formatDateTime(post.updatedAt)}</TableCell>
                <TableCell className="text-right">
                  <PostActions postId={post.id} status={post.status} asEditLink />
                </TableCell>
              </TableRow>
            ))}
            {!posts.isLoading && !posts.data?.items.length ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No posts match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {posts.data ? `Showing ${posts.data.offset + 1}–${Math.min(posts.data.offset + posts.data.limit, posts.data.total)} of ${posts.data.total}` : '…'}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={!posts.data || offset + LIMIT >= posts.data.total} onClick={() => setOffset(offset + LIMIT)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}