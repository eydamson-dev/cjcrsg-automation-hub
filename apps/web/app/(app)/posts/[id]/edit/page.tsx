'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { postsApi } from '@/lib/api'
import { PostForm } from '@/components/post-form'

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const post = useQuery({ queryKey: ['post', id], queryFn: () => postsApi.get(id) })

  if (post.isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (post.isError) return <p className="text-destructive">{(post.error as Error).message}</p>
  if (!post.data) return null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit post</h1>
      <PostForm initial={post.data} />
    </div>
  )
}