'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { fetchNormalizedComments, buildCommentTree } from '@/lib/comments-client'
import { resolveAssetUrl } from '@/lib/storage-keys'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { CommentInput } from '@/components/comments/comment-input'
import { CommentContent } from '@/components/comments/comment-content'
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  Ticket,
  DoorOpen,
  Navigation,
  ShieldCheck,
  Phone,
  MessageCircle,
  Send,
  Trash2,
  Loader2,
  Reply,
  Images,
  Video,
  Play,
} from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Event, Profile, Album, Video as VideoType } from '@/lib/types'
import { AdminUserHoverCard } from '@/components/admin/user-hover-card'

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

// Generate embed URL based on video type
function getEmbedUrl(videoType: VideoType['video_type'], videoUrl: string): string {
  const info = extractVideoInfo(videoUrl)
  if (!info) return videoUrl
  
  switch (videoType) {
    case 'youtube':
      return `https://www.youtube.com/embed/${info.id}`
    case 'vk':
      return `https://vk.com/video_ext.php?oid=${info.id.split('_')[0]}&id=${info.id.split('_')[1]}`
    case 'rutube':
      return `https://rutube.ru/play/embed/${info.id}`
    default:
      return videoUrl
  }
}

interface EventComment {
  id: string
  content: string
  created_at: string
  user_id: string
  user_name: string
  user_role: string
  parent_id: string | null
  replies: EventComment[]
}

