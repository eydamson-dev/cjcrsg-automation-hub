'use client'

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trash2, Upload } from 'lucide-react'
import { assetsApi } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function MediaPage() {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const assets = useQuery({
    queryKey: ['assets'],
    queryFn: () => assetsApi.list({ limit: 100 }),
  })

  const upload = useMutation({
    mutationFn: (file: File) => assetsApi.upload(file),
    onSuccess: () => {
      toast.success('Uploaded')
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => assetsApi.remove(id),
    onSuccess: () => {
      toast.success('Deleted')
      setSelected(null)
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const selectedAsset = assets.data?.items.find((asset) => asset.id === selected)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Media library</h1>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) upload.mutate(file)
            event.target.value = ''
          }}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
          <Upload className="h-4 w-4" /> {upload.isPending ? 'Uploading…' : 'Upload'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {assets.data?.items.map((asset) => (
              <button
                key={asset.id}
                onClick={() => setSelected(asset.id)}
                className="overflow-hidden rounded-md border text-left transition-opacity hover:opacity-80"
              >
                <img src={assetsApi.contentUrl(asset.id)} alt={asset.filename} className="aspect-square w-full object-cover" />
              </button>
            ))}
            {!assets.data?.items.length ? (
              <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No media uploaded.</p>
            ) : null}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Asset details</CardTitle>
            <CardDescription>Metadata for the selected file</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedAsset ? (
              <div className="space-y-3 text-sm">
                <img src={assetsApi.contentUrl(selectedAsset.id)} alt="" className="aspect-video w-full rounded-md border object-cover" />
                <div>
                  <p className="font-medium">{selectedAsset.filename}</p>
                  <p className="text-muted-foreground">{selectedAsset.mimeType}</p>
                </div>
                <p>{(selectedAsset.sizeBytes / 1024).toFixed(1)} KB</p>
                <p className="break-all font-mono text-xs text-muted-foreground">sha256: {selectedAsset.sha256}</p>
                <p>Uploaded {formatDateTime(selectedAsset.createdAt)}</p>
                <Button variant="destructive" className="w-full" onClick={() => remove.mutate(selectedAsset.id)} disabled={remove.isPending}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select an asset to inspect it.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}