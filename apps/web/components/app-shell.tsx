'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  FileImage,
  LayoutDashboard,
  LogOut,
  Newspaper,
  Settings2,
  Share2,
} from 'lucide-react'
import { useCurrentUser, isAdmin } from '@/lib/auth'
import { authApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/posts', label: 'Posts', icon: Newspaper },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/media', label: 'Media', icon: FileImage },
  { href: '/templates', label: 'Templates', icon: Settings2, adminOnly: true },
  { href: '/social', label: 'Social', icon: Share2, adminOnly: true },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  const admin = isAdmin(user)

  async function signOut() {
    await authApi.logout().catch(() => {})
    queryClient.clear()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r bg-card">
        <div className="flex h-14 items-center border-b px-4 font-semibold">Social Manager</div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.filter((item) => !item.adminOnly || admin).map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.name ?? '…'}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.role.toLowerCase()}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
      <main className="ml-60 flex-1">
        <div className="mx-auto w-full max-w-6xl px-6 py-6">{children}</div>
      </main>
    </div>
  )
}