export default function EventPage() {
  const params = useParams()
  const slug = decodeURIComponent(params.slug as string)

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [comments, setComments] = useState<EventComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [albums, setAlbums] = useState<Album[]>([])
  const [videos, setVideos] = useState<VideoType[]>([])

  useEffect(() => {
    async function fetchData() {
      const profileRes = await fetch('/api/profile')
      if (profileRes.ok) {
        const { user: sessionUser, profile: profileData } = await profileRes.json()
        setUser(sessionUser)
        setProfile(profileData)
        setIsAdmin(profileData?.role === 'admin')
      }

      const res = await fetch(`/api/events/${encodeURIComponent(slug)}`)
      if (res.ok) {
        const { event: eventData, albums: albumsData, videos: videosData } = await res.json()
        setEvent(eventData)
        setAlbums(albumsData || [])
        setVideos(videosData || [])
        fetchComments(eventData.id)
      }

      setLoading(false)
    }

    fetchData()
  }, [slug])

  const fetchComments = useCallback(async (eventId: string) => {
    const normalized = await fetchNormalizedComments('event', eventId)
    const flat: EventComment[] = normalized.map((c) => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      user_id: c.user_id,
      parent_id: c.parent_id,
      user_name: c.profiles.display_name || c.profiles.username || 'Пользователь',
      user_role: c.profiles.role,
      replies: [],
    }))

    setComments(buildCommentTree(flat))
  }, [])

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !event || !newComment.trim()) return

    setSubmitting(true)
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'event',
        object_id: event.id,
        content: newComment.trim(),
        parent_id: null,
      }),
    })

    if (res.ok) {
      setNewComment('')
      fetchComments(event.id)
    }
    setSubmitting(false)
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !event || !replyText.trim() || !replyingTo) return

    setSubmitting(true)
    const replyContentForEmail = replyText.trim()
    
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'event',
        object_id: event.id,
        content: replyContentForEmail,
        parent_id: replyingTo,
      }),
    })

    if (res.ok) {
      // Send email notification to the parent comment author
      try {
        await fetch('/api/notifications/comment-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentCommentId: replyingTo,
            replyContent: replyContentForEmail,
            contextType: 'event',
            contextId: event.id,
          }),
        })
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError)
        // Don't fail the reply if notification fails
      }

      setReplyText('')
      setReplyingTo(null)
      fetchComments(event.id)
    }
    setSubmitting(false)
  }

  async function deleteComment(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
    if (res.ok && event) {
      fetchComments(event.id)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header user={null} isAdmin={false} displayName={null} />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header user={null} isAdmin={false} displayName={null} />
        <main className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground text-lg">Событие не найдено</p>
          <Link href="/events">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              К списку концертов
            </Button>
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  const eventDate = new Date(event.event_date)

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} isAdmin={isAdmin} displayName={profile?.display_name || null} />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative">
          {resolveAssetUrl(event.image_url) && (
            <div className="relative w-full h-64 md:h-96">
              <Image
                src={resolveAssetUrl(event.image_url)!}
                alt={event.title}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            </div>
          )}

          <div className={`container mx-auto px-4 ${event.image_url ? '-mt-32 relative z-10' : 'pt-12'}`}>
            {/* Back button */}
            <Link href="/events" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
              <ArrowLeft className="h-4 w-4" />
              <span>Все концерты</span>
            </Link>

            {/* Main info block - answers "where, when, tickets?" in 5 seconds */}
            <div className="bg-card border border-border rounded-2xl p-6 md:p-10">
              {/* Date & Time - large and prominent */}
              <div className="flex items-center gap-3 text-primary mb-4">
                <Calendar className="h-5 w-5" />
                <span className="text-lg font-semibold">
                  {format(eventDate, 'd MMMM yyyy', { locale: ru })}
                </span>
                <span className="text-muted-foreground">|</span>
                <Clock className="h-5 w-5" />
                <span className="text-lg font-semibold">
                  {format(eventDate, 'HH:mm', { locale: ru })}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
                {event.title}
              </h1>

              {/* Location */}
              <div className="flex items-center gap-2 text-muted-foreground mb-6">
                <MapPin className="h-5 w-5 flex-shrink-0" />
                <span className="text-lg">
                  {event.venue}{event.city ? `, ${event.city}` : ''}
                </span>
              </div>

              {/* Buy tickets - large prominent button */}
              {event.ticket_url && (
                <a href={event.ticket_url} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="gap-2 text-base px-8 py-6">
                    <Ticket className="h-5 w-5" />
                    Купить билеты
                  </Button>
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Details Section */}
        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto space-y-10">

              {/* Description */}
              {event.description && (
                <div>
                  <p className="text-lg text-foreground/90 leading-relaxed whitespace-pre-line">
                    {event.description}
                  </p>
                </div>
              )}

              {/* Doors Time */}
              {event.doors_time && (
                <div className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border">
                  <DoorOpen className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">Открытие дверей</h3>
                    <p className="text-muted-foreground">{event.doors_time.slice(0, 5)}</p>
                  </div>
                </div>
              )}

              {/* Venue Address */}
              {event.venue_address && (
                <div className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border">
                  <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">Адрес площадки</h3>
                    <p className="text-muted-foreground">{event.venue_address}</p>
                  </div>
                </div>
              )}

              {/* Google Maps */}
              {event.venue_address && (
                <div className="rounded-xl overflow-hidden border border-border">
                  <iframe
                    src={`https://www.google.com/maps?q=${encodeURIComponent(event.venue_address)}&output=embed`}
                    width="100%"
                    height="350"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Карта"
                  />
                </div>
              )}

              {/* How to get there */}
              {event.how_to_get && (
                <div className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border">
                  <Navigation className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">Как добраться</h3>
                    <p className="text-muted-foreground whitespace-pre-line">{event.how_to_get}</p>
                  </div>
                </div>
              )}

              {/* Entry Rules */}
              {event.entry_rules && (
                <div className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border">
                  <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">Правила входа</h3>
                    <p className="text-muted-foreground whitespace-pre-line">{event.entry_rules}</p>
                  </div>
                </div>
              )}

              {/* Contacts */}
              {event.contacts && (
                <div className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border">
                  <Phone className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">Контакты</h3>
                    <p className="text-muted-foreground whitespace-pre-line">{event.contacts}</p>
                  </div>
                </div>
              )}

              {/* Photo Albums Section */}
              {albums.length > 0 && (
                <div className="pt-8 border-t border-border">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Images className="h-5 w-5 text-primary" />
                    Фотоальбомы
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {albums.map((album) => (
                      <Link
                        key={album.id}
                        href={`/gallery/${album.slug}`}
                        className="group block"
                      >
                        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted border border-border group-hover:border-primary/50 transition-colors">
                          {resolveAssetUrl(album.cover_image_url) ? (
                            <Image
                              src={resolveAssetUrl(album.cover_image_url)!}
                              alt={album.title}
                              fill
                              className="object-cover transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-secondary">
                              <Images className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            <h3 className="font-semibold text-white mb-1 line-clamp-1">{album.title}</h3>
                            {album.photo_count !== undefined && (
                              <p className="text-sm text-white/80">{album.photo_count} фото</p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Videos Section */}
              {videos.length > 0 && (
                <div className="pt-8 border-t border-border">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Video className="h-5 w-5 text-primary" />
                    Видеозаписи
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {videos.map((video) => {
                      const videoUrl = video.slug ? `/videos/${video.slug}` : `/videos/${video.id}`
                      const thumbnail = video.thumbnail_url || (video.video_type === 'youtube' 
                        ? `https://img.youtube.com/vi/${video.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1]}/mqdefault.jpg`
                        : null)
                      
                      return (
                        <Link 
                          key={video.id} 
                          href={videoUrl}
                          className="group rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-all"
                        >
                          <div className="relative aspect-video bg-muted">
                            {thumbnail ? (
                              <img
                                src={resolveAssetUrl(thumbnail) ?? thumbnail}
                                alt={video.title}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Video className="h-12 w-12 text-muted-foreground" />
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                              <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play className="h-5 w-5 text-primary-foreground ml-0.5" fill="currentColor" />
                              </div>
                            </div>
                          </div>
                          <div className="p-3 bg-card">
                            <h3 className="font-semibold text-sm line-clamp-1">{video.title}</h3>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Sticky Ticket Button on mobile */}
              {event.ticket_url && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border md:hidden z-50">
                  <a href={event.ticket_url} target="_blank" rel="noopener noreferrer" className="block">
                    <Button size="lg" className="w-full gap-2 text-base py-6">
                      <Ticket className="h-5 w-5" />
                      Купить билеты
                    </Button>
                  </a>
                </div>
              )}

              {/* Comments Section */}
              <div className="pt-8 border-t border-border">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  Комментарии
                  {comments.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      ({comments.reduce((acc, c) => acc + 1 + c.replies.length, 0)})
                    </span>
                  )}
                </h2>

                {/* Comment form */}
                {user ? (
                  <form onSubmit={submitComment} className="flex gap-3 mb-6">
                    <CommentInput
                      value={newComment}
                      onChange={setNewComment}
                      placeholder="Написать комментарий..."
                      className="flex-1"
                      disabled={submitting}
                    />
                    <Button type="submit" disabled={submitting || !newComment.trim()} size="icon">
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                ) : (
                  <div className="mb-6 p-4 rounded-lg bg-secondary/50 text-center text-muted-foreground">
                    <Link href="/auth/login" className="text-primary hover:underline">
                      Войдите
                    </Link>
                    {', чтобы оставить комментарий'}
                  </div>
                )}

                {/* Comments list */}
                {comments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">
                    Пока нет комментариев. Будьте первым!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="space-y-2">
                        {/* Top-level comment */}
                        <div className="flex gap-3 p-4 rounded-lg bg-card border border-border">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <AdminUserHoverCard
                                userId={comment.user_id}
                                userName={comment.user_name}
                                userRole={comment.user_role}
                                isAdmin={isAdmin}
                              >
                                <span className="font-medium text-sm">
                                  {comment.user_name}
                                </span>
                              </AdminUserHoverCard>
                              {comment.user_role === 'admin' && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                  Админ
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(comment.created_at), 'd MMM, HH:mm', { locale: ru })}
                              </span>
                            </div>
                            <p className="text-sm text-foreground/90"><CommentContent content={comment.content} /></p>
                            {/* Reply button */}
                            {user && (
                              <button
                                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                                className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                              >
                                <Reply className="h-3 w-3" />
                                Ответить
                              </button>
                            )}
                          </div>
                          {(user?.id === comment.user_id || isAdmin) && (
                            <button
                              onClick={() => deleteComment(comment.id)}
                              className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {/* Inline reply form */}
                        {replyingTo === comment.id && (
                          <form onSubmit={submitReply} className="flex gap-2 ml-8">
                            <CommentInput
                              value={replyText}
                              onChange={setReplyText}
                              placeholder="Написать ответ..."
                              className="flex-1 h-9 text-sm"
                              disabled={submitting}
                              autoFocus
                            />
                            <Button type="submit" disabled={submitting || !replyText.trim()} size="sm" className="h-9">
                              {submitting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Send className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-9 text-xs"
                              onClick={() => { setReplyingTo(null); setReplyText('') }}
                            >
                              Отмена
                            </Button>
                          </form>
                        )}

                        {/* Replies */}
                        {comment.replies.length > 0 && (
                          <div className="ml-8 space-y-2">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} className="flex gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <AdminUserHoverCard
                                      userId={reply.user_id}
                                      userName={reply.user_name}
                                      userRole={reply.user_role}
                                      isAdmin={isAdmin}
                                    >
                                      <span className="font-medium text-sm">
                                        {reply.user_name}
                                      </span>
                                    </AdminUserHoverCard>
                                    {reply.user_role === 'admin' && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                        Админ
                                      </span>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(reply.created_at), 'd MMM, HH:mm', { locale: ru })}
                                    </span>
                                  </div>
                                  <p className="text-sm text-foreground/90"><CommentContent content={reply.content} /></p>
                                </div>
                                {(user?.id === reply.user_id || isAdmin) && (
                                  <button
                                    onClick={() => deleteComment(reply.id)}
                                    className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom spacer for mobile sticky button */}
              {event.ticket_url && <div className="h-20 md:hidden" />}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
