'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileMusic,
  Upload,
  Trash2,
  ExternalLink,
  Download,
  Loader2,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { uploadToStorage } from '@/lib/upload-client'
import type { SongDocument, SongDocumentKind } from '@/lib/types'

const KIND_LABELS: Record<SongDocumentKind, string> = {
  sheet: 'Ноты',
  tab: 'Табы',
  sheet_tab: 'Ноты + Табы',
  other: 'Другое',
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  const units = ['Б', 'КБ', 'МБ', 'ГБ']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

function sanitizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    || 'file'
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

interface SongDocumentsManagerProps {
  songId: string
}

export function SongDocumentsManager({ songId }: SongDocumentsManagerProps) {
  const [documents, setDocuments] = useState<SongDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = useCallback(async () => {
    const res = await fetch(`/api/admin/songs/${songId}/documents`)
    if (res.ok) {
      const data = await res.json()
      setDocuments(data.documents ?? [])
    }
    setLoading(false)
  }, [songId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    setUploading(true)
    let uploaded = 0

    for (const file of Array.from(files)) {
      try {
        const safe = sanitizeName(file.name)
        const pathname = `marinero/documents/${songId}/${Date.now()}-${safe}`
        const { url } = await uploadToStorage(pathname, file, { access: 'private' })

        const res = await fetch(`/api/admin/songs/${songId}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: stripExt(file.name),
            kind: 'sheet',
            file_url: url,
            filename: file.name,
            content_type: file.type || null,
            size_bytes: file.size,
            is_published: false,
          }),
        })

        if (!res.ok) throw new Error('meta failed')
        uploaded++
      } catch {
        toast.error(`Не удалось загрузить «${file.name}»`)
      }
    }

    if (uploaded > 0) {
      toast.success(uploaded === 1 ? 'Документ загружен' : `Загружено документов: ${uploaded}`)
      await fetchDocuments()
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function patchDocument(id: string, patch: Partial<SongDocument>) {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d))
    )

    const res = await fetch(`/api/admin/songs/${songId}/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })

    if (!res.ok) {
      toast.error('Ошибка сохранения')
      fetchDocuments()
    }
  }

  async function deleteDocument(id: string) {
    if (!confirm('Удалить документ?')) return

    const res = await fetch(`/api/admin/songs/${songId}/documents/${id}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      toast.success('Документ удалён')
      setDocuments((prev) => prev.filter((d) => d.id !== id))
    } else {
      toast.error('Ошибка удаления')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileMusic className="h-5 w-5" />
            Документы (ноты и табы)
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Загрузить
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,image/*,.gp,.gp3,.gp4,.gp5,.gpx,.gp7,.txt,.musicxml,.mxl,.xml"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          PDF, изображения, табы (Guitar Pro), MusicXML. Каждый документ можно
          опубликовать отдельно.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Загрузка...</p>
        ) : documents.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Документов пока нет</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <Input
                  defaultValue={doc.title}
                  className="h-8"
                  onBlur={(e) => {
                    const value = e.target.value.trim()
                    if (value && value !== doc.title) {
                      patchDocument(doc.id, { title: value })
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground truncate">
                  {doc.filename}
                  {doc.size_bytes ? ` · ${formatBytes(doc.size_bytes)}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={doc.kind}
                  onValueChange={(value) =>
                    patchDocument(doc.id, { kind: value as SongDocumentKind })
                  }
                >
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(KIND_LABELS) as SongDocumentKind[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <Switch
                    checked={doc.is_published}
                    onCheckedChange={(checked) =>
                      patchDocument(doc.id, { is_published: checked })
                    }
                  />
                  {doc.is_published ? 'Опубликован' : 'Скрыт'}
                </label>

                <a href={`/api/documents/${doc.id}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Открыть">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
                <a href={`/api/documents/${doc.id}?download=1`}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Скачать">
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  title="Удалить"
                  onClick={() => deleteDocument(doc.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
