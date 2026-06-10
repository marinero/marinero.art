'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, X, Disc3, ImageIcon, Link2 } from 'lucide-react'
import { upload } from '@/lib/upload-client'
import type { DiscographyItem, ReleaseType, PlatformLink } from '@/lib/types'
import { resolveAssetUrl } from '@/lib/storage-keys'

const RELEASE_TYPES: { value: ReleaseType; label: string }[] = [
  { value: 'album', label: 'Альбом' },
  { value: 'ep', label: 'EP' },
  { value: 'single', label: 'Сингл' },
  { value: 'live', label: 'Концертный' },
  { value: 'compilation', label: 'Сборник' },
]

type LinkForm = { platform: string; url: string; icon: string }

const emptyForm = {
  title: '',
  year: '' as string,
  release_type: 'album' as ReleaseType,
  cover_image_url: '',
  description: '',
  order_index: 0,
  is_published: true,
  links: [] as LinkForm[],
}

export default function AdminDiscographyPage() {
  const [items, setItems] = useState<DiscographyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<DiscographyItem | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [platforms, setPlatforms] = useState<PlatformLink[]>([])
  const [formData, setFormData] = useState({ ...emptyForm })

  useEffect(() => {
    fetchItems()
    fetchPlatforms()
  }, [])

  async function fetchItems() {
    const res = await fetch('/api/admin/discography')
    if (res.ok) {
      const data = await res.json()
      setItems(data.items || [])
    }
    setLoading(false)
  }

  async function fetchPlatforms() {
    const res = await fetch('/api/admin/links')
    if (res.ok) {
      const data = await res.json()
      setPlatforms(data.links || [])
    }
  }

  function resetForm() {
    setFormData({ ...emptyForm })
    setEditing(null)
    setIsCreating(false)
  }

  function startCreate() {
    resetForm()
    setIsCreating(true)
  }

  function startEdit(item: DiscographyItem) {
    setEditing(item)
    setIsCreating(false)
    setFormData({
      title: item.title,
      year: item.year ? String(item.year) : '',
      release_type: item.release_type,
      cover_image_url: item.cover_image_url ?? '',
      description: item.description ?? '',
      order_index: item.order_index,
      is_published: item.is_published,
      links: (item.links ?? []).map((l) => ({
        platform: l.platform,
        url: l.url,
        icon: l.icon ?? '',
      })),
    })
  }

  function addLink() {
    setFormData((f) => ({
      ...f,
      links: [...f.links, { platform: '', url: '', icon: '' }],
    }))
  }

  function updateLink(index: number, patch: Partial<LinkForm>) {
    setFormData((f) => ({
      ...f,
      links: f.links.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }))
  }

  function removeLink(index: number) {
    setFormData((f) => ({
      ...f,
      links: f.links.filter((_, i) => i !== index),
    }))
  }

  function onPlatformChange(index: number, platformName: string) {
    const match = platforms.find((p) => p.platform === platformName)
    updateLink(index, {
      platform: platformName,
      icon: match?.icon ?? '',
    })
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const filename = `marinero/about/disc-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${ext}`
      const blob = await upload(filename, file, { access: 'public' })
      setFormData((f) => ({ ...f, cover_image_url: blob.url }))
    } catch {
      alert('Ошибка загрузки обложки')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      title: formData.title,
      year: formData.year ? Number(formData.year) : null,
      release_type: formData.release_type,
      cover_image_url: formData.cover_image_url || null,
      description: formData.description || null,
      order_index: Number(formData.order_index) || 0,
      is_published: formData.is_published,
      links: formData.links
        .filter((l) => l.platform.trim() && l.url.trim())
        .map((l) => ({
          platform: l.platform.trim(),
          url: l.url.trim(),
          icon: l.icon || null,
        })),
    }

    if (editing) {
      await fetch(`/api/admin/discography/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/admin/discography', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    resetForm()
    fetchItems()
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить этот релиз?')) return
    await fetch(`/api/admin/discography/${id}`, { method: 'DELETE' })
    fetchItems()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Дискография</h1>
          <p className="text-muted-foreground">Альбомы и релизы группы</p>
        </div>
        <Button onClick={startCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Добавить релиз
        </Button>
      </div>

      {(isCreating || editing) && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? 'Редактировать релиз' : 'Новый релиз'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Название *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Год</label>
                  <Input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="2024"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Тип</label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={formData.release_type}
                    onChange={(e) =>
                      setFormData({ ...formData, release_type: e.target.value as ReleaseType })
                    }
                  >
                    {RELEASE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Порядок</label>
                  <Input
                    type="number"
                    value={formData.order_index}
                    onChange={(e) =>
                      setFormData({ ...formData, order_index: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Описание</label>
                  <textarea
                    className="w-full min-h-20 px-3 py-2 rounded-md border border-input bg-background text-sm"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Обложка</label>
                  {formData.cover_image_url ? (
                    <div className="relative w-32">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveAssetUrl(formData.cover_image_url) ?? formData.cover_image_url}
                        alt="cover"
                        className="w-32 h-32 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => setFormData({ ...formData, cover_image_url: '' })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50">
                      {uploading ? (
                        <span className="text-xs text-muted-foreground animate-pulse">
                          Загрузка...
                        </span>
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleCoverUpload}
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="disc_published"
                    checked={formData.is_published}
                    onChange={(e) =>
                      setFormData({ ...formData, is_published: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <label htmlFor="disc_published" className="text-sm font-medium">
                    Опубликовано
                  </label>
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Ссылки на площадки
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Где можно послушать этот релиз
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addLink} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Добавить
                  </Button>
                </div>

                {formData.links.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ссылки не добавлены.</p>
                ) : (
                  <div className="space-y-2">
                    {formData.links.map((link, index) => (
                      <div key={index} className="flex flex-col sm:flex-row gap-2">
                        <select
                          className="sm:w-48 h-10 px-3 rounded-md border border-input bg-background text-sm"
                          value={link.platform}
                          onChange={(e) => onPlatformChange(index, e.target.value)}
                        >
                          <option value="">Площадка</option>
                          {platforms.map((p) => (
                            <option key={p.id} value={p.platform}>
                              {p.platform}
                            </option>
                          ))}
                          {link.platform &&
                            !platforms.some((p) => p.platform === link.platform) && (
                              <option value={link.platform}>{link.platform}</option>
                            )}
                        </select>
                        <Input
                          type="url"
                          className="flex-1"
                          value={link.url}
                          onChange={(e) => updateLink(index, { url: e.target.value })}
                          placeholder="https://... ссылка на релиз"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-destructive shrink-0"
                          onClick={() => removeLink(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {platforms.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Сначала добавьте площадки в разделе «Платформы».
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit">{editing ? 'Сохранить' : 'Создать'}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {items.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-muted-foreground">
              Нет релизов. Добавьте первый!
            </CardContent>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} className={!item.is_published ? 'opacity-60' : ''}>
              <CardContent className="p-3 space-y-2">
                <div className="aspect-square rounded-lg overflow-hidden bg-secondary">
                  {item.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveAssetUrl(item.cover_image_url) ?? item.cover_image_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Disc3 className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm truncate">{item.title}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{item.year ?? ''}</span>
                    {(item.links?.length ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        {item.links!.length}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => startEdit(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
