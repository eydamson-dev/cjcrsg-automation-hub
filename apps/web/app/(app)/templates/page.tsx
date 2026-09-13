'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { templatesApi } from '@/lib/api'
import type { PostType, Template } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const EMPTY: Partial<Template> = { name: '', type: 'BIBLE_VERSE', active: true }

export default function TemplatesPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)
  const [draft, setDraft] = useState<Partial<Template>>(EMPTY)

  const templates = useQuery({ queryKey: ['canva/templates'], queryFn: () => templatesApi.list() })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['canva/templates'] })

  const save = useMutation({
    mutationFn: async () => (draft.id ? templatesApi.update(draft.id, draft) : templatesApi.create(draft)),
    onSuccess: () => {
      toast.success('Saved')
      setDialogOpen(false)
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => templatesApi.remove(id),
    onSuccess: () => {
      toast.success('Deleted')
      setDeleteTarget(null)
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Templates</h1>
        <Button onClick={() => { setDraft(EMPTY); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" /> New template
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Canva ID</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.data?.items.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">{template.name}</TableCell>
                <TableCell>{template.type.replace('_', ' ').toLowerCase()}</TableCell>
                <TableCell className="text-muted-foreground">{template.canvaTemplateId ?? '—'}</TableCell>
                <TableCell>{template.active ? 'Yes' : 'No'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setDraft(template); setDialogOpen(true) }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(template)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!templates.data?.items.length ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No templates yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft.id ? 'Edit template' : 'New template'}</DialogTitle>
            <DialogDescription>Define the design template for a post type.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tmplName">Name</Label>
              <Input id="tmplName" value={draft.name ?? ''} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={draft.type ?? 'BIBLE_VERSE'} onValueChange={(value) => setDraft({ ...draft, type: value as PostType })}>
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
              <Label htmlFor="tmplCanvaId">Canva template ID</Label>
              <Input id="tmplCanvaId" value={draft.canvaTemplateId ?? ''} onChange={(event) => setDraft({ ...draft, canvaTemplateId: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Active</Label>
              <Select value={draft.active ? 'true' : 'false'} onValueChange={(value) => setDraft({ ...draft, active: value === 'true' })}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !draft.name}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template</DialogTitle>
            <DialogDescription>
              Delete &quot;{deleteTarget?.name}&quot;? Templates still on posts can&apos;t be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Keep template</Button>
            <Button variant="destructive" onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}