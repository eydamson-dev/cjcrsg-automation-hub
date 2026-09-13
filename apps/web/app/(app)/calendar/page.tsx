'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { postsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function startOfMonth(month: Date) {
  return new Date(month.getFullYear(), month.getMonth(), 1)
}

export default function CalendarPage() {
  const now = new Date()
  const [month, setMonth] = useState(startOfMonth(now))

  const scheduled = useQuery({
    queryKey: ['posts', 'scheduled'],
    queryFn: () => postsApi.list({ status: 'SCHEDULED', limit: 100 }),
  })

  const cells: Date[] = []
  const firstDay = startOfMonth(month)
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - firstDay.getDay())
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + i)
    cells.push(date)
  }

  const postsByDate = new Map<string, Array<{ id: string; title: string | null }>>()
  for (const post of scheduled.data?.items ?? []) {
    if (!post.scheduledAt) continue
    const key = new Date(post.scheduledAt).toDateString()
    postsByDate.set(key, [...(postsByDate.get(key) ?? []), { id: post.id, title: post.title ?? post.caption }])
  }

  const inMonth = (date: Date) => date.getMonth() === month.getMonth()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-36 text-center font-medium">
            {month.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-sm font-medium text-muted-foreground">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-2">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, index) => {
            const key = date.toDateString()
            const posts = postsByDate.get(key) ?? []
            const today = date.toDateString() === now.toDateString()
            return (
              <div
                key={index}
                className={cn(
                  'min-h-24 border-b border-r p-2 last:border-r-0',
                  !inMonth(date) && 'bg-muted/30 text-muted-foreground',
                )}
              >
                <div className={cn('mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs', today && 'bg-primary font-semibold text-primary-foreground')}>
                  {date.getDate()}
                </div>
                <div className="space-y-1">
                  {posts.slice(0, 2).map((post) => (
                    <Link
                      key={post.id}
                      href={`/posts/${post.id}`}
                      className="block truncate rounded bg-primary/10 px-1.5 py-0.5 text-xs hover:underline"
                    >
                      {post.title ?? 'Untitled'}
                    </Link>
                  ))}
                  {posts.length > 2 ? <p className="px-1 text-xs text-muted-foreground">+{posts.length - 2} more</p> : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}