'use client'

import { useEffect, useRef, useState } from 'react'
import { Link2, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SongListenPlayer } from '@/components/songs/song-listen-player'
import { uploadFileInChunks } from '@/lib/upload-client'
import { audioStreamUrl } from '@/lib/storage-keys'
import type { PlatformLink, SongLink } from '@/lib/types'

type LinkForm = { platform: string; url: string; icon: string }

function sanitizeName(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[^\w.\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'track'
  )
}

export function SongListenEditor({
  songId,
  title,
  audioUrl: initialAudioUrl,
  audioFilename: initialAudioFilename,
  links: initialLinks,
}: {
  songId: string
  title: string
  audioUrl?: string | null
  audioFilename?: string | null
  links: SongLink[]
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl ?? null)
  const [audioFilename, setAudioFilename] = useState(initialAudioFilename ?? null)
  const [links, setLinks] = useState<LinkForm[]>(
    initialLinks.map((link) => ({
      platform: link.platform,
      url: link.url,
      icon: link.icon ?? '',
    }))
  )
  const [platforms, setPlatforms] = useState<PlatformLink[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [savingLinks, setSavingLinks] = useState(false)

  useEffect(() => {
    fetch('/api/admin/links')
      .then((res) => (res.ok ? res.json() : { links: [] }))
      .then((data) => setPlatforms(data.links ?? []))
      .catch(() => {})
  }, [])

  async function patchSong(payload: Record<string, unknown>) {
    const res = await fetch(`/api/admin/songs/${songId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to save')
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file.name)) {
      toast.error('Нужен аудиофайл (mp3, wav, m4a…)')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    try {
      const pathname = `marinero/audio/songs/${songId}/${Date.now()}-${sanitizeName(file.name)}`
      const { pathname: key } = await uploadFileInChunks(pathname, file, setUploadProgress)
      const nextUrl = audioStreamUrl(key)
      await patchSong({ audio_url: nextUrl, audio_filename: file.name })
      setAudioUrl(nextUrl)
      setAudioFilename(file.name)
      toast.success('Запись загружена')
    } catch {
      toast.error('Не удалось загрузить файл')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveAudio() {
    if (!audioUrl) return
    if (!confirm('Удалить запись с сервера?')) return
    try {
      await patchSong({ audio_url: null, audio_filename: null })
      setAudioUrl(null)
      setAudioFilename(null)
      toast.success('Запись удалена')
    } catch {
      toast.error('Не удалось удалить запись')
    }
  }

  function addLink() {
    setLinks((current) => [...current, { platform: '', url: '', icon: '' }])
  }

  function updateLink(index: number, patch: Partial<LinkForm>) {
    setLinks((current) => current.map((link, i) => (i === index ? { ...link, ...patch } : link)))
  }

  function removeLink(index: number) {
    setLinks((current) => current.filter((_, i) => i !== index))
  }

  function onPlatformChange(index: number, platformName: string) {
    const match = platforms.find((platform) => platform.platform === platformName)
    updateLink(index, {
      platform: platformName,
      icon: match?.icon ?? '',
    })
  }

  async function saveLinks() {
    setSavingLinks(true)
    try {
      await patchSong({
        links: links
          .filter((link) => link.platform.trim() && link.url.trim())
          .map((link) => ({
            platform: link.platform.trim(),
            url: link.url.trim(),
            icon: link.icon || null,
          })),
      })
      toast.success('Ссылки сохранены')
    } catch {
      toast.error('Не удалось сохранить ссылки')
    } finally {
      setSavingLinks(false)
    }
  }

  const previewLinks: SongLink[] = links
    .filter((link) => link.platform.trim() && link.url.trim())
    .map((link, index) => ({
      id: `preview-${index}`,
      song_text_id: songId,
      platform: link.platform,
      url: link.url,
      icon: link.icon || null,
      order_index: index,
      created_at: '',
    }))

  return (
    <div className="space-y-4">
      <SongListenPlayer title={title} audioUrl={audioUrl} links={previewLinks} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Публичное прослушивание</CardTitle>
          <p className="text-sm text-muted-foreground">
            Свой плеер с файлом на Amazon и иконки площадок, для которых указан URL.
            Доступно всем посетителям опубликованной песни.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Запись</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
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
                {audioUrl ? 'Заменить файл' : 'Загрузить файл'}
              </Button>
              {audioUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2 text-destructive"
                  disabled={uploading}
                  onClick={handleRemoveAudio}
                >
                  <Trash2 className="h-4 w-4" />
                  Удалить
                </Button>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac"
                className="hidden"
                onChange={(event) => handleUpload(event.target.files?.[0])}
              />
            </div>
            {audioFilename ? (
              <p className="truncate text-xs text-muted-foreground">{audioFilename}</p>
            ) : (
              <p className="text-xs text-muted-foreground">MP3, WAV, M4A и другие аудиоформаты.</p>
            )}
            {uploading ? (
              <p className="text-xs text-muted-foreground">Загрузка… {uploadProgress}%</p>
            ) : null}
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Link2 className="h-4 w-4" />
                  Ссылки на площадки
                </p>
                <p className="text-xs text-muted-foreground">
                  Иконка появится под плеером, только если указан URL
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addLink}>
                <Plus className="h-4 w-4" />
                Добавить
              </Button>
            </div>

            {links.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ссылки не добавлены.</p>
            ) : (
              <div className="space-y-2">
                {links.map((link, index) => (
                  <div key={index} className="flex flex-col gap-2 sm:flex-row">
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-48"
                      value={link.platform}
                      onChange={(event) => onPlatformChange(index, event.target.value)}
                    >
                      <option value="">Площадка</option>
                      {platforms.map((platform) => (
                        <option key={platform.id} value={platform.platform}>
                          {platform.platform}
                        </option>
                      ))}
                      {link.platform &&
                        !platforms.some((platform) => platform.platform === link.platform) && (
                          <option value={link.platform}>{link.platform}</option>
                        )}
                    </select>
                    <Input
                      type="url"
                      className="flex-1"
                      value={link.url}
                      onChange={(event) => updateLink(index, { url: event.target.value })}
                      placeholder="https://… ссылка на трек"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0 text-destructive"
                      onClick={() => removeLink(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {platforms.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Сначала добавьте площадки в разделе «Платформы».
              </p>
            ) : null}

            <Button type="button" onClick={saveLinks} disabled={savingLinks} className="gap-2">
              {savingLinks ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Сохранить ссылки
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
