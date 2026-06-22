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
    // Player states
    const PlayerState: {
      UNSTARTED: -1
      ENDED: 0
      PLAYING: 1
      PAUSED: 2
      BUFFERING: 3
      CUED: 5
    }
  }
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { CommentInput } from '@/components/comments/comment-input'
import { CommentContent } from '@/components/comments/comment-content'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, MessageCircle, Send, Trash2, Loader2, Reply, Pencil, Check, Video as VideoIcon, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Video, Comment, Profile } from '@/lib/types'
import { AdminUserHoverCard } from '@/components/admin/user-hover-card'
import { fetchNormalizedComments, buildCommentTree } from '@/lib/comments-client'

type CommentWithProfile = Comment & { 
  profiles: Pick<Profile, 'display_name' | 'username' | 'role'>
  parent_id: string | null
  replies?: CommentWithProfile[]
}

// Extract video ID from various platform URLs
function extractVideoInfo(url: string): { type: Video['video_type']; id: string } | null {
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

// Generate embed URL based on video type
function getEmbedUrl(videoType: Video['video_type'], videoUrl: string, startTime?: number): string {
  const info = extractVideoInfo(videoUrl)
  if (!info) return videoUrl
  
  switch (videoType) {
    case 'youtube':
      let url = `https://www.youtube.com/embed/${info.id}?enablejsapi=1`
      if (startTime) url += `&start=${startTime}`
      return url
    case 'vk':
      return `https://vk.com/video_ext.php?oid=${info.id.split('_')[0]}&id=${info.id.split('_')[1]}`
    case 'rutube':
      return `https://rutube.ru/play/embed/${info.id}`
    default:
      return videoUrl
  }
}

// Parse timestamp string (e.g., "1:23" or "01:23:45") to seconds
function parseTimestamp(timestamp: string): number | null {
  const parts = timestamp.split(':').map(p => parseInt(p, 10))
  if (parts.some(isNaN)) return null
  
  if (parts.length === 2) {
    // MM:SS format
    return parts[0] * 60 + parts[1]
  } else if (parts.length === 3) {
    // HH:MM:SS format
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return null
}

// Format seconds to timestamp string (e.g., "1:23" or "1:23:45")
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function VideoPage() {
  const params = useParams()
  const router = useRouter()
  const videoSlug = params.slug as string

  const [video, setVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<CommentWithProfile[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  
  // Edit state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  // Timestamp picker state
  const [timestampHours, setTimestampHours] = useState(0)
  const [timestampMinutes, setTimestampMinutes] = useState(0)
  const [timestampSeconds, setTimestampSeconds] = useState(0)

  // Pending seek target (used when player isn't ready yet)
  const pendingSeekRef = useRef<number | null>(null)

  // Video player ref
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const ytPlayerRef = useRef<YT.Player | null>(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)

  function formatTimestampForComment(hours: number, minutes: number, seconds: number): string {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    async function fetchData() {
      const profileRes = await fetch('/api/profile')
      if (profileRes.ok) {
        const { user: sessionUser, profile: profileData } = await profileRes.json()
        setUser(sessionUser)
        setProfile(profileData)
      }

      const res = await fetch(`/api/videos/${encodeURIComponent(videoSlug)}`)
      if (res.ok) {
        const { video: videoData } = await res.json()
        setVideo(videoData)
        fetchComments(videoData.id)
      }
      setLoading(false)
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoSlug])

  const fetchComments = useCallback(async (videoId: string) => {
    setLoadingComments(true)
    const normalized = await fetchNormalizedComments('video', videoId)
    const flat: CommentWithProfile[] = normalized.map((c) => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      user_id: c.user_id,
      parent_id: c.parent_id,
      type: 'video',
      object_id: c.object_id ?? videoId,
      timestamp_seconds: c.timestamp_seconds ?? null,
      profiles: c.profiles,
      replies: [],
    }))

    setComments(buildCommentTree(flat))
    setLoadingComments(false)
  }, [])

  // Insert timestamp into comment
  function insertTimestampToComment() {
    const timestamp = formatTimestampForComment(timestampHours, timestampMinutes, timestampSeconds)
    setNewComment(prev => prev + timestamp + ' ')
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

  // Initialize YouTube player when video is loaded
  useEffect(() => {
    if (!video || video.video_type !== 'youtube' || !video.video_url) {
      return
    }

    const videoInfo = extractVideoInfo(video.video_url)
    if (!videoInfo) return
    const youtubeVideoId = videoInfo.id

    function initPlayer() {
      console.log('[v0] initPlayer called, playerContainerRef:', !!playerContainerRef.current)
      if (!playerContainerRef.current) return
      
      // Destroy existing player
      if (ytPlayerRef.current) {
        console.log('[v0] Destroying existing player')
        ytPlayerRef.current.destroy()
        ytPlayerRef.current = null
      }

      console.log('[v0] Creating new YT.Player with videoId:', youtubeVideoId)
      // Create new player
      ytPlayerRef.current = new window.YT.Player(playerContainerRef.current, {
        videoId: youtubeVideoId,
        playerVars: {
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            console.log('[v0] YouTube player onReady')
            setIsPlayerReady(true)
          },
          onStateChange: (event: { data: number }) => {
            console.log('[v0] YouTube player onStateChange:', event.data)
            // YT.PlayerState.PLAYING = 1
            if (event.data === 1 && pendingSeekRef.current !== null) {
              // Player started playing, now seek to the pending timestamp
              const seekTarget = pendingSeekRef.current
              pendingSeekRef.current = null
              console.log('[v0] Executing pending seek to:', seekTarget)
              setTimeout(() => {
                if (ytPlayerRef.current) {
                  ytPlayerRef.current.seekTo(seekTarget, true)
                }
              }, 100)
            }
          }
        }
      })
      console.log('[v0] YT.Player created, ytPlayerRef.current:', !!ytPlayerRef.current)
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
  }, [video])

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

  // Seek video to specific timestamp (works for YouTube)
  function seekToTime(seconds: number) {
    console.log('[v0] seekToTime called with seconds:', seconds)
    console.log('[v0] video:', video?.video_type)
    console.log('[v0] ytPlayerRef.current:', !!ytPlayerRef.current)
    console.log('[v0] isPlayerReady:', isPlayerReady)
    
    if (!video) return
    
    // For YouTube, use the player API
    if (video.video_type === 'youtube' && ytPlayerRef.current) {
      try {
        const playerState = ytPlayerRef.current.getPlayerState()
        console.log('[v0] playerState:', playerState)
        
        // If player is unstarted (-1) or cued (5), use cueVideoById to prepare video at specific time
        // Browser autoplay policy blocks loadVideoById, so we cue and let user click play
        if (playerState === -1 || playerState === 5) {
          const videoInfo = extractVideoInfo(video.video_url)
          console.log('[v0] Using cueVideoById, videoInfo:', videoInfo)
          if (videoInfo) {
            // Cue the video at the specified time - user will need to click play
            ytPlayerRef.current.cueVideoById({ videoId: videoInfo.id, startSeconds: seconds })
            console.log('[v0] cueVideoById called - user needs to click play')
          }
        } else {
          // Player has been started before, just seek and play
          console.log('[v0] Using seekTo + playVideo')
          ytPlayerRef.current.seekTo(seconds, true)
          ytPlayerRef.current.playVideo()
        }
      } catch (err) {
        // Player might not be ready, try the fallback approach
        console.log('[v0] Error in seekToTime:', err)
        pendingSeekRef.current = seconds
        ytPlayerRef.current?.playVideo()
      }
    } else {
      console.log('[v0] Conditions not met - video type or player not ready')
    }
  }

  // Render text with clickable timestamps
  function renderDescriptionWithTimestamps(text: string) {
    // Match timestamps like 0:00, 1:23, 01:23, 1:23:45, 01:23:45
    const timestampRegex = /(\d{1,2}:\d{2}(?::\d{2})?)/g
    const parts = text.split(timestampRegex)
    
    return parts.map((part, index) => {
      const seconds = parseTimestamp(part)
      if (seconds !== null) {
        return (
          <button
            key={index}
            onClick={() => seekToTime(seconds)}
            className="text-primary hover:underline font-medium cursor-pointer"
          >
            {part}
          </button>
        )
      }
      return <span key={index}>{part}</span>
    })
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !video || !newComment.trim()) return

    setSubmitting(true)

    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'video',
        object_id: video.id,
        content: newComment.trim(),
        parent_id: null,
      }),
    })

    if (res.ok) {
      setNewComment('')
      fetchComments(video.id)
    }

    setSubmitting(false)
  }

  async function handleSubmitReply(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !video || !replyText.trim() || !replyingTo) return

    setSubmitting(true)
    const replyContentForEmail = replyText.trim()

    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'video',
        object_id: video.id,
        content: replyContentForEmail,
        parent_id: replyingTo,
      }),
    })

    if (res.ok) {
      try {
        await fetch('/api/notifications/comment-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentCommentId: replyingTo,
            replyContent: replyContentForEmail,
            contextType: 'video',
            contextId: video.id,
          }),
        })
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError)
      }

      setReplyText('')
      setReplyingTo(null)
      fetchComments(video.id)
    }

    setSubmitting(false)
  }

  async function handleDeleteComment(commentId: string) {
    await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
    if (video) {
      fetchComments(video.id)
    }
  }

  function startEditComment(comment: CommentWithProfile) {
    setEditingCommentId(comment.id)
    setEditContent(comment.content)
  }

  function cancelEdit() {
    setEditingCommentId(null)
    setEditContent('')
  }

  async function saveEditComment() {
    if (!editingCommentId || !editContent.trim()) return

    const response = await fetch(`/api/comments/${editingCommentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent.trim() })
    })

    if (response.ok) {
      cancelEdit()
      if (video) {
        fetchComments(video.id)
      }
    } else {
      const error = await response.json()
      alert(`Ошибка: ${error.error}`)
    }
  }

  function canEditComment(comment: CommentWithProfile) {
    return user?.id === comment.user_id || profile?.role === 'admin'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!video) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header user={user} isAdmin={profile?.role === 'admin'} displayName={profile?.display_name} />
        <main className="flex-1 container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Видео не найдено</h1>
          <Link href="/videos">
            <Button>Вернуться к видео</Button>
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} isAdmin={profile?.role === 'admin'} displayName={profile?.display_name} />

      <main className="flex-1">
        {/* Video Header */}
        <div className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-8">
            <Link
              href="/videos"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Все видео
            </Link>
            <h1 className="text-3xl font-bold">{video.title}</h1>
          </div>
        </div>

        {/* Video Player */}
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              {video.video_type === 'youtube' ? (
                <div ref={playerContainerRef} className="w-full h-full" />
              ) : (
                <iframe
                  src={getEmbedUrl(video.video_type, video.video_url)}
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  title={video.title}
                />
              )}
            </div>
            
            {/* Video Description */}
            {video.description && (
              <Card className="mt-6">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-3">Описание</h3>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {renderDescriptionWithTimestamps(video.description)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Comments Section */}
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold text-lg flex items-center gap-2 mb-6">
                  <MessageCircle className="h-5 w-5" />
                  Комментарии ({comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)})
                </h2>

                {/* Comment Form */}
                <div className="mb-6">
                  {user ? (
                    <div className="space-y-3">
                      {/* Timestamp picker */}
                      {video?.video_type === 'youtube' && (
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
                            onClick={insertTimestampToComment}
                            className="h-8"
                          >
                            Вставить
                          </Button>
                          <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">
                            Время синхронизируется с видео
                          </span>
                        </div>
                      )}
                      <form onSubmit={handleSubmitComment} className="flex gap-2">
                        <CommentInput
                          value={newComment}
                          onChange={setNewComment}
                          placeholder="Написать комментарий..."
                          className="flex-1"
                        />
                        <Button type="submit" disabled={submitting || !newComment.trim()}>
                          {submitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </form>
                      <p className="text-xs text-muted-foreground">
                        Метки времени (например, 00:01:23) станут кликабельными ссылками на момент видео
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-secondary/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        Войдите, чтобы оставить комментарий
                      </p>
                      <Link href="/auth/login">
                        <Button size="sm">Войти</Button>
                      </Link>
                    </div>
                  )}
                </div>

                {/* Comments List */}
                <div className="space-y-4">
                  {loadingComments ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : comments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Пока нет комментариев. Будьте первым!
                    </p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="space-y-2">
                        {/* Top-level comment */}
                        <div className="group p-4 rounded-lg bg-secondary/30">
                          {editingCommentId === comment.id ? (
                            <div className="space-y-2">
                              <CommentInput
                                value={editContent}
                                onChange={setEditContent}
                                className="text-sm"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button size="sm" className="h-7" onClick={saveEditComment}>
                                  <Check className="h-3 w-3 mr-1" />
                                  Сохранить
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7" onClick={cancelEdit}>
                                  Отмена
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <AdminUserHoverCard
                                    userId={comment.user_id}
                                    userName={comment.profiles?.display_name || comment.profiles?.username || 'Пользователь'}
                                    userRole={comment.profiles?.role}
                                    isAdmin={profile?.role === 'admin'}
                                  >
                                    <span className="font-medium text-sm">
                                      {comment.profiles?.display_name || comment.profiles?.username || 'Пользователь'}
                                    </span>
                                  </AdminUserHoverCard>
                                  {comment.profiles?.role === 'admin' && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium ml-1">
                                      Админ
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {format(new Date(comment.created_at), 'd MMM yyyy, HH:mm', { locale: ru })}
                                  </span>
                                </div>
                                <div className="flex gap-1">
                                  {canEditComment(comment) && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                                      onClick={() => startEditComment(comment)}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {(user?.id === comment.user_id || profile?.role === 'admin') && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                      onClick={() => handleDeleteComment(comment.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm mt-2">
                                <CommentContent content={comment.content} onTimestampClick={seekToTime} />
                              </p>
                              {user && (
                                <button
                                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                                  className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                                >
                                  <Reply className="h-3 w-3" />
                                  Ответить
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        {/* Reply form */}
                        {replyingTo === comment.id && (
                          <form onSubmit={handleSubmitReply} className="flex gap-2 ml-6">
                            <CommentInput
                              value={replyText}
                              onChange={setReplyText}
                              placeholder="Ответ..."
                              className="flex-1 h-9 text-sm"
                              disabled={submitting}
                              autoFocus
                            />
                            <Button type="submit" size="sm" disabled={submitting || !replyText.trim()}>
                              <Send className="h-3 w-3" />
                            </Button>
                          </form>
                        )}

                        {/* Replies */}
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="ml-6 pl-4 border-l border-border space-y-2">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} className="group p-3 rounded-lg bg-secondary/20">
                                {editingCommentId === reply.id ? (
                                  <div className="space-y-2">
                                    <CommentInput
                                      value={editContent}
                                      onChange={setEditContent}
                                      className="text-xs h-8"
                                      autoFocus
                                    />
                                    <div className="flex gap-2">
                                      <Button size="sm" className="h-6 text-xs" onClick={saveEditComment}>
                                        <Check className="h-2.5 w-2.5 mr-1" />
                                        Сохранить
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={cancelEdit}>
                                        Отмена
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <AdminUserHoverCard
                                          userId={reply.user_id}
                                          userName={reply.profiles?.display_name || reply.profiles?.username || 'Пользователь'}
                                          userRole={reply.profiles?.role}
                                          isAdmin={profile?.role === 'admin'}
                                        >
                                          <span className="font-medium text-xs">
                                            {reply.profiles?.display_name || reply.profiles?.username || 'Пользователь'}
                                          </span>
                                        </AdminUserHoverCard>
                                        {reply.profiles?.role === 'admin' && (
                                          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium ml-1">
                                            Админ
                                          </span>
                                        )}
                                        <span className="text-xs text-muted-foreground ml-2">
                                          {format(new Date(reply.created_at), 'd MMM, HH:mm', { locale: ru })}
                                        </span>
                                      </div>
                                      <div className="flex gap-1">
                                        {canEditComment(reply) && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                                            onClick={() => startEditComment(reply)}
                                          >
                                            <Pencil className="h-2.5 w-2.5" />
                                          </Button>
                                        )}
                                        {(user?.id === reply.user_id || profile?.role === 'admin') && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleDeleteComment(reply.id)}
                                          >
                                            <Trash2 className="h-2.5 w-2.5" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-xs mt-1">
                                      <CommentContent content={reply.content} onTimestampClick={seekToTime} />
                                    </p>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
