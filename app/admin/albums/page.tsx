'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Images, Calendar as CalendarIcon, Eye, EyeOff, Upload, X, ImageIcon } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { upload } from '@/lib/upload-client'
import { resolveAssetUrl } from '@/lib/storage-keys'
import type { Album } from '@/lib/types'

export default function AdminAlbumsPage() {
  const searchParams = useSearchParams()
  const [albums, setAlbums] = useState<(Album & { photo_count: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null)
  const [isCreating, setIsCreating] = useState(searchParams.get('create') === 'true')
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cover_image_url: '',
    event_date: undefined as Date | undefined,
    is_published: false
  })

  function generateSlug(title: string, date?: Date): string {
    const map: Record<string, string> = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
      'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    }
    const transliterated = title.toLowerCase().split('').map(ch => map[ch] ?? ch).join('')
    const slug = transliterated
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd')
      return `${dateStr}-${slug}`
    }
    return slug
  }

  useEffect(() => {
    fetchAlbums()
  }, [])

  async function fetchAlbums() {
    const response = await fetch('/api/admin/albums')
    if (!response.ok) {
      setLoading(false)
      return
    }
    const data = await response.json()
    setAlbums(data.albums || [])
    setLoading(false)
  }

  function resetForm() {
    setFormData({
      title: '',
      description: '',
      cover_image_url: '',
      event_date: undefined,
      is_published: false
    })
    setEditingAlbum(null)
    setIsCreating(false)
  }

  function startEdit(album: Album) {
    setEditingAlbum(album)
    setIsCreating(false)
    setFormData({
      title: album.title,
      description: album.description || '',
      cover_image_url: album.cover_image_url || '',
      event_date: album.event_date ? new Date(album.event_date) : undefined,
      is_published: album.is_published
    })
  }

  function startCreate() {
    resetForm()
    setIsCreating(true)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение')
      return
    }

    setUploading(true)
    try {
      const timestamp = Date.now()
      const extension = file.name.split('.').pop()
      const filename = `marinero/${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`

      const blob = await upload(filename, file, {
        access: 'private',
      })

      setFormData({ ...formData, cover_image_url: blob.url })
    } catch (error) {
      console.error('Upload error:', error)
      alert('Ошибка загрузки изображения')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const albumData = {
      title: formData.title,
      description: formData.description || null,
      cover_image_url: formData.cover_image_url || null,
      event_date: formData.event_date ? format(formData.event_date, 'yyyy-MM-dd') : null,
      is_published: formData.is_published,
      slug: editingAlbum?.slug || generateSlug(formData.title, formData.event_date),
    }

    if (editingAlbum) {
      await fetch(`/api/admin/albums/${editingAlbum.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(albumData),
      })
    } else {
      await fetch('/api/admin/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(albumData),
      })
    }

    resetForm()
    fetchAlbums()
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить этот альбом и все его фото?')) return
    
    await fetch(`/api/admin/albums/${id}`, { method: 'DELETE' })
    fetchAlbums()
  }

  async function togglePublished(album: Album) {
    await fetch(`/api/admin/albums/${album.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !album.is_published }),
    })
    fetchAlbums()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Альбомы</h1>
          <p className="text-muted-foreground">Управление фотоальбомами</p>
        </div>
        <Button onClick={startCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Создать альбом
        </Button>
      </div>

      {(isCreating || editingAlbum) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingAlbum ? 'Редактировать альбом' : 'Новый альбом'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Название *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Название альбома"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Дата события</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${!formData.event_date && 'text-muted-foreground'}`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.event_date ? format(formData.event_date, 'd MMMM yyyy', { locale: ru }) : 'Выберите дату'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.event_date}
                        onSelect={(date) => setFormData({ ...formData, event_date: date })}
                        initialFocus
                        locale={ru}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Описание</label>
                  <textarea
                    className="w-full min-h-24 px-3 py-2 rounded-md border border-input bg-background text-sm"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Описание альбома"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Обложка</label>
                  {formData.cover_image_url ? (
                    <div className="relative w-full max-w-xs">
                      <img
                        src={resolveAssetUrl(formData.cover_image_url) ?? formData.cover_image_url}
                        alt="Preview"
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => setFormData({ ...formData, cover_image_url: '' })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {uploading ? (
                          <div className="animate-pulse text-muted-foreground">Загрузка...</div>
                        ) : (
                          <>
                            <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Нажмите для загрузки
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                              PNG, JPG до 50MB
                            </p>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_published"
                    checked={formData.is_published}
                    onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="is_published" className="text-sm font-medium">
                    Опубликован
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">
                  {editingAlbum ? 'Сохранить' : 'Создать'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {albums.length === 0 ? (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="py-12 text-center text-muted-foreground">
              Нет альбомов. Создайте первый!
            </CardContent>
          </Card>
        ) : (
          albums.map((album) => (
            <Card key={album.id} className={!album.is_published ? 'opacity-60' : ''}>
              <div className="relative aspect-video bg-muted">
                {album.cover_image_url ? (
                  <Image
                    src={resolveAssetUrl(album.cover_image_url) ?? album.cover_image_url}
                    alt={album.title}
                    fill
                    className="object-cover rounded-t-lg"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Images className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => togglePublished(album)}
                  >
                    {album.is_published ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold line-clamp-1">{album.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {album.event_date && (
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {format(new Date(album.event_date), 'd MMM yyyy', { locale: ru })}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Images className="h-3 w-3" />
                          {album.photo_count} фото
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Link href={`/admin/albums/${album.slug}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1">
                        <Images className="h-4 w-4" />
                        Фото
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEdit(album)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(album.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
