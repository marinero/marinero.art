'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Calendar, X, ChevronLeft, ChevronRight, MessageCircle, Send, Trash2, Loader2, Reply, Pencil, Check } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Album, Photo, Comment, Profile } from '@/lib/types'
import { AdminUserHoverCard } from '@/components/admin/user-hover-card'
import { fetchNormalizedComments, buildCommentTree } from '@/lib/comments-client'
import { resolveAssetUrl } from '@/lib/storage-keys'

type CommentWithProfile = Comment & { 
  profiles: Pick<Profile, 'display_name' | 'username' | 'role'>
  parent_id: string | null
  replies?: CommentWithProfile[]
}

export default function AlbumPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const albumSlug = params.slug as string

  const [album, setAlbum] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
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

  useEffect(() => {
    async function fetchData() {
      const profileRes = await fetch('/api/profile')
      if (profileRes.ok) {
        const { user: sessionUser, profile: profileData } = await profileRes.json()
        setUser(sessionUser)
        setProfile(profileData)
      }

      const res = await fetch(`/api/gallery/${encodeURIComponent(albumSlug)}`)
      if (res.ok) {
        const { album: albumData, photos: photosData } = await res.json()
        setAlbum(albumData)
        if (photosData) {
          setPhotos(photosData)
          const photoParam = searchParams.get('photo')
          if (photoParam) {
            const targetPhoto = photosData.find((p: Photo) => p.id === photoParam)
            if (targetPhoto) {
              setSelectedPhoto(targetPhoto)
              fetchComments(targetPhoto.id)
            }
          }
        }
      }
      setLoading(false)
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumSlug])

  const fetchComments = useCallback(async (photoId: string) => {
    setLoadingComments(true)
    const normalized = await fetchNormalizedComments('photo', photoId)
    const flat: CommentWithProfile[] = normalized.map((c) => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      user_id: c.user_id,
      parent_id: c.parent_id,
      type: 'photo',
      object_id: c.object_id ?? photoId,
      profiles: c.profiles,
      replies: [],
    }))

    setComments(buildCommentTree(flat))
    setLoadingComments(false)
  }, [])

  function openPhoto(photo: Photo) {
    setSelectedPhoto(photo)
    fetchComments(photo.id)
    router.replace(`/gallery/${albumSlug}?photo=${photo.id}`, { scroll: false })
  }

  function closePhoto() {
    setSelectedPhoto(null)
    setComments([])
    setNewComment('')
    router.replace(`/gallery/${albumSlug}`, { scroll: false })
  }

  function navigatePhoto(direction: 'prev' | 'next') {
    if (!selectedPhoto) return

    const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id)
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1

    if (newIndex >= 0 && newIndex < photos.length) {
      const newPhoto = photos[newIndex]
      setSelectedPhoto(newPhoto)
      fetchComments(newPhoto.id)
      router.replace(`/gallery/${albumSlug}?photo=${newPhoto.id}`, { scroll: false })
    }
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedPhoto || !newComment.trim()) return

    setSubmitting(true)

    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'photo',
        object_id: selectedPhoto.id,
        content: newComment.trim(),
        parent_id: null,
      }),
    })

    if (res.ok) {
      setNewComment('')
      fetchComments(selectedPhoto.id)
    }

    setSubmitting(false)
  }

  async function handleSubmitReply(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedPhoto || !replyText.trim() || !replyingTo) return

    setSubmitting(true)
    const replyContentForEmail = replyText.trim()

    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'photo',
        object_id: selectedPhoto.id,
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
            contextType: 'photo',
            contextId: selectedPhoto.id,
          }),
        })
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError)
        // Don't fail the reply if notification fails
      }

      setReplyText('')
      setReplyingTo(null)
      fetchComments(selectedPhoto.id)
    }

    setSubmitting(false)
  }

  async function handleDeleteComment(commentId: string) {
    await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
    if (selectedPhoto) {
      fetchComments(selectedPhoto.id)
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
      if (selectedPhoto) {
        fetchComments(selectedPhoto.id)
      }
    } else {
      const error = await response.json()
      alert(`Ошибка: ${error.error}`)
    }
  }

  function canEditComment(comment: CommentWithProfile) {
    return user?.id === comment.user_id || profile?.role === 'admin'
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selectedPhoto) return

      if (e.key === 'Escape') closePhoto()
      if (e.key === 'ArrowLeft') navigatePhoto('prev')
      if (e.key === 'ArrowRight') navigatePhoto('next')
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedPhoto, photos])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!album) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header user={user} isAdmin={profile?.role === 'admin'} displayName={profile?.display_name} />
        <main className="flex-1 container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Альбом не найден</h1>
          <Link href="/gallery">
            <Button>Вернуться в галерею</Button>
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
        {/* Album Header */}
        <div className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-8">
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Все альбомы
            </Link>
            <h1 className="text-3xl font-bold mb-2">{album.title}</h1>
            <div className="flex items-center gap-4 text-muted-foreground">
              {album.event_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(album.event_date), 'd MMMM yyyy', { locale: ru })}
                </span>
              )}
              <span>{photos.length} фото</span>
            </div>
            {album.description && (
              <p className="mt-4 text-muted-foreground max-w-2xl">
                {album.description}
              </p>
            )}
          </div>
        </div>

        {/* Photo Grid */}
        <div className="container mx-auto px-4 py-8">
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="break-inside-avoid cursor-pointer group"
                onClick={() => openPhoto(photo)}
              >
                <div className="relative overflow-hidden rounded-lg bg-muted">
                  <Image
                    src={resolveAssetUrl(photo.url) ?? photo.url}
                    alt={photo.caption || 'Photo'}
                    width={400}
                    height={300}
                    className="w-full h-auto transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </div>
              </div>
            ))}
          </div>

          {photos.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                В этом альбоме пока нет фото
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Photo Lightbox with Comments */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col md:flex-row">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 md:top-4 md:right-4 z-20 text-white hover:bg-white/10"
            onClick={closePhoto}
          >
            <X className="h-5 w-5 md:h-6 md:w-6" />
          </Button>

          {/* Image Section */}
          <div className="flex-1 flex items-center justify-center relative min-h-0 p-2 md:p-8 lg:p-16">
            {/* Navigation - Left */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-1 md:left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/10 h-8 w-8 md:h-12 md:w-12"
              onClick={() => navigatePhoto('prev')}
              disabled={photos.findIndex(p => p.id === selectedPhoto.id) === 0}
            >
              <ChevronLeft className="h-5 w-5 md:h-8 md:w-8" />
            </Button>

            {/* Image */}
            <Image
              src={resolveAssetUrl(selectedPhoto.url) ?? selectedPhoto.url}
              alt={selectedPhoto.caption || 'Photo'}
              width={1200}
              height={800}
              className="max-w-full max-h-full object-contain"
            />

            {/* Navigation - Right */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 md:right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/10 h-8 w-8 md:h-12 md:w-12"
              onClick={() => navigatePhoto('next')}
              disabled={photos.findIndex(p => p.id === selectedPhoto.id) === photos.length - 1}
            >
              <ChevronRight className="h-5 w-5 md:h-8 md:w-8" />
            </Button>
          </div>

          {/* Comments Sidebar */}
          <div className="w-full md:w-80 lg:w-96 h-[45vh] md:h-full bg-card border-t md:border-t-0 md:border-l border-border flex flex-col">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Комментарии ({comments.length})
              </h3>
              {selectedPhoto.caption && (
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedPhoto.caption}
                </p>
              )}
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingComments ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Пока нет комментариев
                </p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="space-y-2">
                    {/* Top-level comment */}
                    <div className="group">
                      {editingCommentId === comment.id ? (
                        // Edit mode
                        <div className="space-y-2">
                          <Input
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
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
                        // View mode
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
                                {format(new Date(comment.created_at), 'd MMM, HH:mm', { locale: ru })}
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
                          <p className="text-sm mt-1">{comment.content}</p>
                          {user && (
                            <button
                              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                              className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
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
                      <form onSubmit={handleSubmitReply} className="flex gap-2 ml-4">
                        <Input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Ответ..."
                          className="flex-1 h-8 text-sm"
                          disabled={submitting}
                          autoFocus
                        />
                        <Button type="submit" size="icon" className="h-8 w-8" disabled={submitting || !replyText.trim()}>
                          <Send className="h-3 w-3" />
                        </Button>
                      </form>
                    )}

                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="ml-4 pl-3 border-l border-border space-y-2">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="group">
                            {editingCommentId === reply.id ? (
                              // Edit mode for reply
                              <div className="space-y-2">
                                <Input
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  className="text-xs h-7"
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
                              // View mode for reply
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
                                <p className="text-xs mt-0.5">{reply.content}</p>
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

            {/* Comment Form */}
            <div className="p-4 border-t border-border">
              {user ? (
                <form onSubmit={handleSubmitComment} className="flex gap-2">
                  <Input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Написать комментарий..."
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={submitting || !newComment.trim()}>
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Войдите, чтобы оставить комментарий
                  </p>
                  <Link href="/auth/login">
                    <Button size="sm">Войти</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
