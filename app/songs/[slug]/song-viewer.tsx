'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CommentContent } from '@/components/comments/comment-content'
import { CommentChordComposer } from '@/components/comments/comment-chord-composer'
import { ChordDiagram } from '@/components/songs/chord-diagram'
import { useGuitarAudio } from '@/hooks/use-guitar-audio'
import { AdminUserHoverCard } from '@/components/admin/user-hover-card'
import { Music, Volume2, VolumeX, MessageCircle, Send, Trash2, Reply, Loader2, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import Link from 'next/link'
import { fetchNormalizedComments, buildCommentTree } from '@/lib/comments-client'
import { buildChordMap } from '@/lib/text-chords'
import type { SongText, SongTextChord, Chord, CommentChord, Profile } from '@/lib/types'

interface SongViewerProps {
  song: SongText
  chords: SongTextChord[]
}

interface SongComment {
  id: string
  content: string
  created_at: string
  user_id: string
  user_name: string
  user_role: string
  parent_id: string | null
  chords: CommentChord[] | null
  replies: SongComment[]
}

export function SongViewer({ song, chords }: SongViewerProps) {
  const [activeChord, setActiveChord] = useState<Chord | null>(null)
  const [showChordDiagrams, setShowChordDiagrams] = useState(true)
  const { playArpeggio, isPlaying } = useGuitarAudio()
  
  // Comments state
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [comments, setComments] = useState<SongComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [newCommentChords, setNewCommentChords] = useState<CommentChord[]>([])
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyChords, setReplyChords] = useState<CommentChord[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [commentChordMap, setCommentChordMap] = useState<Map<string, Chord>>(new Map())
  
  useEffect(() => {
    async function fetchData() {
      const profileRes = await fetch('/api/profile')
      if (profileRes.ok) {
        const { user: sessionUser, profile: profileData } = await profileRes.json()
        setUser(sessionUser)
        setProfile(profileData)
      }

      fetchComments()
    }

    fetchData()
  }, [song.id])

  useEffect(() => {
    fetch('/api/chords')
      .then((res) => (res.ok ? res.json() : { chords: [] }))
      .then((data) => setCommentChordMap(buildChordMap((data.chords ?? []) as Chord[])))
      .catch(() => {})
  }, [])

  const fetchComments = useCallback(async () => {
    const normalized = await fetchNormalizedComments('song', song.id)
    const flat: SongComment[] = normalized.map((c) => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      user_id: c.user_id,
      parent_id: c.parent_id,
      user_name: c.profiles.display_name || c.profiles.username || 'Пользователь',
      user_role: c.profiles.role,
      chords: c.chords ?? null,
      replies: [],
    }))

    setComments(buildCommentTree(flat))
  }, [song.id])

  const uniqueChords = Array.from(
    new Map(chords.map(c => [c.chord_id, c.chord])).values()
  ).filter(Boolean) as Chord[]

  const handleChordClick = (chord: Chord) => {
    setActiveChord(chord)
    playArpeggio(chord.fret_positions as number[])
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !newComment.trim()) return

    setSubmitting(true)
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'song',
        object_id: song.id,
        content: newComment.trim(),
        parent_id: null,
        chords: newCommentChords,
      }),
    })

    if (res.ok) {
      setNewComment('')
      setNewCommentChords([])
      fetchComments()
    }
    setSubmitting(false)
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !replyText.trim() || !replyingTo) return

    setSubmitting(true)
    const replyContentForEmail = replyText.trim()

    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'song',
        object_id: song.id,
        content: replyContentForEmail,
        parent_id: replyingTo,
        chords: replyChords,
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
            contextType: 'song',
            contextId: song.id,
          }),
        })
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError)
      }

      setReplyText('')
      setReplyChords([])
      setReplyingTo(null)
      fetchComments()
    }
    setSubmitting(false)
  }

  async function deleteComment(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchComments()
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <h1 className="text-3xl font-bold">{song.title}</h1>
          {!song.is_published && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/60 text-amber-600 dark:text-amber-500"
            >
              <EyeOff className="h-3 w-3" />
              Черновик
            </Badge>
          )}
        </div>
        {song.bpm && (
          <p className="text-muted-foreground">{song.bpm} BPM</p>
        )}
      </div>

      {/* Chord palette */}
      {uniqueChords.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Используемые аккорды ({uniqueChords.length})
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowChordDiagrams(!showChordDiagrams)}
                className="gap-2"
              >
                {showChordDiagrams ? (
                  <>
                    <VolumeX className="h-4 w-4" />
                    Скрыть диаграммы
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4" />
                    Показать диаграммы
                  </>
                )}
              </Button>
            </div>
            
            {showChordDiagrams ? (
              <div className="flex flex-wrap gap-4 justify-center">
                {uniqueChords.map((chord) => (
                  <div
                    key={chord.id}
                    className={cn(
                      "p-2 rounded-lg border transition-all cursor-pointer hover:border-primary",
                      activeChord?.id === chord.id && "border-primary bg-primary/5"
                    )}
                    onClick={() => handleChordClick(chord)}
                  >
                    <ChordDiagram
                      name={chord.name}
                      fretPositions={chord.fret_positions as number[]}
                      baseFret={chord.base_fret}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {uniqueChords.map((chord) => (
                  <Badge
                    key={chord.id}
                    variant={activeChord?.id === chord.id ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => handleChordClick(chord)}
                  >
                    {chord.name}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Song text with chords */}
      <Card>
        <CardContent className="p-6">
          <SongTextDisplay
            text={song.text_content}
            chords={chords}
            onChordClick={handleChordClick}
            activeChordId={activeChord?.id}
            isPlaying={isPlaying}
          />
        </CardContent>
      </Card>

      {/* Comments Section */}
      <Card className="overflow-visible">
        <CardContent className="p-6 overflow-visible">
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
            <form onSubmit={submitComment} className="space-y-3 mb-6">
              <CommentChordComposer
                value={newComment}
                onChange={setNewComment}
                chords={newCommentChords}
                onChordsChange={setNewCommentChords}
                placeholder="Написать комментарий..."
                disabled={submitting}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={submitting || !newComment.trim()} className="gap-2">
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Отправить
                </Button>
              </div>
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
                          isAdmin={profile?.role === 'admin'}
                        >
                          <span className="font-medium text-sm">{comment.user_name}</span>
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
                      <div className="text-sm">
                        <CommentContent
                          content={comment.content}
                          chords={comment.chords}
                          chordMap={commentChordMap}
                          onChordClick={handleChordClick}
                        />
                      </div>
                      <div className="flex gap-2 mt-2">
                        {user && (
                          <button
                            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                          >
                            <Reply className="h-3 w-3" />
                            Ответить
                          </button>
                        )}
                        {(user?.id === comment.user_id || profile?.role === 'admin') && (
                          <button
                            onClick={() => deleteComment(comment.id)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                            Удалить
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reply form */}
                  {replyingTo === comment.id && (
                    <form onSubmit={submitReply} className="space-y-2 ml-8">
                      <CommentChordComposer
                        value={replyText}
                        onChange={setReplyText}
                        chords={replyChords}
                        onChordsChange={setReplyChords}
                        placeholder="Ответ..."
                        disabled={submitting}
                        autoFocus
                      />
                      <div className="flex justify-end">
                        <Button type="submit" size="sm" disabled={submitting || !replyText.trim()} className="gap-2">
                          {submitting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                          Ответить
                        </Button>
                      </div>
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
                                isAdmin={profile?.role === 'admin'}
                              >
                                <span className="font-medium text-sm">{reply.user_name}</span>
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
                            <div className="text-sm">
                              <CommentContent
                                content={reply.content}
                                chords={reply.chords}
                                chordMap={commentChordMap}
                                onChordClick={handleChordClick}
                              />
                            </div>
                            {(user?.id === reply.user_id || profile?.role === 'admin') && (
                              <button
                                onClick={() => deleteComment(reply.id)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive mt-1"
                              >
                                <Trash2 className="h-3 w-3" />
                                Удалить
                              </button>
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

      {/* Active chord detail (mobile-friendly) */}
      {activeChord && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50">
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <ChordDiagram
                  name={activeChord.name}
                  fretPositions={activeChord.fret_positions as number[]}
                  baseFret={activeChord.base_fret}
                  size="md"
                />
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => playArpeggio(activeChord.fret_positions as number[])}
                    disabled={isPlaying}
                    className="gap-2"
                  >
                    <Volume2 className="h-4 w-4" />
                    Воспроизвести
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveChord(null)}
                  >
                    Закрыть
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// Display song text with chords above
interface SongTextDisplayProps {
  text: string
  chords: SongTextChord[]
  onChordClick: (chord: Chord) => void
  activeChordId?: string
  isPlaying: boolean
}

function SongTextDisplay({
  text,
  chords,
  onChordClick,
  activeChordId,
  isPlaying
}: SongTextDisplayProps) {
  if (!text) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Текст песни пока не добавлен</p>
      </div>
    )
  }

  const lines = text.split('\n')
  let globalPosition = 0

  return (
    <div className="text-base leading-relaxed space-y-2 font-sans">
      {lines.map((line, lineIndex) => {
        const lineStart = globalPosition
        globalPosition += line.length + 1

        // Find chords for this line
        const lineChords = chords.filter(
          c => c.position >= lineStart && c.position < lineStart + line.length
        )

        // Check if line is empty or just whitespace
        const isEmptyLine = !line.trim()

        return (
          <div key={lineIndex} className={cn(isEmptyLine && "h-4")}>
            {/* Chord line */}
            {lineChords.length > 0 && (
              <div className="relative h-6 text-primary font-semibold font-mono">
                {lineChords.map((chordData) => {
                  const relativePos = chordData.position - lineStart
                  const chord = chordData.chord

                  return (
                    <span
                      key={chordData.id}
                      className={cn(
                        "absolute cursor-pointer hover:text-primary/80 transition-colors",
                        activeChordId === chord?.id && "underline"
                      )}
                      style={{ left: `${relativePos}ch` }}
                      onClick={() => chord && onChordClick(chord)}
                    >
                      {chord?.name || '?'}
                    </span>
                  )
                })}
              </div>
            )}

            {/* Text line */}
            {!isEmptyLine && (
              <div className="whitespace-pre-wrap break-words">
                {line}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
