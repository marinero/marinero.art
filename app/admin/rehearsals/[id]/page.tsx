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
      getPlayerState(): number
      seekTo(seconds: number, allowSeekAhead?: boolean): void
      playVideo(): void
      pauseVideo(): void
      destroy(): void
      loadVideoById(options: { videoId: string; startSeconds?: number }): void
      cueVideoById(options: { videoId: string; startSeconds?: number }): void
    }
  }
}

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CommentInput } from '@/components/comments/comment-input'
import { CommentContent } from '@/components/comments/comment-content'
import { useChordMap } from '@/hooks/use-chord-map'
import { useGuitarAudio } from '@/hooks/use-guitar-audio'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  ArrowLeft,
  Trash2, 
  Calendar as CalendarIcon, 
  Music, 
  Upload,
  Play,
  Pause,
  MessageSquare,
  Send,
  Clock,
  User,
  X,
  Reply,
  Pencil,
  Check,
  ChevronUp,
  ChevronDown,
  Video,
  Headphones,
  Download
} from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import Link from 'next/link'
import { upload } from '@/lib/upload-client'
import { AdminUserHoverCard } from '@/components/admin/user-hover-card'
import { Checkbox } from '@/components/ui/checkbox'
import type { Video as VideoType } from '@/lib/types'
import type { MultitrackGroup } from '@/lib/types'
import type { CommentChord } from '@/lib/types'
import { MultitrackPlayer, MultitrackUploadDialog } from '@/components/multitrack'
import { resolveAssetUrl, resolveAudioUrl } from '@/lib/storage-keys'
import { adminRehearsalUrl, isUuid, rehearsalDateSlug } from '@/lib/rehearsal-url'

interface AudioFile {
  id: string
  filename: string
  file_url: string
  duration_seconds: number | null
  song_text_id?: string | null
  created_at: string
}

interface SongOption {
  id: string
  title: string
  slug: string
}

const NO_SONG = '__none__'

interface Comment {
  id: string
  content: string
  timestamp_seconds: number | null
  created_at: string
  user_id?: string
  parent_id?: string | null
  chords?: CommentChord[] | null
  user: {
    display_name: string
  } | null
  object_id?: string
  replies?: Comment[]
}

interface RehearsalComment {
  id: string
  content: string
  created_at: string
  user_id?: string
  parent_id: string | null
  chords?: CommentChord[] | null
  user: {
    display_name: string
  } | null
  replies: RehearsalComment[]
}

interface Rehearsal {
  id: string
  rehearsal_date: string
  created_at: string
}

