'use client'

// YouTube IFrame API types
declare global {
  interface Window {
    YT: {
      Player: new (element: HTMLElement | string, options: {
        videoId: string
        playerVars?: Record<string, unknown>
        events?: {
          onReady?: () => void
          onStateChange?: (event: { data: number }) => void
        }
      }) => YT.Player
    }
    onYouTubeIframeAPIReady: () => void
  }
  namespace YT {
    interface Player {
      getCurrentTime(): number
      seekTo(seconds: number, allowSeekAhead?: boolean): void
      playVideo(): void
      pauseVideo(): void
      destroy(): void
    }
  }
}

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Video, ExternalLink, X, Play, Loader2, Clock } from 'lucide-react'
import type { Video as VideoType } from '@/lib/types'
import { resolveAssetUrl } from '@/lib/storage-keys'

// Transliteration map for Cyrillic to Latin
const translitMap: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
  'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
  'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
  'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
}

function transliterate(text: string): string {
  return text.toLowerCase().split('').map(char => translitMap[char] || char).join('')
}

// Generate slug from title
function generateSlug(title: string): string {
  return transliterate(title)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// Extract video ID from various platform URLs
function extractVideoInfo(url: string): { type: VideoType['video_type']; id: string } | null {
  // YouTube (watch, embed, shorts, live, youtu.be)
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] }
  
  // VK Video
  const vkMatch = url.match(/vk\.com\/video(-?\d+_\d+)/)
  if (vkMatch) return { type: 'vk', id: vkMatch[1] }
  
  // Rutube
  const rutubeMatch = url.match(/rutube\.ru\/video\/([a-zA-Z0-9]+)/)
  if (rutubeMatch) return { type: 'rutube', id: rutubeMatch[1] }
  
  return { type: 'custom', id: url }
}

// Generate thumbnail URL based on video type
function getThumbnailUrl(videoType: VideoType['video_type'], videoUrl: string): string | null {
  const info = extractVideoInfo(videoUrl)
  if (!info) return null
  
  switch (videoType) {
    case 'youtube':
      return `https://img.youtube.com/vi/${info.id}/hqdefault.jpg`
    default:
      return null
  }
}

// Generate embed URL based on video type
function getEmbedUrl(videoType: VideoType['video_type'], videoUrl: string, enableApi = false): string | null {
  const info = extractVideoInfo(videoUrl)
  if (!info) return null
  
  switch (videoType) {
    case 'youtube':
      return `https://www.youtube.com/embed/${info.id}${enableApi ? '?enablejsapi=1&origin=' + encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '') : ''}`
    case 'vk':
      return `https://vk.com/video_ext.php?oid=${info.id.split('_')[0]}&id=${info.id.split('_')[1]}`
    case 'rutube':
      return `https://rutube.ru/play/embed/${info.id}`
    default:
      return videoUrl
  }
}

interface SongOption {
  id: string
  title: string
  slug: string
}

