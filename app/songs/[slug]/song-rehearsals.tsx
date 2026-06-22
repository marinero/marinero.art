'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Play,
  Pause,
  Music,
  Video as VideoIcon,
  Headphones,
  MessageSquare,
  Send,
  Clock,
  X,
  Reply,
  Trash2,
  Calendar as CalendarIcon,
} from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import Link from 'next/link'
import { MultitrackPlayer } from '@/components/multitrack'
import { resolveAudioUrl } from '@/lib/storage-keys'
import { adminRehearsalUrl } from '@/lib/rehearsal-url'
import type { AudioFile, Video, MultitrackGroup } from '@/lib/types'

export interface RehearsalTake {
  rehearsal_id: string
  rehearsal_date: string
  audio: (AudioFile & { rehearsal_date: string })[]
  multitracks: (MultitrackGroup & { rehearsal_date: string })[]
}

interface ApiComment {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id: string | null
  timestamp_seconds?: number | null
  user: { display_name: string } | null
  replies: ApiComment[]
}

// ---------- helpers ----------

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function parseTimestamp(timestamp: string): number | null {
  const parts = timestamp.split(':').map((p) => parseInt(p, 10))
  if (parts.some(isNaN)) return null
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

function extractVideoInfo(url: string): { type: Video['video_type']; id: string } {
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
  )
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] }
  const vkMatch = url.match(/vk\.com\/video(-?\d+_\d+)/)
  if (vkMatch) return { type: 'vk', id: vkMatch[1] }
  const rutubeMatch = url.match(/rutube\.ru\/video\/([a-zA-Z0-9]+)/)
  if (rutubeMatch) return { type: 'rutube', id: rutubeMatch[1] }
  return { type: 'custom', id: url }
}

function getEmbedUrl(videoType: Video['video_type'], videoUrl: string): string {
  const info = extractVideoInfo(videoUrl)
  switch (videoType) {
    case 'vk':
      return `https://vk.com/video_ext.php?oid=${info.id.split('_')[0]}&id=${info.id.split('_')[1]}`
    case 'rutube':
      return `https://rutube.ru/play/embed/${info.id}`
    default:
      return videoUrl
  }
}

// YouTube IFrame typings (kept local to avoid global declaration clashes)
interface YTPlayer {
  getCurrentTime(): number
  getPlayerState(): number
  seekTo(seconds: number, allowSeekAhead?: boolean): void
  playVideo(): void
  cueVideoById(options: { videoId: string; startSeconds?: number }): void
  destroy(): void
}
type YTWindow = Window & {
  YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer }
  onYouTubeIframeAPIReady?: () => void
}

// ---------- main component ----------

