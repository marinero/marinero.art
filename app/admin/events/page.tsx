'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Calendar as CalendarIcon, MapPin, ExternalLink, Clock, Upload, X, ImageIcon, DoorOpen, Navigation, ShieldCheck, Phone, Images, Video } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { upload } from '@/lib/upload-client'
import type { Event, Album, Video as VideoType } from '@/lib/types'
import type { SetlistSong } from '@/lib/song-tech'
import { ConcertSetlistEditor } from '@/components/concerts/concert-setlist-editor'
import { resolveAssetUrl } from '@/lib/storage-keys'
import { Checkbox } from '@/components/ui/checkbox'

export default function AdminEventsPage() {
  const searchParams = useSearchParams()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [isCreating, setIsCreating] = useState(searchParams.get('create') === 'true')
  const [uploading, setUploading] = useState(false)
  const [allAlbums, setAllAlbums] = useState<Album[]>([])
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<string[]>([])
  const [allVideos, setAllVideos] = useState<VideoType[]>([])
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([])
  const [allSongs, setAllSongs] = useState<SetlistSong[]>([])
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    venue: '',
    city: '',
    event_date: undefined as Date | undefined,
    event_time: '19:00',
    doors_time: '',
    venue_address: '',
    google_maps_url: '',
    how_to_get: '',
    entry_rules: '',
    contacts: '',
    ticket_url: '',
    image_url: '',
    is_published: true
  })

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    const response = await fetch('/api/admin/events')
    if (!response.ok) {
      setLoading(false)
      return
    }

    const data = await response.json()
    setEvents(data.events || [])
    setAllAlbums(data.albums || [])
    setAllVideos(data.videos || [])
    setAllSongs(data.songs || [])
    setLoading(false)
  }

  async function fetchEventAlbums(eventId: string) {
    const response = await fetch(`/api/admin/events/${eventId}`)
    if (!response.ok) return

    const data = await response.json()
    setSelectedAlbumIds(data.albumIds || [])
    setSelectedVideoIds(data.videoIds || [])
    setSelectedSongIds(data.songIds || [])
  }

  function resetForm() {
    setFormData({
      title: '',
      description: '',
      venue: '',
      city: '',
      event_date: undefined,
      event_time: '19:00',
      doors_time: '',
      venue_address: '',
      google_maps_url: '',
      how_to_get: '',
      entry_rules: '',
      contacts: '',
      ticket_url: '',
      image_url: '',
      is_published: true
    })
    setEditingEvent(null)
    setIsCreating(false)
    setSelectedAlbumIds([])
    setSelectedVideoIds([])
    setSelectedSongIds([])
  }

  function startEdit(event: Event) {
    setEditingEvent(event)
    setIsCreating(false)
    fetchEventAlbums(event.id)
    const eventDate = event.event_date ? new Date(event.event_date) : undefined
    setFormData({
      title: event.title,
      description: event.description || '',
      venue: event.venue || '',
      city: event.city || '',
      event_date: eventDate,
      event_time: eventDate ? format(eventDate, 'HH:mm') : '19:00',
      doors_time: event.doors_time || '',
      venue_address: event.venue_address || '',
      google_maps_url: event.google_maps_url || '',
      how_to_get: event.how_to_get || '',
      entry_rules: event.entry_rules || '',
      contacts: event.contacts || '',
      ticket_url: event.ticket_url || '',
      image_url: event.image_url || '',
      is_published: event.is_published
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

      setFormData({ ...formData, image_url: blob.url })
    } catch (error) {
      console.error('Upload error:', error)
      alert('Ошибка загрузки изображения')
    } finally {
      setUploading(false)
    }
  }

  function transliterate(text: string): string {
    const map: Record<string, string> = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
      'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    }
    return text.split('').map(ch => map[ch] ?? ch).join('')
  }

  function generateSlug(title: string, date: Date): string {
    const dateStr = format(date, 'yyyy-MM-dd')
    const slug = transliterate(title.toLowerCase())
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    return `${dateStr}-${slug}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!formData.event_date) return
    
    // Combine date and time
    const [hours, minutes] = formData.event_time.split(':').map(Number)
    const eventDateTime = new Date(formData.event_date)
    eventDateTime.setHours(hours, minutes, 0, 0)
    
    const slug = editingEvent?.slug || generateSlug(formData.title, formData.event_date)
    
    const eventData = {
      title: formData.title,
      slug,
      description: formData.description || null,
      venue: formData.venue || null,
      city: formData.city || null,
      event_date: eventDateTime.toISOString(),
      doors_time: formData.doors_time || null,
      venue_address: formData.venue_address || null,
      google_maps_url: formData.google_maps_url || null,
      how_to_get: formData.how_to_get || null,
      entry_rules: formData.entry_rules || null,
      contacts: formData.contacts || null,
      ticket_url: formData.ticket_url || null,
      image_url: formData.image_url || null,
      is_published: formData.is_published,
    }

    const payload = {
      ...eventData,
      albumIds: selectedAlbumIds,
      videoIds: selectedVideoIds,
      songIds: selectedSongIds,
    }

    if (editingEvent) {
      await fetch(`/api/admin/events/${editingEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    resetForm()
    fetchEvents()
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить это событие?')) return

    await fetch(`/api/admin/events/${id}`, { method: 'DELETE' })
    fetchEvents()
  }

  async function togglePublished(event: Event) {
    await fetch(`/api/admin/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !event.is_published }),
    })
    fetchEvents()
  }

  function toggleAlbumSelection(albumId: string) {
    setSelectedAlbumIds(prev => 
      prev.includes(albumId)
        ? prev.filter(id => id !== albumId)
        : [...prev, albumId]
    )
  }

  function toggleVideoSelection(videoId: string) {
    setSelectedVideoIds(prev => 
      prev.includes(videoId)
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">События</h1>
          <p className="text-muted-foreground">Управление концертами и мероприятиями</p>
        </div>
        <Button onClick={startCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Добавить событие
        </Button>
      </div>

      {(isCreating || editingEvent) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingEvent ? 'Редактировать событие' : 'Новое событие'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Название *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Название события"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Дата *</label>
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
                <div className="space-y-2">
                  <label className="text-sm font-medium">Время *</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={formData.event_time}
                      onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Площадка</label>
                  <Input
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    placeholder="Название площадки"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Город</label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Город"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Описание</label>
                  <textarea
                    className="w-full min-h-24 px-3 py-2 rounded-md border border-input bg-background text-sm"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Описание события"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ссылка на билеты</label>
                  <Input
                    type="url"
                    value={formData.ticket_url}
                    onChange={(e) => setFormData({ ...formData, ticket_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Время открытия дверей</label>
                  <Input
                    type="time"
                    value={formData.doors_time}
                    onChange={(e) => setFormData({ ...formData, doors_time: e.target.value })}
                    placeholder="18:00"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Адрес площадки</label>
                  <Input
                    value={formData.venue_address}
                    onChange={(e) => setFormData({ ...formData, venue_address: e.target.value })}
                    placeholder="Полный адрес для карты"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Как добраться</label>
                  <textarea
                    className="w-full min-h-20 px-3 py-2 rounded-md border border-input bg-background text-sm"
                    value={formData.how_to_get}
                    onChange={(e) => setFormData({ ...formData, how_to_get: e.target.value })}
                    placeholder="Метро, автобусы, ориентиры..."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Правила входа и возрастные ограничения</label>
                  <textarea
                    className="w-full min-h-20 px-3 py-2 rounded-md border border-input bg-background text-sm"
                    value={formData.entry_rules}
                    onChange={(e) => setFormData({ ...formData, entry_rules: e.target.value })}
                    placeholder="18+, фейсконтроль, dress code..."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Контакты</label>
                  <textarea
                    className="w-full min-h-20 px-3 py-2 rounded-md border border-input bg-background text-sm"
                    value={formData.contacts}
                    onChange={(e) => setFormData({ ...formData, contacts: e.target.value })}
                    placeholder="Телефон, email, соцсети организатора..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Изображение</label>
                  {formData.image_url ? (
                    <div className="relative w-full max-w-xs">
                      <img 
                        src={resolveAssetUrl(formData.image_url) ?? formData.image_url} 
                        alt="Preview" 
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => setFormData({ ...formData, image_url: '' })}
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
                    Опубликовано
                  </label>
                </div>

                {/* Photo Albums Selection */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Images className="h-4 w-4" />
                    Фотоальбомы
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Выберите альбомы, которые будут показаны на странице события
                  </p>
                  {allAlbums.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Нет доступных альбомов</p>
                  ) : (
                    <div className="grid gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                      {allAlbums.map((album) => (
                        <label
                          key={album.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-secondary/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedAlbumIds.includes(album.id)}
                            onCheckedChange={() => toggleAlbumSelection(album.id)}
                          />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {album.cover_image_url ? (
                              <img
                                src={resolveAssetUrl(album.cover_image_url) ?? album.cover_image_url}
                                alt={album.title}
                                className="w-10 h-10 object-cover rounded"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                                <Images className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{album.title}</p>
                              {album.event_date && (
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(album.event_date), 'd MMM yyyy', { locale: ru })}
                                </p>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedAlbumIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Выбрано альбомов: {selectedAlbumIds.length}
                    </p>
                  )}
                </div>

                {/* Videos Selection */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Видеозаписи
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Выберите видео, которые будут показаны на странице события
                  </p>
                  {allVideos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Нет доступных видео</p>
                  ) : (
                    <div className="grid gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                      {allVideos.map((video) => (
                        <label
                          key={video.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-secondary/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedVideoIds.includes(video.id)}
                            onCheckedChange={() => toggleVideoSelection(video.id)}
                          />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {video.thumbnail_url ? (
                              <img
                                src={resolveAssetUrl(video.thumbnail_url) ?? video.thumbnail_url}
                                alt={video.title}
                                className="w-16 h-10 object-cover rounded"
                              />
                            ) : (
                              <div className="w-16 h-10 bg-muted rounded flex items-center justify-center">
                                <Video className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{video.title}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {video.video_type}
                              </p>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedVideoIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Выбрано видео: {selectedVideoIds.length}
                    </p>
                  )}
                </div>
              </div>
              <ConcertSetlistEditor
                allSongs={allSongs}
                selectedIds={selectedSongIds}
                onSelectedIdsChange={setSelectedSongIds}
                onCatalogChange={setAllSongs}
              />
              <div className="flex gap-2">
                <Button type="submit">
                  {editingEvent ? 'Сохранить' : 'Создать'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {events.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Нет событий. Создайте первое!
            </CardContent>
          </Card>
        ) : (
          events.map((event) => (
            <Card key={event.id} className={!event.is_published ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{event.title}</h3>
                      {!event.is_published && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">Черновик</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4" />
                        {format(new Date(event.event_date), 'd MMMM yyyy, HH:mm', { locale: ru })}
                      </span>
                      {event.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {event.venue}{event.city && `, ${event.city}`}
                        </span>
                      )}
                      {event.ticket_url && (
                        <a
                          href={event.ticket_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Билеты
                        </a>
                      )}
                    </div>
                    {event.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {event.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePublished(event)}
                    >
                      {event.is_published ? 'Скрыть' : 'Опубликовать'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEdit(event)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(event.id)}
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
