'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  AtSign,
  ExternalLink,
  Loader2,
  MessageSquareReply,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { ProfileNav } from '@/components/profile/profile-nav'
import { CommentContent } from '@/components/comments/comment-content'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { CommentActivityItem } from '@/lib/comment-activity'

export default function ProfileActivityPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [profile, setProfile] = useState<{ display_name: string | null; role: 'fan' | 'admin' } | null>(null)
  const [items, setItems] = useState<CommentActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?redirect=/profile/activity')
      return
    }

    if (status !== 'authenticated') return

    async function loadActivity() {
      try {
        await fetch('/api/notifications/activity', { method: 'POST' })

        const [activityResponse, profileResponse] = await Promise.all([
          fetch('/api/notifications/activity'),
          fetch('/api/profile'),
        ])

        if (!profileResponse.ok) {
          router.push('/auth/login?redirect=/profile/activity')
          return
        }

        const profileData = await profileResponse.json()
        setProfile(profileData.profile)

        if (activityResponse.ok) {
          const activityData = await activityResponse.json()
          setItems(activityData.items || [])
        }
      } finally {
        setLoading(false)
      }
    }

    loadActivity()
  }, [status, router])

  const user = session?.user
    ? { id: session.user.id, email: session.user.email ?? undefined }
    : null

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} isAdmin={profile?.role === 'admin'} displayName={profile?.display_name} />

      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Профиль</h1>
            <p className="text-muted-foreground">
              Ответы на ваши комментарии и упоминания
            </p>
          </div>

          <ProfileNav />

          {items.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <MessageSquareReply className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Пока нет ответов и упоминаний</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={item.kind === 'reply' ? 'secondary' : 'default'}>
                            {item.kind === 'reply' ? (
                              <>
                                <MessageSquareReply className="h-3 w-3" />
                                Ответ
                              </>
                            ) : (
                              <>
                                <AtSign className="h-3 w-3" />
                                Упоминание
                              </>
                            )}
                          </Badge>
                          {item.is_unread && (
                            <Badge variant="outline" className="text-primary border-primary/40">
                              Новое
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm">
                          <span className="font-medium">{item.author_name}</span>
                          {' '}
                          {item.kind === 'reply'
                            ? 'ответил(а) на ваш комментарий'
                            : 'упомянул(а) вас в комментарии'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(item.created_at), 'd MMMM yyyy, HH:mm', { locale: ru })}
                        </p>
                      </div>

                      <Link
                        href={item.context_url}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0"
                      >
                        {item.context_label}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>

                    {item.parent_preview && (
                      <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground/80">Ваш комментарий: </span>
                        {item.parent_preview}
                        {item.parent_preview.length >= 120 ? '…' : ''}
                      </div>
                    )}

                    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <CommentContent content={item.content} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