export function SongRehearsals({
  rehearsals,
  videos,
  songSlug,
  isAdmin,
}: {
  rehearsals: RehearsalTake[]
  videos: Video[]
  songSlug: string
  isAdmin: boolean
}) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.id) setCurrentUserId(d.user.id)
      })
      .catch(() => {})
  }, [])

  // Load the YouTube IFrame API once if any youtube video is present
  useEffect(() => {
    const hasYouTube = videos.some((v) => v.video_type === 'youtube')
    if (!hasYouTube || typeof window === 'undefined') return
    const w = window as YTWindow
    if (w.YT?.Player) return
    if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) return
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.body.appendChild(tag)
  }, [videos])

  const totalRehearsalTakes = rehearsals.reduce(
    (acc, r) => acc + r.audio.length + r.multitracks.length,
    0
  )

  return (
    <div className="space-y-6">
      {/* Rehearsal recordings + multitracks — internal, admins only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-primary" />
              Записи с репетиций
              {totalRehearsalTakes > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({totalRehearsalTakes})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {rehearsals.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">
                Пока нет записей или мультитреков, привязанных к этой песне.
                Привяжите их на странице репетиции.
              </p>
            ) : (
              rehearsals.map((take) => {
                const takeCount = take.audio.length + take.multitracks.length
                return (
                  <section
                    key={take.rehearsal_id}
                    className="rounded-xl border border-border bg-secondary overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-primary/10 border-b border-primary/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
                        <Link
                          href={adminRehearsalUrl(take.rehearsal_date)}
                          className="font-display font-semibold hover:text-primary transition-colors truncate"
                        >
                          Репетиция{' '}
                          {format(new Date(take.rehearsal_date), 'd MMMM yyyy', { locale: ru })}
                        </Link>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        {takeCount}{' '}
                        {takeCount === 1 ? 'запись' : takeCount < 5 ? 'записи' : 'записей'}
                      </span>
                    </div>

                    <div className="p-2 space-y-2">
                      {take.audio.map((file) => (
                        <AudioTrack
                          key={file.id}
                          file={file}
                          currentUserId={currentUserId}
                        />
                      ))}

                      {take.multitracks.map((group) => (
                        <MultitrackPlayer
                          key={group.id}
                          group={group}
                          currentUserId={currentUserId}
                          isAdmin={true}
                        />
                      ))}
                    </div>
                  </section>
                )
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* Videos tagged with this song (independent of rehearsals) */}
      {videos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <VideoIcon className="h-5 w-5 text-primary" />
              Видео
              <span className="text-sm font-normal text-muted-foreground">
                ({videos.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {videos.map((video) => (
              <VideoTrack
                key={video.id}
                video={video}
                songSlug={songSlug}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------- comment helpers (shared UI) ----------

async function fetchComments(
  type: 'audio' | 'video',
  objectId: string
): Promise<ApiComment[]> {
  const res = await fetch(
    `/api/comments?type=${type}&object_id=${encodeURIComponent(objectId)}`
  )
  if (!res.ok) return []
  const data = await res.json()
  return data.comments || []
}

async function postComment(body: Record<string, unknown>) {
  return fetch('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function notifyReply(
  parentCommentId: string,
  replyContent: string,
  contextType: string,
  contextUrl: string
) {
  try {
    await fetch('/api/notifications/comment-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentCommentId, replyContent, contextType, contextUrl }),
    })
  } catch {
    // best-effort
  }
}

// ---------- audio track ----------

function AudioTrack({
  file,
  currentUserId,
}: {
  file: AudioFile & { rehearsal_date: string }
  currentUserId: string | null
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(file.duration_seconds || 0)
  const [comments, setComments] = useState<ApiComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentTs, setCommentTs] = useState<number | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    fetchComments('audio', file.id).then(setComments)
  }, [file.id])

  async function togglePlay() {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }

    setLoadError(null)
    try {
      await audioRef.current.play()
      setIsPlaying(true)
    } catch (error) {
      console.error('Audio playback failed:', error)
      setLoadError('Не удалось воспроизвести файл')
      setIsPlaying(false)
    }
  }

  async function seekTo(time: number) {
    if (!audioRef.current) return
    audioRef.current.currentTime = time
    setCurrentTime(time)
    if (!isPlaying) {
      setLoadError(null)
      try {
        await audioRef.current.play()
        setIsPlaying(true)
      } catch (error) {
        console.error('Audio playback failed:', error)
        setLoadError('Не удалось воспроизвести файл')
      }
    }
  }

  async function addComment() {
    if (!newComment.trim()) return
    const res = await postComment({
      type: 'audio',
      object_id: file.id,
      content: newComment.trim(),
      timestamp_seconds: commentTs,
    })
    if (res.ok) {
      setNewComment('')
      setCommentTs(null)
      setComments(await fetchComments('audio', file.id))
    }
  }

  async function addReply(parentId: string) {
    if (!replyText.trim()) return
    const content = replyText.trim()
    const res = await postComment({
      type: 'audio',
      object_id: file.id,
      content,
      parent_id: parentId,
    })
    if (res.ok) {
      notifyReply(
        parentId,
        content,
        'audio',
        adminRehearsalUrl(file.rehearsal_date, { audio: file.id })
      )
      setReplyText('')
      setReplyingTo(null)
      setComments(await fetchComments('audio', file.id))
    }
  }

  async function deleteComment(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
    if (res.ok) setComments(await fetchComments('audio', file.id))
  }

  return (
    <Card className="border-border/70 bg-background/50 py-0 gap-0 shadow-none">
      <CardContent className="px-3 py-1.5 space-y-2">
        <audio
          ref={audioRef}
          src={resolveAudioUrl(file.file_url) || undefined}
          preload="metadata"
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
          onLoadedMetadata={() => {
            const d = audioRef.current?.duration
            if (d && isFinite(d) && d > 0) setDuration(d)
          }}
          onEnded={() => setIsPlaying(false)}
          onError={() => {
            setLoadError('Не удалось загрузить аудио')
            setIsPlaying(false)
          }}
        />

        {loadError && (
          <p className="text-xs text-destructive">{loadError}</p>
        )}

        <div className="flex items-center gap-2 min-w-0">
          <Music className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-sm font-medium truncate">{file.filename}</p>
        </div>

        <div className="flex items-start gap-2.5">
          <Button
            size="icon"
            className="h-8 w-8 rounded-full shrink-0 mt-1"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="flex-1 min-w-0 pt-1 pb-0.5">
            <Slider
              value={[currentTime]}
              max={duration && isFinite(duration) ? duration : 100}
              step={1}
              onValueChange={(v) => seekTo(v[0])}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
              <span>{formatTime(currentTime)}</span>
              <span>{duration > 0 && isFinite(duration) ? formatTime(duration) : '--:--'}</span>
            </div>
          </div>
        </div>

        {/* Add comment with timestamp */}
        {currentUserId && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 shrink-0"
              onClick={() => setCommentTs(Math.floor(currentTime))}
            >
              <Clock className="h-3 w-3" />
              Время
            </Button>
            {commentTs !== null && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded shrink-0">
                {formatTime(commentTs)}
                <button onClick={() => setCommentTs(null)} className="ml-1.5 hover:text-destructive">
                  <X className="h-3 w-3 inline" />
                </button>
              </span>
            )}
            <Input
              placeholder="Комментарий к записи..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addComment()}
              className="h-8"
            />
            <Button onClick={addComment} size="icon" className="h-8 w-8 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}

        <CommentList
          comments={comments}
          currentUserId={currentUserId}
          isAdmin={true}
          replyingTo={replyingTo}
          replyText={replyText}
          onReplyTextChange={setReplyText}
          onStartReply={(id) => setReplyingTo(replyingTo === id ? null : id)}
          onSubmitReply={addReply}
          onDelete={deleteComment}
          onTimestampClick={(seconds) => seekTo(seconds)}
        />
      </CardContent>
    </Card>
  )
}

// ---------- video track ----------

function VideoTrack({
  video,
  songSlug,
  currentUserId,
  isAdmin,
}: {
  video: Video
  songSlug: string
  currentUserId: string | null
  isAdmin: boolean
}) {
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const ytPlayerRef = useRef<YTPlayer | null>(null)
  const pendingSeekRef = useRef<number | null>(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [comments, setComments] = useState<ApiComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  const isYouTube = video.video_type === 'youtube'

  useEffect(() => {
    fetchComments('video', video.id).then(setComments)
  }, [video.id])

  // Init YouTube player
  useEffect(() => {
    if (!isYouTube || !video.video_url) return
    const info = extractVideoInfo(video.video_url)

    function initPlayer() {
      if (!playerContainerRef.current) return
      const w = window as YTWindow
      if (!w.YT?.Player) return
      ytPlayerRef.current = new w.YT.Player(playerContainerRef.current, {
        videoId: info.id,
        playerVars: { enablejsapi: 1, origin: window.location.origin },
        events: {
          onReady: () => setIsPlayerReady(true),
          onStateChange: (event: { data: number }) => {
            if (event.data === 1 && pendingSeekRef.current !== null) {
              const target = pendingSeekRef.current
              pendingSeekRef.current = null
              setTimeout(() => ytPlayerRef.current?.seekTo(target, true), 100)
            }
          },
        },
      })
    }

    const w = window as YTWindow
    if (w.YT?.Player) {
      initPlayer()
    } else {
      const prev = w.onYouTubeIframeAPIReady
      w.onYouTubeIframeAPIReady = () => {
        prev?.()
        initPlayer()
      }
    }

    return () => {
      ytPlayerRef.current?.destroy()
      ytPlayerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id])

  function seekVideoToTime(seconds: number) {
    if (!isYouTube || !ytPlayerRef.current) return
    try {
      const state = ytPlayerRef.current.getPlayerState()
      if (state === -1 || state === 5) {
        const info = extractVideoInfo(video.video_url)
        ytPlayerRef.current.cueVideoById({ videoId: info.id, startSeconds: seconds })
      } else {
        ytPlayerRef.current.seekTo(seconds, true)
        ytPlayerRef.current.playVideo()
      }
    } catch {
      pendingSeekRef.current = seconds
      ytPlayerRef.current?.playVideo()
    }
  }

  async function addComment() {
    if (!newComment.trim()) return
    const res = await postComment({
      type: 'video',
      object_id: video.id,
      content: newComment.trim(),
    })
    if (res.ok) {
      setNewComment('')
      setComments(await fetchComments('video', video.id))
    }
  }

  async function addReply(parentId: string) {
    if (!replyText.trim()) return
    const content = replyText.trim()
    const res = await postComment({
      type: 'video',
      object_id: video.id,
      content,
      parent_id: parentId,
    })
    if (res.ok) {
      notifyReply(parentId, content, 'video', `/songs/${songSlug}`)
      setReplyText('')
      setReplyingTo(null)
      setComments(await fetchComments('video', video.id))
    }
  }

  async function deleteComment(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
    if (res.ok) setComments(await fetchComments('video', video.id))
  }

  return (
    <Card className="border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <VideoIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="font-medium truncate">{video.title}</p>
        </div>

        <div className="aspect-video rounded-lg overflow-hidden bg-black">
          {isYouTube ? (
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

        {!isYouTube && (
          <p className="text-xs text-muted-foreground">
            Переход по меткам времени доступен только для YouTube-видео.
          </p>
        )}

        {/* Add comment */}
        {currentUserId && (
          <div className="flex gap-2">
            <Input
              placeholder="Комментарий к видео (метки 1:23 кликабельны)..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addComment()}
              className="h-8"
            />
            <Button onClick={addComment} size="icon" className="h-8 w-8 shrink-0" disabled={!newComment.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}

        <CommentList
          comments={comments}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          replyingTo={replyingTo}
          replyText={replyText}
          onReplyTextChange={setReplyText}
          onStartReply={(id) => setReplyingTo(replyingTo === id ? null : id)}
          onSubmitReply={addReply}
          onDelete={deleteComment}
          renderContent={isPlayerReady || isYouTube ? renderWithTimestamps(seekVideoToTime) : undefined}
        />
      </CardContent>
    </Card>
  )
}

// Render comment content with clickable inline timestamps (e.g. 1:23 / 01:02:03)
function renderWithTimestamps(onClick: (seconds: number) => void) {
  return function render(content: string) {
    const regex = /(\d{1,2}:\d{2}(?::\d{2})?)/g
    const parts = content.split(regex)
    return parts.map((part, i) => {
      const seconds = parseTimestamp(part)
      if (seconds !== null) {
        return (
          <button
            key={i}
            onClick={() => onClick(seconds)}
            className="text-primary hover:underline font-medium cursor-pointer"
          >
            {part}
          </button>
        )
      }
      return <span key={i}>{part}</span>
    })
  }
}

// ---------- shared comment list ----------

function CommentList({
  comments,
  currentUserId,
  isAdmin,
  replyingTo,
  replyText,
  onReplyTextChange,
  onStartReply,
  onSubmitReply,
  onDelete,
  onTimestampClick,
  renderContent,
}: {
  comments: ApiComment[]
  currentUserId: string | null
  isAdmin: boolean
  replyingTo: string | null
  replyText: string
  onReplyTextChange: (v: string) => void
  onStartReply: (id: string) => void
  onSubmitReply: (parentId: string) => void
  onDelete: (id: string) => void
  onTimestampClick?: (seconds: number) => void
  renderContent?: (content: string) => React.ReactNode
}) {
  const canDelete = (authorId: string) => isAdmin || authorId === currentUserId
  if (comments.length === 0) return null

  return (
    <div className="space-y-2 pt-2 border-t">
      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <MessageSquare className="h-3 w-3" />
        Комментарии ({comments.reduce((acc, c) => acc + 1 + c.replies.length, 0)})
      </h4>
      {comments.map((comment) => (
        <div key={comment.id} className="space-y-2">
          <div className="flex gap-2 p-2 rounded-lg bg-secondary/50">
            {comment.timestamp_seconds != null && onTimestampClick && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-primary shrink-0"
                onClick={() => onTimestampClick(comment.timestamp_seconds!)}
              >
                {formatTime(comment.timestamp_seconds)}
              </Button>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm break-words">
                {renderContent ? renderContent(comment.content) : comment.content}
              </p>
              <p className="text-xs text-muted-foreground">
                <span>{comment.user?.display_name || 'Пользователь'}</span>
                {' · '}
                {format(new Date(comment.created_at), 'd MMM, HH:mm', { locale: ru })}
              </p>
              {currentUserId && (
                <button
                  onClick={() => onStartReply(comment.id)}
                  className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Reply className="h-3 w-3" />
                  Ответить
                </button>
              )}
            </div>
            {canDelete(comment.user_id) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                onClick={() => onDelete(comment.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          {replyingTo === comment.id && (
            <div className="flex gap-2 ml-6">
              <Input
                value={replyText}
                onChange={(e) => onReplyTextChange(e.target.value)}
                placeholder="Ответ..."
                className="flex-1 h-8 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && onSubmitReply(comment.id)}
                autoFocus
              />
              <Button
                size="sm"
                className="h-8"
                onClick={() => onSubmitReply(comment.id)}
                disabled={!replyText.trim()}
              >
                <Send className="h-3 w-3" />
              </Button>
            </div>
          )}

          {comment.replies.length > 0 && (
            <div className="ml-6 space-y-2">
              {comment.replies.map((reply) => (
                <div key={reply.id} className="flex gap-2 p-2 rounded-lg bg-secondary/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm break-words">
                      {renderContent ? renderContent(reply.content) : reply.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span>{reply.user?.display_name || 'Пользователь'}</span>
                      {' · '}
                      {format(new Date(reply.created_at), 'd MMM, HH:mm', { locale: ru })}
                    </p>
                  </div>
                  {canDelete(reply.user_id) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-destructive hover:text-destructive shrink-0"
                      onClick={() => onDelete(reply.id)}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
