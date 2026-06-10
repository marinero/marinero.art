'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Upload, Trash2, Star, Loader2 } from 'lucide-react'
import { upload } from '@/lib/upload-client'
import type { Album, Photo } from '@/lib/types'
import { resolveAssetUrl } from '@/lib/storage-keys'

export default function AdminAlbumPhotosPage() {
  const params = useParams()
  const router = useRouter()
  const albumSlug = params.slug as string

  const [album, setAlbum] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)

  const fetchData = useCallback(async () => {
    const response = await fetch(`/api/admin/albums/${encodeURIComponent(albumSlug)}`)
    if (!response.ok) {
      setLoading(false)
      return
    }
    const data = await response.json()
    if (data.album) {
      setAlbum(data.album)
      setPhotos(data.photos || [])
    }
    setLoading(false)
  }, [albumSlug])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleUpload() {
    if (!selectedFiles || selectedFiles.length === 0 || !album) return

    setUploading(true)

    try {
      const uploadPromises = Array.from(selectedFiles).map(async (file, index) => {
        const timestamp = Date.now()
        const extension = file.name.split('.').pop()
        const filename = `marinero/gallery/${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`

        const blob = await upload(filename, file, {
          access: 'private',
        })

        const url = blob.url

        await fetch(`/api/admin/albums/${album.id}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            order_index: photos.length + index,
          }),
        })
      })

      await Promise.all(uploadPromises)
      setSelectedFiles(null)
      
      // Reset file input
      const fileInput = document.getElementById('photo-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      
      fetchData()
    } catch (error) {
      console.error('Upload error:', error)
      alert('Ошибка при загрузке файлов')
    } finally {
      setUploading(false)
    }
  }

  async function handleAddByUrl(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!album) return
    const formData = new FormData(e.currentTarget)
    const url = formData.get('url') as string

    if (!url) return

    await fetch(`/api/admin/albums/${album.id}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, order_index: photos.length }),
    })

    e.currentTarget.reset()
    fetchData()
  }

  async function handleDelete(photoId: string) {
    if (!confirm('Удалить это фото?')) return

    await fetch(`/api/admin/albums/${album!.id}/photos/${photoId}`, {
      method: 'DELETE',
    })
    fetchData()
  }

  async function setAsCover(photoUrl: string) {
    if (!album) return
    await fetch(`/api/admin/albums/${album.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cover_image_url: photoUrl }),
    })
    fetchData()
  }

  async function updateCaption(photoId: string, caption: string) {
    await fetch(`/api/admin/albums/${album!.id}/photos/${photoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption }),
    })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>
  }

  if (!album) {
    return <div className="text-center py-12">Альбом не найден</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/admin/albums')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{album.title}</h1>
          <p className="text-muted-foreground">{photos.length} фото</p>
        </div>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Добавить фото</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Загрузить файлы</label>
            <div className="flex gap-2">
              <Input
                id="photo-upload"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setSelectedFiles(e.target.files)}
                className="flex-1"
              />
              <Button
                onClick={handleUpload}
                disabled={!selectedFiles || uploading}
                className="gap-2"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Загрузить
              </Button>
            </div>
          </div>

          {/* URL Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Или добавить по URL</label>
            <form onSubmit={handleAddByUrl} className="flex gap-2">
              <Input
                name="url"
                type="url"
                placeholder="https://..."
                className="flex-1"
              />
              <Button type="submit">Добавить</Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Photos Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <Card key={photo.id} className="group overflow-hidden">
            <div className="relative aspect-square">
              <Image
                src={resolveAssetUrl(photo.url) ?? photo.url}
                alt={photo.caption || 'Photo'}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setAsCover(photo.url)}
                  title="Сделать обложкой"
                >
                  <Star className={`h-4 w-4 ${album.cover_image_url === photo.url ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDelete(photo.id)}
                  title="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {album.cover_image_url === photo.url && (
                <div className="absolute top-2 left-2 bg-yellow-500 text-black text-xs px-2 py-0.5 rounded">
                  Обложка
                </div>
              )}
            </div>
            <CardContent className="p-2">
              <Input
                defaultValue={photo.caption || ''}
                placeholder="Подпись..."
                className="text-xs h-8"
                onBlur={(e) => updateCaption(photo.id, e.target.value)}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {photos.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            В этом альбоме пока нет фото. Загрузите первые!
          </CardContent>
        </Card>
      )}
    </div>
  )
}