const NO_SONG = '__none__'

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<VideoType[]>([])
  const [songs, setSongs] = useState<SongOption[]>([])
  const [loading, setLoading] = useState(true)
  const [editingVideo, setEditingVideo] = useState<VideoType | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    video_url: '',
    video_type: 'youtube' as VideoType['video_type'],
    thumbnail_url: '',
    is_published: true,
    song_text_id: ''
  })
  const [fetchingTitle, setFetchingTitle] = useState(false)
  const [timestampHours, setTimestampHours] = useState(0)
  const [timestampMinutes, setTimestampMinutes] = useState(0)
  const [timestampSeconds, setTimestampSeconds] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const ytPlayerRef = useRef<YT.Player | null>(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)

  // Format timestamp for insertion (always HH:MM:SS format)
  function formatTimestamp(hours: number, minutes: number, seconds: number): string {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // Insert timestamp at cursor position in description textarea
  function insertTimestamp() {
    const timestamp = formatTimestamp(timestampHours, timestampMinutes, timestampSeconds)
    const textarea = textareaRef.current
    if (!textarea) {
      setFormData({ ...formData, description: formData.description + timestamp + ' ' })
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = formData.description
    const newText = text.substring(0, start) + timestamp + ' ' + text.substring(end)
    setFormData({ ...formData, description: newText })
    
    // Set cursor position after the timestamp
    setTimeout(() => {
      textarea.focus()
      textarea.selectionStart = textarea.selectionEnd = start + timestamp.length + 1
    }, 0)
  }

  // Load YouTube IFrame API script
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Check if API is already loaded
    if (window.YT && window.YT.Player) return
    
    // Load the API script
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
  }, [])

  // Initialize YouTube player when video URL changes
  useEffect(() => {
    if (formData.video_type !== 'youtube' || !formData.video_url) {
      ytPlayerRef.current?.destroy()
      ytPlayerRef.current = null
      setIsPlayerReady(false)
      return
    }

    const videoInfo = extractVideoInfo(formData.video_url)
    if (!videoInfo) return
    const youtubeVideoId = videoInfo.id

    function initPlayer() {
      if (!playerContainerRef.current) return
      
      // Destroy existing player
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy()
        ytPlayerRef.current = null
      }

      // Create new player
      ytPlayerRef.current = new window.YT.Player(playerContainerRef.current, {
        videoId: youtubeVideoId,
        playerVars: {
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            setIsPlayerReady(true)
          }
        }
      })
    }

    // Wait for API to load
    if (window.YT && window.YT.Player) {
      initPlayer()
    } else {
      window.onYouTubeIframeAPIReady = initPlayer
    }

    return () => {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy()
        ytPlayerRef.current = null
      }
    }
  }, [formData.video_url, formData.video_type])

  // Poll for current time when player is ready
  useEffect(() => {
    if (!isPlayerReady || !ytPlayerRef.current) return
    
    const interval = setInterval(() => {
      try {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
          const currentTime = ytPlayerRef.current.getCurrentTime()
          const totalSeconds = Math.floor(currentTime)
          const hours = Math.floor(totalSeconds / 3600)
          const minutes = Math.floor((totalSeconds % 3600) / 60)
          const seconds = totalSeconds % 60
          setTimestampHours(hours)
          setTimestampMinutes(minutes)
          setTimestampSeconds(seconds)
        }
      } catch {
        // Player might not be ready yet
      }
    }, 500)
    
    return () => clearInterval(interval)
  }, [isPlayerReady])

  useEffect(() => {
    fetchVideos()
    fetchSongs()
  }, [])

  async function fetchVideos() {
    const response = await fetch('/api/admin/videos')
    if (!response.ok) {
      setLoading(false)
      return
    }

    const data = await response.json()
    setVideos(data.videos || [])
    setLoading(false)
  }

  async function fetchSongs() {
    const response = await fetch('/api/admin/songs')
    if (!response.ok) return
    const data = await response.json()
    setSongs(
      (data.songs || [])
        .map((s: SongOption) => ({ id: s.id, title: s.title, slug: s.slug }))
        .sort((a: SongOption, b: SongOption) => a.title.localeCompare(b.title, 'ru'))
    )
  }

  function resetForm() {
    setFormData({
      title: '',
      slug: '',
      description: '',
      video_url: '',
      video_type: 'youtube',
      thumbnail_url: '',
      is_published: true,
      song_text_id: ''
    })
    setEditingVideo(null)
    setIsCreating(false)
  }

  function startEdit(video: VideoType) {
    setEditingVideo(video)
    setIsCreating(false)
    setFormData({
      title: video.title,
      slug: video.slug || '',
      description: video.description || '',
      video_url: video.video_url,
      video_type: video.video_type,
      thumbnail_url: video.thumbnail_url || '',
      is_published: video.is_published,
      song_text_id: video.song_text_id || ''
    })
  }

  function startCreate() {
    resetForm()
    setIsCreating(true)
  }

  // Auto-generate slug from title
  function handleTitleChange(title: string) {
    const newSlug = editingVideo?.slug ? formData.slug : generateSlug(title)
    setFormData({
      ...formData,
      title,
      slug: newSlug
    })
  }

  // Auto-detect video type from URL and fetch YouTube title
  async function handleUrlChange(url: string) {
    const info = extractVideoInfo(url)
    const thumbnail = info ? getThumbnailUrl(info.type, url) : null
    
    setFormData(prev => ({
      ...prev,
      video_url: url,
      video_type: info?.type || 'custom',
      thumbnail_url: thumbnail || prev.thumbnail_url
    }))

    // Fetch YouTube video title if URL is valid and title is empty
    if (info?.type === 'youtube' && info.id && !formData.title) {
      setFetchingTitle(true)
      try {
        const response = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${info.id}&format=json`
        )
        if (response.ok) {
          const data = await response.json()
          if (data.title) {
            const newSlug = generateSlug(data.title)
            setFormData(prev => ({
              ...prev,
              title: data.title,
              slug: newSlug
            }))
          }
        }
      } catch (error) {
        // Silently fail - user can enter title manually
        console.log('[v0] Could not fetch YouTube title:', error)
      } finally {
        setFetchingTitle(false)
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Auto-generate thumbnail if empty and YouTube
    let thumbnail = formData.thumbnail_url
    if (!thumbnail && formData.video_type === 'youtube') {
      thumbnail = getThumbnailUrl('youtube', formData.video_url) || ''
    }
    
    // Generate unique slug if not provided
    let slug = formData.slug || generateSlug(formData.title)
    // Add random suffix for uniqueness if creating new
    if (!editingVideo) {
      slug = `${slug}-${Date.now().toString(36)}`
    }
    
    const payload = {
      title: formData.title,
      slug,
      description: formData.description || null,
      video_url: formData.video_url,
      video_type: formData.video_type,
      thumbnail_url: thumbnail || null,
      is_published: formData.is_published,
      order_index: editingVideo?.order_index ?? videos.length,
      song_text_id: formData.song_text_id || null,
    }

    if (editingVideo) {
      await fetch(`/api/admin/videos/${editingVideo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/admin/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    resetForm()
    fetchVideos()
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить это видео?')) return

    await fetch(`/api/admin/videos/${id}`, { method: 'DELETE' })
    fetchVideos()
  }

  async function togglePublished(video: VideoType) {
    await fetch(`/api/admin/videos/${video.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !video.is_published }),
    })
    fetchVideos()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>
  }

  const previewEmbedUrl = formData.video_url ? getEmbedUrl(formData.video_type, formData.video_url) : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Видео</h1>
          <p className="text-muted-foreground">Управление видеозаписями</p>
        </div>
        <Button onClick={startCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Добавить видео
        </Button>
      </div>

      {/* Published Videos Section */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Опубликованные</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {videos.filter(v => v.is_published).length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-6 text-center text-muted-foreground text-sm">
                Нет опубликованных видео
              </CardContent>
            </Card>
          ) : (
            videos.filter(v => v.is_published).map((video) => (
              <Card 
                key={video.id} 
                className={`cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all ${editingVideo?.id === video.id ? 'ring-2 ring-primary' : ''}`}
                onClick={() => startEdit(video)}
              >
                <CardContent className="p-0">
                  <div className="relative aspect-video bg-muted">
                    {video.thumbnail_url ? (
                      <img
                        src={resolveAssetUrl(video.thumbnail_url) ?? video.thumbnail_url}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-1 right-1 px-1 py-0.5 rounded text-[10px] font-medium bg-black/70 text-white uppercase">
                      {video.video_type}
                    </div>
                  </div>
                  <div className="p-2">
                    <h3 className="text-xs font-medium line-clamp-2">{video.title}</h3>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Unpublished Videos Section */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-muted-foreground">Неопубликованные</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {videos.filter(v => !v.is_published).length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-6 text-center text-muted-foreground text-sm">
                Нет неопубликованных видео
              </CardContent>
            </Card>
          ) : (
            videos.filter(v => !v.is_published).map((video) => (
              <Card 
                key={video.id} 
                className={`cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all opacity-60 ${editingVideo?.id === video.id ? 'ring-2 ring-primary opacity-100' : ''}`}
                onClick={() => startEdit(video)}
              >
                <CardContent className="p-0">
                  <div className="relative aspect-video bg-muted">
                    {video.thumbnail_url ? (
                      <img
                        src={resolveAssetUrl(video.thumbnail_url) ?? video.thumbnail_url}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-1 right-1 px-1 py-0.5 rounded text-[10px] font-medium bg-black/70 text-white uppercase">
                      {video.video_type}
                    </div>
                    <div className="absolute top-1 left-1 px-1 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                      Черновик
                    </div>
                  </div>
                  <div className="p-2">
                    <h3 className="text-xs font-medium line-clamp-2">{video.title}</h3>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {(isCreating || editingVideo) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingVideo ? 'Редактировать видео' : 'Новое видео'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* URL field first - will auto-fetch title */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Ссылка на видео *</label>
                  <Input
                    value={formData.video_url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Вставьте ссылку на YouTube - название видео заполнится автоматически
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Название *</label>
                  <div className="relative">
                    <Input
                      value={formData.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="Название видео"
                      required
                      disabled={fetchingTitle}
                    />
                    {fetchingTitle && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  {fetchingTitle && (
                    <p className="text-xs text-muted-foreground">Получение названия с YouTube...</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Тип платформы</label>
                  <Select
                    value={formData.video_type}
                    onValueChange={(value: VideoType['video_type']) => 
                      setFormData({ ...formData, video_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="vk">VK Video</SelectItem>
                      <SelectItem value="rutube">Rutube</SelectItem>
                      <SelectItem value="custom">Другое</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Slug (URL)</label>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    placeholder="auto-generated-from-title"
                  />
                  <p className="text-xs text-muted-foreground">Автоматически генерируется из названия</p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Песня</label>
                  <Select
                    value={formData.song_text_id || NO_SONG}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        song_text_id: value === NO_SONG ? '' : value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Не привязано к песне" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SONG}>Не привязано к песне</SelectItem>
                      {songs.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Привязанные видео показываются на странице песни
                  </p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Описание</label>
                  
                  {/* Timestamp marker tool */}
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-secondary/30 rounded-lg mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Метка времени:</span>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        max="99"
                        value={timestampHours.toString().padStart(2, '0')}
                        onChange={(e) => setTimestampHours(Math.max(0, Math.min(99, parseInt(e.target.value) || 0)))}
                        className="w-14 h-8 text-center text-sm font-mono"
                        placeholder="00"
                      />
                      <span className="text-muted-foreground font-bold">:</span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={timestampMinutes.toString().padStart(2, '0')}
                        onChange={(e) => setTimestampMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="w-14 h-8 text-center text-sm font-mono"
                        placeholder="00"
                      />
                      <span className="text-muted-foreground font-bold">:</span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={timestampSeconds.toString().padStart(2, '0')}
                        onChange={(e) => setTimestampSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="w-14 h-8 text-center text-sm font-mono"
                        placeholder="00"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={insertTimestamp}
                      className="h-8"
                    >
                      Вставить метку
                    </Button>
                    {formData.video_type === 'youtube' && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        Время синхронизируется с видео
                      </span>
                    )}
                  </div>
                  
                  <textarea
                    ref={textareaRef}
                    className="w-full min-h-32 px-3 py-2 rounded-md border border-input bg-background text-sm"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Описание видео. Используйте метки времени в формате 00:00:00 для создания списка песен с переходами."
                  />
                  <p className="text-xs text-muted-foreground">
                    Пример: 00:00:00 Вступление, 00:01:30 Песня 1, 00:05:45 Песня 2
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">URL превью (опционально)</label>
                  <Input
                    value={formData.thumbnail_url}
                    onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                    placeholder="Автоматически для YouTube"
                  />
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

                {/* Video Preview */}
                {formData.video_type === 'youtube' && formData.video_url && extractVideoInfo(formData.video_url) && (
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Превью видео</label>
                    <div className="aspect-video w-full max-w-5xl rounded-lg overflow-hidden border border-border bg-black">
                      <div ref={playerContainerRef} className="w-full h-full" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Воспроизведите видео - время автоматически отобразится в поле метки
                    </p>
                  </div>
                )}
                {formData.video_type !== 'youtube' && previewEmbedUrl && (
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Превью видео</label>
                    <div className="aspect-video w-full max-w-5xl rounded-lg overflow-hidden border border-border">
                      <iframe
                        src={previewEmbedUrl}
                        className="w-full h-full"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="submit">
                  {editingVideo ? 'Сохранить' : 'Создать'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Отмена
                </Button>
                {editingVideo && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => togglePublished(editingVideo)}
                    >
                      {editingVideo.is_published ? 'Скрыть' : 'Опубликовать'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleDelete(editingVideo.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Удалить
                    </Button>
                  </>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
