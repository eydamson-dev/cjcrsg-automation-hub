'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { socialApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function SocialPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [pages, setPages] = useState('')

  const accounts = useQuery({ queryKey: ['social/accounts'], queryFn: socialApi.accounts })
  const pagesQuery = useQuery({ queryKey: ['social/pages'], queryFn: () => socialApi.pages() })

  const connect = useMutation({
    mutationFn: () =>
      socialApi.connect({
        accountName,
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
        pages: pages
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => ({ externalPageId: line })),
      }),
    onSuccess: () => {
      toast.success('Facebook account connected')
      setOpen(false)
      setAccountName('')
      setAccessToken('')
      setRefreshToken('')
      setPages('')
      queryClient.invalidateQueries({ queryKey: ['social/accounts'] })
      queryClient.invalidateQueries({ queryKey: ['social/pages'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Social accounts</h1>
        <Button onClick={() => setOpen(true)}>Connect Facebook</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {accounts.data?.items.map((account) => (
          <Card key={account.id}>
            <CardHeader>
              <CardTitle>{account.accountName ?? account.provider}</CardTitle>
              <CardDescription>
                {account.provider.toLowerCase()} · {account.pageCount} pages · token set: {account.hasAccessToken ? 'yes' : 'no'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {(account.pages ?? []).map((page) => (
                  <li key={page.id} className="flex justify-between">
                    <span>{page.name ?? page.externalPageId}</span>
                    <span className="text-muted-foreground">{page.isActive ? 'active' : 'inactive'}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
        {!accounts.data?.items.length ? (
          <p className="text-sm text-muted-foreground">No connected accounts.</p>
        ) : null}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page</TableHead>
              <TableHead>External ID</TableHead>
              <TableHead>Connection</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagesQuery.data?.items.map((page) => (
              <TableRow key={page.id}>
                <TableCell>{page.name ?? 'Unnamed page'}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{page.externalPageId}</TableCell>
                <TableCell>{page.isActive ? 'active' : 'inactive'}</TableCell>
              </TableRow>
            ))}
            {!pagesQuery.data?.items.length ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  No pages connected.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect a Facebook account</DialogTitle>
            <DialogDescription>Tokens are encrypted and stored server-side.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accountName">Account name</Label>
              <Input id="accountName" value={accountName} onChange={(event) => setAccountName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessToken">Access token</Label>
              <Input id="accessToken" type="password" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refreshToken">Refresh token (optional)</Label>
              <Input id="refreshToken" type="password" value={refreshToken} onChange={(event) => setRefreshToken(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pages">Page IDs (one per line)</Label>
              <Input id="pages" value={pages} onChange={(event) => setPages(event.target.value)} placeholder={'pg-12345\npg-67890'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => connect.mutate()} disabled={connect.isPending || !accountName || !accessToken}>
              {connect.isPending ? 'Connecting…' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}