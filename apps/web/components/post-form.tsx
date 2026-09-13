'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { assetsApi, postsApi, templatesApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { PostDetail, PostType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const EDITABLE = ['DRAFT', 'READY']

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function PostForm({ initial }: { initial?: PostDetail }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [type, setType] = useState<PostType>(initial?.type ?? 'BIBLE_VERSE')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [caption, setCaption] = useState(initial?.caption ?? '')
  const [translation, setTranslation] = useState(initial?.bibleVerse?.translation ?? 'KJV')
  const [book, setBook] = useState(initial?.bibleVerse?.book ?? '')
  const [chapter, setChapter] = useState(initial?.bibleVerse?.chapter ? String(initial.bibleVerse.chapter) : '')
  const [verseStart, setVerseStart] = useState(initial?.bibleVerse?.verseStart ? String(initial.bibleVerse.verseStart) : '')
  const [verseEnd, setVerseEnd] = useState(initial?.bibleVerse?.verseEnd ? String(initial.bibleVerse.verseEnd) : '')
  const [verseText, setVerseText] = useState(initial?.bibleVerse?.verseText ?? '')
  const [assetId, setAssetId] = useState(initial?.assets.find((a) => a.role === 'SOURCE_IMAGE')?.asset.id ?? '')
  const [templateId, setTemplateId] = useState(initial?.templateId ?? '')
  const [scheduledAt, setScheduledAt] = useState(toDateTimeLocal(initial?.scheduledAt))

  const templates = useQuery({ queryKey: ['canva/templates'], queryFn: () => templatesApi.list() })
  const assets = useQuery({ queryKey: ['assets'], queryFn: () => assetsApi.list({ limit: 100 }) })

  const editable = initial ? EDITABLE.includes(initial.status) : true

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        title: title || undefined,
        caption: caption || undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        templateId: templateId || undefined,
        ...(type === 'BIBLE_VERSE'
          ? {
              translation,
              book,
              chapter: Number(chapter),
              verseStart: Number(verseStart),
              verseEnd: Number(verseEnd),
              verseText,
            }
          : { assetId: assetId || undefined }),
      }
      return initial ? postsApi.update(initial.id, body) : postsApi.create({ type, ...body })
    },
    onSuccess: (post) => {
      toast.success(initial ? 'Post updated' : 'Draft saved')
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.invalidateQueries({ queryKey: ['post', post.id] })
      router.push(`/posts/${post.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (!editable) {
    return <p className="text-muted-foreground">This post can no longer be edited. It is <span className="uppercase">{initial?.status}</span>.</p>
  }

  return (
    <form
      className="max-w-2xl space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <div className="space-y-2">
        <Label>Post type</Label>
        <Select value={type} onValueChange={(value) => setType(value as PostType)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BIBLE_VERSE">Bible verse</SelectItem>
            <SelectItem value="IMAGE">Image</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional short title" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="caption">Caption</Label>
        <Textarea id="caption" value={caption} onChange={(event) => setCaption(event.target.value)} rows={3} placeholder="Post text" />
      </div>

      {type === 'BIBLE_VERSE' ? (
        <div className="space-y-4 rounded-md border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="translation">Translation</Label>
              <Input id="translation" value={translation} onChange={(event) => setTranslation(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book">Book</Label>
              <Input id="book" value={book} onChange={(event) => setBook(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chapter">Chapter</Label>
              <Input id="chapter" type="number" min={1} value={chapter} onChange={(event) => setChapter(event.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="verseStart">Verse start</Label>
                <Input id="verseStart" type="number" min={1} value={verseStart} onChange={(event) => setVerseStart(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="verseEnd">Verse end</Label>
                <Input id="verseEnd" type="number" min={1} value={verseEnd} onChange={(event) => setVerseEnd(event.target.value)} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="verseText">Verse text</Label>
            <Textarea id="verseText" value={verseText} onChange={(event) => setVerseText(event.target.value)} rows={4} required />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Source image</Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {assets.data?.items.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => setAssetId(asset.id)}
                className={cn(
                  'overflow-hidden rounded-md border',
                  assetId === asset.id ? 'ring-2 ring-ring' : '',
                )}
              >
                <img src={assetsApi.contentUrl(asset.id)} alt={asset.filename} className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
          {!assets.data?.items.length ? <p className="text-sm text-muted-foreground">No media yet. Upload one from the Media page.</p> : null}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Template</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              {(templates.data?.items ?? []).filter((template) => template.active).map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="scheduledAt">Schedule (optional)</Label>
          <Input id="scheduledAt" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : initial ? 'Save changes' : 'Save draft'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}