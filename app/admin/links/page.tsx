'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, GripVertical, ExternalLink } from 'lucide-react'
import type { PlatformLink } from '@/lib/types'

const PLATFORM_ICONS: Record<string, string> = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  youtube: 'YouTube',
  youtube_music: 'YouTube Music',
  vk: 'VK Музыка',
  yandex: 'Яндекс Музыка',
  soundcloud: 'SoundCloud',
  bandcamp: 'Bandcamp',
  deezer: 'Deezer',
  tidal: 'Tidal'
}

export default function AdminLinksPage() {
  const searchParams = useSearchParams()
  const [links, setLinks] = useState<PlatformLink[]>([])
  const [loading, setLoading] = useState(true)
  const [editingLink, setEditingLink] = useState<PlatformLink | null>(null)
  const [isCreating, setIsCreating] = useState(searchParams.get('create') === 'true')
  const [formData, setFormData] = useState({
    platform: '',
    url: '',
    icon: '',
    order_index: 0,
    is_active: true
  })

  useEffect(() => {
    fetchLinks()
  }, [])

  async function fetchLinks() {
    const response = await fetch('/api/admin/links')
    if (!response.ok) {
      setLoading(false)
      return
    }
    const data = await response.json()
    setLinks(data.links || [])
    setLoading(false)
  }

  function resetForm() {
    setFormData({
      platform: '',
      url: '',
      icon: '',
      order_index: links.length,
      is_active: true
    })
    setEditingLink(null)
    setIsCreating(false)
  }

  function startEdit(link: PlatformLink) {
    setEditingLink(link)
    setIsCreating(false)
    setFormData({
      platform: link.platform,
      url: link.url,
      icon: link.icon || '',
      order_index: link.order_index,
      is_active: link.is_active
    })
  }

  function startCreate() {
    resetForm()
    setFormData(prev => ({ ...prev, order_index: links.length }))
    setIsCreating(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (editingLink) {
      await fetch(`/api/admin/links/${editingLink.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
    } else {
      await fetch('/api/admin/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
    }

    resetForm()
    fetchLinks()
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить эту ссылку?')) return
    
    await fetch(`/api/admin/links/${id}`, { method: 'DELETE' })
    fetchLinks()
  }

  async function toggleActive(link: PlatformLink) {
    await fetch(`/api/admin/links/${link.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !link.is_active }),
    })
    fetchLinks()
  }

  async function moveLink(link: PlatformLink, direction: 'up' | 'down') {
    const currentIndex = links.findIndex(l => l.id === link.id)
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    
    if (newIndex < 0 || newIndex >= links.length) return
    
    const otherLink = links[newIndex]
    
    await Promise.all([
      fetch(`/api/admin/links/${link.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_index: newIndex }),
      }),
      fetch(`/api/admin/links/${otherLink.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_index: currentIndex }),
      }),
    ])
    
    fetchLinks()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Платформы</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Ссылки на музыкальные площадки</p>
        </div>
        <Button onClick={startCreate} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Добавить ссылку
        </Button>
      </div>

      {(isCreating || editingLink) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingLink ? 'Редактировать ссылку' : 'Новая ссылка'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Платформа *</label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    required
                  >
                    <option value="">Выберите платформу</option>
                    {Object.entries(PLATFORM_ICONS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                    <option value="other">Другое</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">URL *</label>
                  <Input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://..."
                    required
                  />
                </div>
                {formData.platform === 'other' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Название</label>
                    <Input
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      placeholder="Название платформы"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium">
                    Активна
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">
                  {editingLink ? 'Сохранить' : 'Создать'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {links.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Нет ссылок на платформы. Добавьте первую!
            </CardContent>
          </Card>
        ) : (
          links.map((link, index) => (
            <Card key={link.id} className={!link.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveLink(link, 'up')}
                      disabled={index === 0}
                    >
                      <GripVertical className="h-4 w-4 rotate-90" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveLink(link, 'down')}
                      disabled={index === links.length - 1}
                    >
                      <GripVertical className="h-4 w-4 -rotate-90" />
                    </Button>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm sm:text-base">
                        {PLATFORM_ICONS[link.platform] || link.icon || link.platform}
                      </span>
                      {!link.is_active && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">Скрыта</span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground break-all">
                      {link.url}
                    </p>
                    
                    {/* Actions - mobile: below content */}
                    <div className="flex items-center gap-1 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActive(link)}
                        className="text-xs h-7 px-2"
                      >
                        {link.is_active ? 'Скрыть' : 'Показать'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(link)}
                        className="h-7 w-7"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(link.id)}
                        className="text-destructive h-7 w-7"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto"
                      >
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    </div>
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