function SongTagSelect({
  value,
  songs,
  onChange,
}: {
  value: string | null | undefined
  songs: SongOption[]
  onChange: (songId: string | null) => void
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Music className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Select
        value={value ?? NO_SONG}
        onValueChange={(v) => onChange(v === NO_SONG ? null : v)}
      >
        <SelectTrigger size="sm" className="h-7 text-xs flex-1 min-w-0">
          <SelectValue placeholder="Привязать к песне" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_SONG}>Без песни</SelectItem>
          {songs.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default function RehearsalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const routeId = params.id as string
  const autoplayAudioId = searchParams.get('audio')
  const autoplayTimestamp = searchParams.get('t')

  const chordMap = useChordMap()
  const { playArpeggio } = useGuitarAudio()
  const [rehearsal, setRehearsal] = useState<Rehearsal | null>(null)
  const [rehearsalId, setRehearsalId] = useState<string | null>(null)
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [comments, setComments] = useState<RehearsalComment[]>([])
  const [audioComments, setAudioComments] = useState<Record<string, Comment[]>>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [audioReplyingTo, setAudioReplyingTo] = useState<string | null>(null)
  const [audioReplyText, setAudioReplyText] = useState('')
  const [newAudioComment, setNewAudioComment] = useState('')
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null)
  const [commentTimestamp, setCommentTimestamp] = useState<number | null>(null)

  // Edit state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editMinutes, setEditMinutes] = useState(0)
  const [editSeconds, setEditSeconds] = useState(0)
  const [editHadTimestamp, setEditHadTimestamp] = useState(false) // Track if comment originally had timestamp
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Audio player state
  const [currentAudio, setCurrentAudio] = useState<AudioFile | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Video state
  const [allVideos, setAllVideos] = useState<VideoType[]>([])
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([])
  const [rehearsalVideos, setRehearsalVideos] = useState<(VideoType & { display_order: number })[]>([])
  const [currentVideo, setCurrentVideo] = useState<VideoType | null>(null)
  const [videoComments, setVideoComments] = useState<Comment[]>([])
  const [newVideoComment, setNewVideoComment] = useState('')
  const [videoReplyingTo, setVideoReplyingTo] = useState<string | null>(null)
  const [videoReplyText, setVideoReplyText] = useState('')
  
  // YouTube player state
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const ytPlayerRef = useRef<YT.Player | null>(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [timestampHours, setTimestampHours] = useState(0)
  const [timestampMinutes, setTimestampMinutes] = useState(0)
  const [timestampSeconds, setTimestampSeconds] = useState(0)
  const pendingSeekRef = useRef<number | null>(null)

  // Multitrack state
  const [multitrackGroups, setMultitrackGroups] = useState<MultitrackGroup[]>([])
  const [showMultitrackUpload, setShowMultitrackUpload] = useState(false)

  // Songs (for tagging recordings / videos / multitracks)
  const [allSongs, setAllSongs] = useState<SongOption[]>([])

  useEffect(() => {
    loadRehearsal()
  }, [routeId])

  useEffect(() => {
    if (!rehearsal || !isUuid(routeId)) return

    const dateSlug = rehearsalDateSlug(rehearsal.rehearsal_date)
    if (routeId === dateSlug) return

    const search = window.location.search
    router.replace(`${adminRehearsalUrl(rehearsal.rehearsal_date)}${search}`)
  }, [rehearsal, routeId, router])

  // Load YouTube IFrame API script
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.YT && window.YT.Player) return
    
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
  }, [])

  // Initialize YouTube player when video is selected
  useEffect(() => {
    if (!currentVideo || currentVideo.video_type !== 'youtube' || !currentVideo.video_url) {
      return
    }

    const videoInfo = extractVideoInfo(currentVideo.video_url)
    if (!videoInfo) return
    const youtubeVideoId = videoInfo.id

    function initPlayer() {
      if (!playerContainerRef.current) return
      
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy()
        ytPlayerRef.current = null
      }

      ytPlayerRef.current = new window.YT.Player(playerContainerRef.current, {
        videoId: youtubeVideoId,
        playerVars: {
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            setIsPlayerReady(true)
          },
          onStateChange: (event: { data: number }) => {
            if (event.data === 1 && pendingSeekRef.current !== null) {
              const seekTarget = pendingSeekRef.current
              pendingSeekRef.current = null
              setTimeout(() => {
                if (ytPlayerRef.current) {
                  ytPlayerRef.current.seekTo(seekTarget, true)
                }
              }, 100)
            }
          }
        }
      })
    }

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
  }, [currentVideo])

  // Poll for current video time when player is ready
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

  // Auto-play audio from deep-link (e.g. from comments page)
  useEffect(() => {
    if (!autoplayAudioId || !audioFiles.length || loading) return
    const targetAudio = audioFiles.find(a => a.id === autoplayAudioId)
    if (!targetAudio || currentAudio?.id === autoplayAudioId) return

    setCurrentAudio(targetAudio)
    setSelectedAudioId(targetAudio.id)
    setIsPlaying(true)

    if (audioRef.current) {
      audioRef.current.src = resolveAudioUrl(targetAudio.file_url) ?? targetAudio.file_url
      audioRef.current.load()
      
      const handleCanPlay = () => {
        if (autoplayTimestamp) {
          audioRef.current!.currentTime = parseInt(autoplayTimestamp) || 0
        }
        audioRef.current!.play()
        audioRef.current!.removeEventListener('canplay', handleCanPlay)
      }
      audioRef.current.addEventListener('canplay', handleCanPlay)
    }
  }, [autoplayAudioId, audioFiles, loading])

  // Extract video ID from various platform URLs
  function extractVideoInfo(url: string): { type: VideoType['video_type']; id: string } | null {
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
    if (ytMatch) return { type: 'youtube', id: ytMatch[1] }
    
    const vkMatch = url.match(/vk\.com\/video(-?\d+_\d+)/)
    if (vkMatch) return { type: 'vk', id: vkMatch[1] }
    
    const rutubeMatch = url.match(/rutube\.ru\/video\/([a-zA-Z0-9]+)/)
    if (rutubeMatch) return { type: 'rutube', id: rutubeMatch[1] }
    
    return { type: 'custom', id: url }
  }

  // Generate embed URL based on video type
  function getEmbedUrl(videoType: VideoType['video_type'], videoUrl: string): string {
    const info = extractVideoInfo(videoUrl)
    if (!info) return videoUrl
    
    switch (videoType) {
      case 'youtube':
        return `https://www.youtube.com/embed/${info.id}?enablejsapi=1`
      case 'vk':
        return `https://vk.com/video_ext.php?oid=${info.id.split('_')[0]}&id=${info.id.split('_')[1]}`
      case 'rutube':
        return `https://rutube.ru/play/embed/${info.id}`
      default:
        return videoUrl
    }
  }

  // Parse timestamp string to seconds
  function parseTimestamp(timestamp: string): number | null {
    const parts = timestamp.split(':').map(p => parseInt(p, 10))
    if (parts.some(isNaN)) return null
    
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    return null
  }

  // Format seconds to timestamp string
  function formatVideoTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Seek video to specific timestamp
  function seekVideoToTime(seconds: number) {
    if (!currentVideo) return
    
    if (currentVideo.video_type === 'youtube' && ytPlayerRef.current) {
      try {
        const playerState = ytPlayerRef.current.getPlayerState()
        
        if (playerState === -1 || playerState === 5) {
          const videoInfo = extractVideoInfo(currentVideo.video_url)
          if (videoInfo) {
            ytPlayerRef.current.cueVideoById({ videoId: videoInfo.id, startSeconds: seconds })
          }
        } else {
          ytPlayerRef.current.seekTo(seconds, true)
          ytPlayerRef.current.playVideo()
        }
      } catch {
        pendingSeekRef.current = seconds
        ytPlayerRef.current?.playVideo()
      }
    }
  }

  // Format timestamp for comment insertion
  function formatTimestampForComment(): string {
    return `${timestampHours.toString().padStart(2, '0')}:${timestampMinutes.toString().padStart(2, '0')}:${timestampSeconds.toString().padStart(2, '0')}`
  }

  // Insert timestamp into video comment
  function insertTimestampToVideoComment() {
    const timestamp = formatTimestampForComment()
    setNewVideoComment(prev => prev + timestamp + ' ')
  }

  async function loadRehearsal() {
    setLoading(true)

    const response = await fetch(
      `/api/admin/rehearsals/${encodeURIComponent(routeId)}`
    )

    if (!response.ok) {
      router.push('/admin/rehearsals')
      return
    }

    const data = await response.json()

    if (data.current_user) {
      setCurrentUserId(data.current_user.id)
      setIsAdmin(data.current_user.isAdmin)
    }

    setRehearsal(data.rehearsal)
    setRehearsalId(data.rehearsal.id)
    setAudioFiles(data.audio_files || [])
    setComments(data.comments || [])
    setAudioComments(data.audio_comments || {})
    setAllVideos(data.all_videos || [])
    setSelectedVideoIds(data.selected_video_ids || [])
    setRehearsalVideos(data.rehearsal_videos || [])
    setAllSongs(data.all_songs || [])

    try {
      const multitrackResponse = await fetch(
        `/api/multitrack?rehearsal_id=${data.rehearsal.id}`
      )
      if (multitrackResponse.ok) {
        const groups = await multitrackResponse.json()
        setMultitrackGroups(groups)
      }
    } catch (error) {
      console.error('Failed to load multitrack groups:', error)
    }

    setLoading(false)
  }

  async function saveRehearsalVideos() {
    if (!rehearsalId) return

    await fetch(`/api/admin/rehearsals/${rehearsalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds: selectedVideoIds }),
    })

    loadRehearsal()
  }

  function toggleVideoSelection(videoId: string) {
    setSelectedVideoIds(prev => 
      prev.includes(videoId)
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    )
  }

  async function loadVideoComments(videoId: string) {
    const response = await fetch(
      `/api/comments?type=video&object_id=${encodeURIComponent(videoId)}`
    )
    if (!response.ok) return
    const data = await response.json()
    setVideoComments(data.comments || [])
  }

  async function selectVideo(video: VideoType) {
    setCurrentVideo(video)
    setIsPlayerReady(false)
    loadVideoComments(video.id)
  }

  async function addVideoComment() {
    if (!newVideoComment.trim() || !currentVideo) return

    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'video',
        object_id: currentVideo.id,
        content: newVideoComment.trim(),
      }),
    })

    if (response.ok) {
      setNewVideoComment('')
      loadVideoComments(currentVideo.id)
    }
  }

  async function addVideoReply() {
    if (!videoReplyText.trim() || !currentVideo || !videoReplyingTo) return

    const replyContentForEmail = videoReplyText.trim()

    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'video',
        object_id: currentVideo.id,
        content: replyContentForEmail,
        parent_id: videoReplyingTo,
      }),
    })

    if (response.ok) {
      // Send email notification
      try {
        await fetch('/api/notifications/comment-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentCommentId: videoReplyingTo,
            replyContent: replyContentForEmail,
            contextType: 'video',
            contextUrl: adminRehearsalUrl(rehearsal!.rehearsal_date),
          }),
        })
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError)
      }

      setVideoReplyText('')
      setVideoReplyingTo(null)
      loadVideoComments(currentVideo.id)
    }
  }

  async function deleteVideoComment(commentId: string) {
    const response = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
    if (response.ok && currentVideo) {
      loadVideoComments(currentVideo.id)
    }
  }

  // Multitrack functions
  function handleMultitrackUploadComplete(group: MultitrackGroup) {
    setMultitrackGroups(prev => [...prev, group])
  }

  async function deleteMultitrackGroup(groupId: string) {
    if (!confirm('Удалить мультитрек группу?')) return

    try {
      const response = await fetch(`/api/multitrack?id=${groupId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMultitrackGroups(prev => prev.filter(g => g.id !== groupId))
      }
    } catch (error) {
      console.error('Failed to delete multitrack group:', error)
    }
  }

  async function setAudioSong(audioFileId: string, songId: string | null) {
    if (!rehearsalId) return
    setAudioFiles(prev =>
      prev.map(a => (a.id === audioFileId ? { ...a, song_text_id: songId } : a))
    )
    await fetch(`/api/admin/rehearsals/${rehearsalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioFileId, song_text_id: songId }),
    })
  }

  async function setMultitrackSong(groupId: string, songId: string | null) {
    setMultitrackGroups(prev =>
      prev.map(g => (g.id === groupId ? { ...g, song_text_id: songId } : g))
    )
    await fetch('/api/multitrack', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'group', id: groupId, song_text_id: songId }),
    })
  }

  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('audio/')) {
      alert('Пожалуйста, выберите аудиофайл')
      return
    }

    if (file.size > 100 * 1024 * 1024) {
      alert('Файл слишком большой (максимум 100MB)')
      return
    }

    setUploading(true)
    try {
      // Get duration from local file before upload
      const durationSeconds = await getAudioDuration(file)

      // Use client-side upload for large files (bypasses 4.5MB serverless limit)
      const timestamp = Date.now()
      const extension = file.name.split('.').pop()
      const pathname = `marinero/audio/${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`
      
      const blob = await upload(pathname, file, {
        access: 'private',
      })

      const fileUrl = blob.url
      
      // Save to database
      if (!rehearsalId) throw new Error('Rehearsal ID not found')
      
      const saveResponse = await fetch(`/api/admin/rehearsals/${rehearsalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: fileUrl,
          filename: file.name,
          duration_seconds: durationSeconds,
        }),
      })

      if (!saveResponse.ok) throw new Error('Failed to save audio metadata')

      loadRehearsal()
    } catch (error: any) {
      console.error('Upload error:', error)
      alert(`Ошибка загрузки аудио: ${error?.message || 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  // Helper function to get audio duration from local file
  function getAudioDuration(file: File): Promise<number | null> {
    return new Promise((resolve) => {
      const audio = document.createElement('audio')
      const objectUrl = URL.createObjectURL(file)
      
      audio.addEventListener('loadedmetadata', () => {
        const dur = audio.duration
        URL.revokeObjectURL(objectUrl)
        if (dur && isFinite(dur) && dur > 0) {
          resolve(Math.round(dur))
        } else {
          resolve(null)
        }
      })
      
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(objectUrl)
        resolve(null)
      })
      
      audio.src = objectUrl
    })
  }

  async function deleteAudioFile(id: string) {
    if (!confirm('Удалить этот аудиофайл?')) return

    const response = await fetch(
      `/api/admin/rehearsals/${rehearsalId}?audioFileId=${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    )

    if (!response.ok) {
      alert('Ошибка удаления')
      return
    }

    if (currentAudio?.id === id) {
      setCurrentAudio(null)
      setIsPlaying(false)
    }
    loadRehearsal()
  }

  async function addRehearsalComment() {
    if (!newComment.trim() || !rehearsalId) return

    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'rehearsal',
        object_id: rehearsalId,
        content: newComment.trim(),
      }),
    })

    if (!response.ok) {
      alert('Ошибка добавления комментария')
      return
    }

    setNewComment('')
    loadRehearsal()
  }

  async function addRehearsalReply() {
    if (!replyText.trim() || !rehearsalId || !replyingTo) return

    const replyContentForEmail = replyText.trim()

    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'rehearsal',
        object_id: rehearsalId,
        content: replyContentForEmail,
        parent_id: replyingTo,
      }),
    })

    if (!response.ok) {
      alert('Ошибка добавления ответа')
      return
    }

    // Send email notification to the parent comment author
    try {
      await fetch('/api/notifications/comment-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentCommentId: replyingTo,
          replyContent: replyContentForEmail,
          contextType: 'rehearsal',
          contextUrl: adminRehearsalUrl(rehearsal!.rehearsal_date),
        }),
      })
    } catch (notifyError) {
      console.error('Failed to send notification:', notifyError)
    }

    setReplyText('')
    setReplyingTo(null)
    loadRehearsal()
  }

  async function addAudioComment() {
    if (!newAudioComment.trim() || !selectedAudioId) return

    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'audio',
        object_id: selectedAudioId,
        content: newAudioComment.trim(),
        timestamp_seconds: commentTimestamp,
      }),
    })

    if (!response.ok) {
      alert('Ошибка добавления комментария')
      return
    }

    setNewAudioComment('')
    setCommentTimestamp(null)
    loadRehearsal()
  }

  async function addAudioReply() {
    if (!audioReplyText.trim() || !audioReplyingTo) return

    let audioFileId: string | null = null
    Object.entries(audioComments).forEach(([fileId, comments]) => {
      comments.forEach(c => {
        if (c.id === audioReplyingTo) {
          audioFileId = fileId
        }
      })
    })

    if (!audioFileId) return

    const replyContentForEmail = audioReplyText.trim()

    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'audio',
        object_id: audioFileId,
        content: replyContentForEmail,
        parent_id: audioReplyingTo,
      }),
    })

    if (!response.ok) {
      alert('Ошибка добавления ответа')
      return
    }

    // Send email notification to the parent comment author
    try {
      await fetch('/api/notifications/comment-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentCommentId: audioReplyingTo,
          replyContent: replyContentForEmail,
          contextType: 'audio',
          contextUrl: adminRehearsalUrl(rehearsal!.rehearsal_date, { audio: audioFileId }),
        }),
      })
    } catch (notifyError) {
      console.error('Failed to send notification:', notifyError)
    }
    
    setAudioReplyText('')
    setAudioReplyingTo(null)
    loadRehearsal()
  }

  async function deleteComment(id: string) {
    const response = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
    if (response.ok) loadRehearsal()
  }

  function startEditComment(comment: Comment | RehearsalComment, type: 'audio' | 'rehearsal') {
    setEditingCommentId(comment.id)
    setEditContent(comment.content)
    const hadTimestamp = type === 'audio' && 'timestamp_seconds' in comment && comment.timestamp_seconds !== null
    setEditHadTimestamp(hadTimestamp)
    if (hadTimestamp) {
      const totalSeconds = (comment as Comment).timestamp_seconds!
      setEditMinutes(Math.floor(totalSeconds / 60))
      setEditSeconds(totalSeconds % 60)
    } else {
      setEditMinutes(0)
      setEditSeconds(0)
    }
  }

  function cancelEdit() {
    setEditingCommentId(null)
    setEditContent('')
    setEditMinutes(0)
    setEditSeconds(0)
  }

  function getMaxMinutes() {
    // If duration not loaded or Infinity, allow reasonable max (99 minutes)
    if (!duration || duration === 0 || !isFinite(duration)) return 99
    return Math.floor(duration / 60)
  }

  function getMaxSeconds(minutes: number) {
    // If duration not loaded or Infinity, allow full 59 seconds
    if (!duration || duration === 0 || !isFinite(duration)) return 59
    const maxTotal = Math.floor(duration)
    const maxMin = Math.floor(maxTotal / 60)
    if (minutes < maxMin) return 59
    return maxTotal % 60
  }

  function clampTime(minutes: number, seconds: number): { minutes: number; seconds: number } {
    // If duration not loaded or Infinity, don't clamp
    if (!duration || duration === 0 || !isFinite(duration)) {
      return { minutes: Math.max(0, minutes), seconds: Math.max(0, Math.min(59, seconds)) }
    }
    const maxTotal = Math.floor(duration)
    const total = minutes * 60 + seconds
    if (total > maxTotal) {
      return { minutes: Math.floor(maxTotal / 60), seconds: maxTotal % 60 }
    }
    return { minutes, seconds }
  }

  function setEditMinutesClamped(newMinutes: number) {
    const clamped = clampTime(newMinutes, editSeconds)
    setEditMinutes(clamped.minutes)
    setEditSeconds(clamped.seconds)
  }

  function setEditSecondsClamped(newSeconds: number) {
    const clamped = clampTime(editMinutes, newSeconds)
    setEditMinutes(clamped.minutes)
    setEditSeconds(clamped.seconds)
  }

  function setCurrentTimeForEdit() {
    const totalSeconds = Math.floor(currentTime)
    setEditMinutes(Math.floor(totalSeconds / 60))
    setEditSeconds(totalSeconds % 60)
  }

  async function saveEditComment(type: 'audio' | 'rehearsal') {
    if (!editingCommentId || !editContent.trim()) return
    
    const body: { content: string; timestamp_seconds?: number | null } = {
      content: editContent.trim()
    }
    
    // Only admins can edit timestamp for audio comments
    // Only send timestamp if it originally existed or was explicitly set
    if (type === 'audio' && isAdmin && editHadTimestamp) {
      body.timestamp_seconds = editMinutes * 60 + editSeconds
    }

    const response = await fetch(`/api/comments/${editingCommentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (response.ok) {
      cancelEdit()
      loadRehearsal()
    } else {
      const error = await response.json()
      alert(`Ошибка: ${error.error}`)
    }
  }

  function canEditComment(comment: { user_id?: string }) {
    return currentUserId === comment.user_id || isAdmin
  }

  function playAudio(audio: AudioFile) {
    if (currentAudio?.id === audio.id) {
      if (isPlaying) {
        audioRef.current?.pause()
        setIsPlaying(false)
      } else {
        audioRef.current?.play()
          ?.then(() => setIsPlaying(true))
          ?.catch((error) => {
            console.error('Audio playback failed:', error)
            setIsPlaying(false)
          })
      }
    } else {
      setCurrentAudio(audio)
      setSelectedAudioId(audio.id)
      setCurrentTime(0)
      setDuration(audio.duration_seconds || 0)
      setIsPlaying(true)
      if (audioRef.current) {
        const el = audioRef.current
        el.src = resolveAudioUrl(audio.file_url) ?? audio.file_url
        el.load()

        const handleCanPlay = () => {
          el.play().catch((error) => {
            console.error('Audio playback failed:', error)
            setIsPlaying(false)
          })
          cleanup()
        }
        const handleError = () => {
          console.error('Failed to load audio:', el.src)
          setIsPlaying(false)
          cleanup()
        }
        const cleanup = () => {
          el.removeEventListener('canplay', handleCanPlay)
          el.removeEventListener('error', handleError)
        }

        el.addEventListener('canplay', handleCanPlay)
        el.addEventListener('error', handleError)
      }
    }
  }

  function seekTo(time: number) {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  function formatTime(seconds: number): string {
    if (!isFinite(seconds) || isNaN(seconds)) {
      return '0:00'
    }
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function markCurrentTime() {
    setCommentTimestamp(Math.floor(currentTime))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    )
  }

  if (!rehearsal) return null

  return (
    <div className="space-y-6">
      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={() => {
          setCurrentTime(audioRef.current?.currentTime || 0)
          // Fallback: try to get duration during playback if not set yet
          const dur = audioRef.current?.duration
          if (dur && isFinite(dur) && !isNaN(dur) && dur > 0) {
            setDuration(dur)
          }
        }}
        onLoadedMetadata={() => {
          const dur = audioRef.current?.duration
          if (dur && isFinite(dur) && !isNaN(dur) && dur > 0) {
            setDuration(dur)
          }
        }}
        onDurationChange={() => {
          const dur = audioRef.current?.duration
          if (dur && isFinite(dur) && !isNaN(dur) && dur > 0) {
            setDuration(dur)
          }
        }}
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          console.error('Failed to load audio:', audioRef.current?.src)
          setIsPlaying(false)
        }}
        onCanPlay={() => {
          // Fallback: try to get duration when audio is ready to play
          const dur = audioRef.current?.duration
          if (dur && isFinite(dur) && !isNaN(dur) && dur > 0) {
            setDuration(dur)
          }
        }}
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/rehearsals">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-display font-bold">
            Репетиция {format(new Date(rehearsal.rehearsal_date), 'd MMMM yyyy', { locale: ru })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {audioFiles.length} аудиофайлов · {rehearsalVideos.length} видео · {comments.length} комментариев
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Multitrack, Audio, Videos */}
        <div className="lg:col-span-2 space-y-6">
          {/* Multitrack Section - at the top */}
          <Card className="border-indigo-200 dark:border-indigo-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
                  <Headphones className="h-5 w-5 text-indigo-600" />
                  Мультитреки
                </CardTitle>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMultitrackUpload(true)}
                    className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Загрузить
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {multitrackGroups.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Нет мультитреков
                </p>
              ) : (
                <div className="space-y-4">
                  {multitrackGroups.map(group => (
                    <div key={group.id} className="space-y-2">
                      {isAdmin && (
                        <SongTagSelect
                          value={group.song_text_id}
                          songs={allSongs}
                          onChange={(songId) => setMultitrackSong(group.id, songId)}
                        />
                      )}
                      <MultitrackPlayer
                        group={group}
                        currentUserId={currentUserId}
                        isAdmin={isAdmin}
                        onDelete={deleteMultitrackGroup}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Multitrack Upload Dialog */}
          {rehearsalId && (
            <MultitrackUploadDialog
              open={showMultitrackUpload}
              onOpenChange={setShowMultitrackUpload}
              rehearsalId={rehearsalId}
              onUploadComplete={handleMultitrackUploadComplete}
            />
          )}

          {/* Audio Player - below multitrack */}
          {currentAudio && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Сейчас играет: {currentAudio.filename}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <Slider
                    value={[currentTime]}
                    max={duration && isFinite(duration) ? duration : 100}
                    step={1}
                    onValueChange={(value) => seekTo(value[0])}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatTime(currentTime)}</span>
                    <span>{duration > 0 && isFinite(duration) ? formatTime(duration) : '--:--'}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => seekTo(Math.max(0, currentTime - 10))}
                  >
                    -10
                  </Button>
                  <Button
                    size="lg"
                    className="h-12 w-12 rounded-full"
                    onClick={() => playAudio(currentAudio)}
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => seekTo(Math.min(duration, currentTime + 10))}
                  >
                    +10
                  </Button>
                </div>

                {/* Add Comment at Timestamp */}
                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={markCurrentTime}
                      className="gap-1"
                    >
                      <Clock className="h-3 w-3" />
                      Отметить время
                    </Button>
                    {commentTimestamp !== null && (
                      <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded">
                        {formatTime(commentTimestamp)}
                        <button 
                          onClick={() => setCommentTimestamp(null)}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3 inline" />
                        </button>
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <CommentInput
                      placeholder="Комментарий к аудио..."
                      value={newAudioComment}
                      onChange={setNewAudioComment}
                      onKeyDown={(e) => e.key === 'Enter' && addAudioComment()}
                    />
                    <Button onClick={addAudioComment} size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Audio Comments */}
                {audioComments[currentAudio.id]?.length > 0 && (
                  <div className="space-y-2 pt-4 border-t">
                    <h4 className="text-sm font-medium">Комментарии к треку</h4>
                    {audioComments[currentAudio.id].map((comment) => (
                    <div key={comment.id} className="space-y-2">
                      <div className="flex gap-3 p-2 rounded-lg bg-secondary/50">
                        {editingCommentId === comment.id ? (
                          // Edit mode
                          <div className="flex-1 space-y-2">
                            {isAdmin && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Время:</span>
                                <div className="flex items-center gap-1">
                                  {/* Minutes */}
                                  <div className="flex flex-col items-center gap-0.5">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-5 w-5 bg-background"
                                      onClick={() => setEditMinutesClamped(editMinutes + 1)}
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={getMaxMinutes()}
                                      value={editMinutes}
                                      onChange={(e) => setEditMinutesClamped(Math.max(0, parseInt(e.target.value) || 0))}
                                      className="h-7 w-12 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-5 w-5 bg-background"
                                      onClick={() => setEditMinutesClamped(Math.max(0, editMinutes - 1))}
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <span className="text-sm font-medium">:</span>
                                  {/* Seconds */}
                                  <div className="flex flex-col items-center gap-0.5">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-5 w-5 bg-background"
                                      onClick={() => setEditSecondsClamped(editSeconds >= 59 ? 0 : editSeconds + 1)}
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={getMaxSeconds(editMinutes)}
                                      value={editSeconds.toString().padStart(2, '0')}
                                      onChange={(e) => setEditSecondsClamped(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                                      className="h-7 w-12 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-5 w-5 bg-background"
                                      onClick={() => setEditSecondsClamped(editSeconds <= 0 ? 59 : editSeconds - 1)}
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={setCurrentTimeForEdit}
                                >
                                  Текущее
                                </Button>
                              </div>
                            )}
                            <CommentInput
                              value={editContent}
                              onChange={setEditContent}
                              className="text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button size="sm" className="h-7" onClick={() => saveEditComment('audio')}>
                                <Check className="h-3 w-3 mr-1" />
                                Сохранить
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7" onClick={cancelEdit}>
                                Отмена
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // View mode
                          <>
                            {comment.timestamp_seconds !== null && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-primary"
                                onClick={() => seekTo(comment.timestamp_seconds!)}
                              >
                                {formatTime(comment.timestamp_seconds)}
                              </Button>
                            )}
                            <div className="flex-1">
                              <div className="text-sm"><CommentContent content={comment.content} chords={comment.chords} chordMap={chordMap} onChordClick={(chord) => playArpeggio(chord.fret_positions as number[])} /></div>
                              <p className="text-xs text-muted-foreground">
                                <AdminUserHoverCard
                                  userId={comment.user_id || ''}
                                  userName={comment.user?.display_name || 'Пользователь'}
                                  isAdmin={isAdmin}
                                >
                                  <span>{comment.user?.display_name}</span>
                                </AdminUserHoverCard>
                                {' · '}
                                {format(new Date(comment.created_at), 'd MMM, HH:mm', { locale: ru })}
                              </p>
                              <button
                                onClick={() => setAudioReplyingTo(audioReplyingTo === comment.id ? null : comment.id)}
                                className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <Reply className="h-3 w-3" />
                                Ответить
                              </button>
                            </div>
                            {canEditComment(comment) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                onClick={() => startEditComment(comment, 'audio')}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => deleteComment(comment.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                      
                      {/* Reply form for audio comment */}
                      {audioReplyingTo === comment.id && (
                        <div className="flex gap-2 ml-6">
                          <CommentInput
                            value={audioReplyText}
                            onChange={setAudioReplyText}
                            placeholder="Ответ..."
                            className="flex-1 h-8 text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && addAudioReply()}
                            autoFocus
                          />
                          <Button size="sm" className="h-8" onClick={addAudioReply} disabled={!audioReplyText.trim()}>
                            <Send className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAudioReplyingTo(null); setAudioReplyText('') }}>
                            Отмена
                          </Button>
                        </div>
                      )}
                      
                      {/* Replies to audio comment */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="ml-6 space-y-2">
                          {comment.replies.map((reply) => (
                            <div key={reply.id} className="p-2 rounded-lg bg-secondary/30">
                              {editingCommentId === reply.id ? (
                                <div className="space-y-2">
                                  <CommentInput
                                    value={editContent}
                                    onChange={setEditContent}
                                    className="text-sm h-8"
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <Button size="sm" className="h-6 text-xs" onClick={() => saveEditComment('audio')}>
                                      <Check className="h-2.5 w-2.5 mr-1" />
                                      Сохранить
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={cancelEdit}>
                                      Отмена
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="text-sm"><CommentContent content={reply.content} chords={reply.chords} chordMap={chordMap} onChordClick={(chord) => playArpeggio(chord.fret_positions as number[])} /></div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      <AdminUserHoverCard
                                        userId={reply.user_id || ''}
                                        userName={reply.user?.display_name || 'Пользователь'}
                                        isAdmin={isAdmin}
                                      >
                                        <span>{reply.user?.display_name}</span>
                                      </AdminUserHoverCard>
                                      {' · '}
                                      {format(new Date(reply.created_at), 'd MMM, HH:mm', { locale: ru })}
                                    </p>
                                  </div>
                                  {canEditComment(reply) && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                      onClick={() => startEditComment(reply, 'audio')}
                                    >
                                      <Pencil className="h-2.5 w-2.5" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-destructive hover:text-destructive"
                                    onClick={() => deleteComment(reply.id)}
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Audio Files Section - below the player */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                Аудиофайлы
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                <div className="flex flex-col items-center justify-center">
                  {uploading ? (
                    <div className="animate-pulse text-muted-foreground">Загрузка...</div>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                      <p className="text-sm text-muted-foreground">Загрузить аудиофайл</p>
                      <p className="text-xs text-muted-foreground/70">MP3, WAV до 100MB</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  disabled={uploading}
                />
              </label>

              {/* Audio List */}
              {audioFiles.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Нет аудиофайлов</p>
              ) : (
                <div className="space-y-2">
                  {audioFiles.map((audio) => {
                    const comments = audioComments[audio.id] || []
                    return (
                      <div 
                        key={audio.id}
                        className={`p-3 rounded-lg transition-colors ${
                          currentAudio?.id === audio.id 
                            ? 'bg-primary/10 border border-primary/50' 
                            : 'bg-secondary/50 hover:bg-secondary'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 shrink-0"
                            onClick={() => playAudio(audio)}
                          >
                            {currentAudio?.id === audio.id && isPlaying ? (
                              <Pause className="h-5 w-5" />
                            ) : (
                              <Play className="h-5 w-5" />
                            )}
                          </Button>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{audio.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {comments.length} комментариев
                              {audio.duration_seconds && ` · ${formatTime(audio.duration_seconds)}`}
                            </p>
                          </div>
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground shrink-0"
                            title="Скачать трек"
                          >
                            <a
                              href={`/api/download?audio=${encodeURIComponent(audio.id)}`}
                              download={audio.filename}
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive shrink-0"
                            onClick={() => deleteAudioFile(audio.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {/* Song tagging */}
                        {isAdmin && (
                          <div className="mt-2">
                            <SongTagSelect
                              value={audio.song_text_id}
                              songs={allSongs}
                              onChange={(songId) => setAudioSong(audio.id, songId)}
                            />
                          </div>
                        )}
                        {/* Comments preview */}
                        {comments.length > 0 && (
                          <div className="mt-2 ml-13 pl-10 border-l-2 border-border/50 space-y-1.5">
                            {comments.slice(0, 3).map((comment) => (
                              <div 
                                key={comment.id} 
                                className="flex items-start gap-2 text-sm"
                              >
                                {comment.timestamp_seconds !== null ? (
                                  <button
                                    onClick={() => {
                                      playAudio(audio)
                                      setTimeout(() => seekTo(comment.timestamp_seconds!), 100)
                                    }}
                                    className="text-primary hover:underline font-mono text-xs shrink-0 mt-0.5 cursor-pointer"
                                  >
                                    {formatTime(comment.timestamp_seconds)}
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground/50 font-mono text-xs shrink-0 mt-0.5">--:--</span>
                                )}
                                <p className="text-muted-foreground line-clamp-1">
                                  <CommentContent content={comment.content} />
                                </p>
                              </div>
                            ))}
                            {comments.length > 3 && (
                              <p className="text-xs text-muted-foreground/70">
                                + ещё {comments.length - 3}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attached Videos */}
          {rehearsalVideos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Прикреплённые видео
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-2">
                  {rehearsalVideos.map((video) => (
                    <div
                      key={video.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        currentVideo?.id === video.id
                          ? 'bg-primary/10 border border-primary/50'
                          : 'bg-secondary/50 hover:bg-secondary'
                      }`}
                      onClick={() => selectVideo(video)}
                    >
                      <div className="flex items-center gap-3">
                        {video.thumbnail_url ? (
                          <img
                            src={resolveAssetUrl(video.thumbnail_url) ?? video.thumbnail_url}
                            alt={video.title}
                            className="w-20 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-20 h-12 bg-muted rounded flex items-center justify-center">
                            <Video className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{video.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {video.video_type}
                            {!video.is_published && ' · Неопубликовано'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Video Player */}
          {currentVideo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Видео: {currentVideo.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setCurrentVideo(null)
                      setVideoComments([])
                      setIsPlayerReady(false)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Video Embed */}
                <div className="aspect-video rounded-lg overflow-hidden bg-black">
                  {currentVideo.video_type === 'youtube' ? (
                    <div ref={playerContainerRef} className="w-full h-full" />
                  ) : (
                    <iframe
                      src={getEmbedUrl(currentVideo.video_type, currentVideo.video_url)}
                      className="w-full h-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      title={currentVideo.title}
                    />
                  )}
                </div>

                {/* Timestamp picker for YouTube videos */}
                {currentVideo.video_type === 'youtube' && (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-secondary/30 rounded-lg">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Метка времени:</span>
                    <div className="flex items-center gap-1 font-mono text-sm">
                      <span className="w-8 h-8 flex items-center justify-center bg-background border rounded">
                        {timestampHours.toString().padStart(2, '0')}
                      </span>
                      <span className="text-muted-foreground font-bold">:</span>
                      <span className="w-8 h-8 flex items-center justify-center bg-background border rounded">
                        {timestampMinutes.toString().padStart(2, '0')}
                      </span>
                      <span className="text-muted-foreground font-bold">:</span>
                      <span className="w-8 h-8 flex items-center justify-center bg-background border rounded">
                        {timestampSeconds.toString().padStart(2, '0')}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={insertTimestampToVideoComment}
                      className="h-8"
                    >
                      Вставить
                    </Button>
                    <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">
                      Время синхронизируется с видео
                    </span>
                  </div>
                )}

                {/* Add Video Comment */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <CommentInput
                      placeholder="Комментарий к видео..."
                      value={newVideoComment}
                      onChange={setNewVideoComment}
                      onKeyDown={(e) => e.key === 'Enter' && addVideoComment()}
                    />
                    <Button onClick={addVideoComment} size="icon" disabled={!newVideoComment.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Метки времени (например, 00:01:23) станут кликабельными ссылками на момент видео
                  </p>
                </div>

                {/* Video Comments */}
                {videoComments.length > 0 && (
                  <div className="space-y-2 pt-4 border-t">
                    <h4 className="text-sm font-medium">Комментарии к видео</h4>
                    {videoComments.map((comment) => (
                      <div key={comment.id} className="space-y-2">
                        <div className="flex gap-3 p-2 rounded-lg bg-secondary/50 group">
                          <div className="flex-1">
                            <p className="text-sm">
                              <CommentContent content={comment.content} chords={comment.chords} chordMap={chordMap} onChordClick={(chord) => playArpeggio(chord.fret_positions as number[])} onTimestampClick={seekVideoToTime} />
                            </p>
                            <p className="text-xs text-muted-foreground">
                              <AdminUserHoverCard
                                userId={comment.user_id || ''}
                                userName={comment.user?.display_name || 'Пользователь'}
                                isAdmin={isAdmin}
                              >
                                <span>{comment.user?.display_name}</span>
                              </AdminUserHoverCard>
                              {' · '}
                              {format(new Date(comment.created_at), 'd MMM, HH:mm', { locale: ru })}
                            </p>
                            <button
                              onClick={() => setVideoReplyingTo(videoReplyingTo === comment.id ? null : comment.id)}
                              className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <Reply className="h-3 w-3" />
                              Ответить
                            </button>
                          </div>
                          {canEditComment(comment) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                              onClick={() => deleteVideoComment(comment.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>

                        {/* Reply form */}
                        {videoReplyingTo === comment.id && (
                          <div className="flex gap-2 ml-6">
                            <CommentInput
                              value={videoReplyText}
                              onChange={setVideoReplyText}
                              placeholder="Ответ..."
                              className="flex-1 h-8 text-sm"
                              onKeyDown={(e) => e.key === 'Enter' && addVideoReply()}
                              autoFocus
                            />
                            <Button size="sm" className="h-8" onClick={addVideoReply} disabled={!videoReplyText.trim()}>
                              <Send className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setVideoReplyingTo(null); setVideoReplyText('') }}>
                              Отмена
                            </Button>
                          </div>
                        )}

                        {/* Replies */}
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="ml-6 space-y-2">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} className="p-2 rounded-lg bg-secondary/30 group">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="text-sm">
                                      <CommentContent content={reply.content} chords={reply.chords} chordMap={chordMap} onChordClick={(chord) => playArpeggio(chord.fret_positions as number[])} onTimestampClick={seekVideoToTime} />
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      <AdminUserHoverCard
                                        userId={reply.user_id || ''}
                                        userName={reply.user?.display_name || 'Пользователь'}
                                        isAdmin={isAdmin}
                                      >
                                        <span>{reply.user?.display_name}</span>
                                      </AdminUserHoverCard>
                                      {' · '}
                                      {format(new Date(reply.created_at), 'd MMM, HH:mm', { locale: ru })}
                                    </p>
                                  </div>
                                  {canEditComment(reply) && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                                      onClick={() => deleteVideoComment(reply.id)}
                                    >
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Video Selection & Comments */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Видеозаписи
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Выберите видео для репетиции</label>
                <p className="text-xs text-muted-foreground">
                  Выберите видео, которые будут привязаны к этой репетиции
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
                              {!video.is_published && ' · Неопубликовано'}
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {selectedVideoIds.length > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Выбрано видео: {selectedVideoIds.length}
                    </p>
                    <Button onClick={saveRehearsalVideos} size="sm">
                      Сохранить выбор
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>


          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Комментарии к репетиции
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Comment */}
              <div className="flex gap-2">
                <CommentInput
                  multiline
                  placeholder="Добавить комментарий..."
                  value={newComment}
                  onChange={setNewComment}
                  className="min-h-[80px]"
                />
              </div>
              <Button onClick={addRehearsalComment} className="w-full gap-2">
                <Send className="h-4 w-4" />
                Отправить
              </Button>

              {/* Comments List */}
              {comments.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Нет комментариев</p>
              ) : (
                <div className="space-y-3 pt-4 border-t">
                  {comments.map((comment) => (
                    <div key={comment.id} className="space-y-2">
                      <div className="p-3 rounded-lg bg-secondary/50">
                        {editingCommentId === comment.id ? (
                          // Edit mode
                          <div className="space-y-2">
                            <CommentInput
                              value={editContent}
                              onChange={setEditContent}
                              className="text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button size="sm" className="h-7" onClick={() => saveEditComment('rehearsal')}>
                                <Check className="h-3 w-3 mr-1" />
                                Сохранить
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7" onClick={cancelEdit}>
                                Отмена
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // View mode
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="text-sm"><CommentContent content={comment.content} chords={comment.chords} chordMap={chordMap} onChordClick={(chord) => playArpeggio(chord.fret_positions as number[])} /></div>
                              <p className="text-xs text-muted-foreground mt-1">
                                <AdminUserHoverCard
                                  userId={comment.user_id || ''}
                                  userName={comment.user?.display_name || 'Пользователь'}
                                  isAdmin={isAdmin}
                                >
                                  <span>{comment.user?.display_name}</span>
                                </AdminUserHoverCard>
                                {' · '}
                                {format(new Date(comment.created_at), 'd MMM yyyy, HH:mm', { locale: ru })}
                              </p>
                              <button
                                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                                className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                              >
                                <Reply className="h-3 w-3" />
                                Ответить
                              </button>
                            </div>
                            {canEditComment(comment) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                onClick={() => startEditComment(comment, 'rehearsal')}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => deleteComment(comment.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Reply form */}
                      {replyingTo === comment.id && (
                        <div className="flex gap-2 ml-6">
                          <CommentInput
                            value={replyText}
                            onChange={setReplyText}
                            placeholder="Ответ..."
                            className="flex-1 h-8 text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && addRehearsalReply()}
                            autoFocus
                          />
                          <Button size="sm" className="h-8" onClick={addRehearsalReply} disabled={!replyText.trim()}>
                            <Send className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setReplyingTo(null); setReplyText('') }}>
                            Отмена
                          </Button>
                        </div>
                      )}

                      {/* Replies */}
                      {comment.replies.length > 0 && (
                        <div className="ml-6 space-y-2">
                          {comment.replies.map((reply) => (
                            <div key={reply.id} className="p-2 rounded-lg bg-secondary/30 border border-border/50">
                              {editingCommentId === reply.id ? (
                                // Edit mode for reply
                                <div className="space-y-2">
                                  <CommentInput
                                    value={editContent}
                                    onChange={setEditContent}
                                    className="text-sm h-8"
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <Button size="sm" className="h-6 text-xs" onClick={() => saveEditComment('rehearsal')}>
                                      <Check className="h-2.5 w-2.5 mr-1" />
                                      Сохранить
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={cancelEdit}>
                                      Отмена
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                // View mode for reply
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="text-sm"><CommentContent content={reply.content} chords={reply.chords} chordMap={chordMap} onChordClick={(chord) => playArpeggio(chord.fret_positions as number[])} /></div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      <AdminUserHoverCard
                                        userId={reply.user_id || ''}
                                        userName={reply.user?.display_name || 'Пользователь'}
                                        isAdmin={isAdmin}
                                      >
                                        <span>{reply.user?.display_name}</span>
                                      </AdminUserHoverCard>
                                      {' · '}
                                      {format(new Date(reply.created_at), 'd MMM, HH:mm', { locale: ru })}
                                    </p>
                                  </div>
                                  {canEditComment(reply) && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                      onClick={() => startEditComment(reply, 'rehearsal')}
                                    >
                                      <Pencil className="h-2.5 w-2.5" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-destructive hover:text-destructive"
                                    onClick={() => deleteComment(reply.id)}
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
