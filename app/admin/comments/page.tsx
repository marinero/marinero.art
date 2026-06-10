'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  MessageSquare, 
  Search, 
  Shield, 
  UserCircle,
  Music,
  Image as ImageIcon,
  Calendar,
  Clock,
  ExternalLink,
  Loader2,
  CornerDownRight,
} from 'lucide-react'
import { AdminUserHoverCard } from '@/components/admin/user-hover-card'

interface Comment {
  id: string
  type: 'audio' | 'photo' | 'rehearsal' | 'event' | 'song'
  content: string
  created_at: string
  user_id: string
  user_name: string
  user_role: string
  timestamp_seconds: number | null
  object_id: string | null
  parent_id: string | null
  parent_preview: string | null
  section: string
  section_url: string
  object_name: string
  object_url: string
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all')

  useEffect(() => {
    fetchComments()
  }, [])

  async function fetchComments() {
    try {
      const response = await fetch('/api/admin/comments')
      const data = await response.json()
      if (data.comments) {
        setComments(data.comments)
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
    setLoading(false)
  }

  const filteredComments = comments.filter(comment => {
    const matchesSearch = searchQuery === '' ||
      comment.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comment.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comment.object_name.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesRole = roleFilter === 'all' ||
      (roleFilter === 'admin' ? comment.user_role === 'admin' : comment.user_role !== 'admin')

    return matchesSearch && matchesRole
  })

  const totalCount = comments.length
  const adminCount = comments.filter(c => c.user_role === 'admin').length
  const userCount = comments.filter(c => c.user_role !== 'admin').length

  function getTypeIcon(type: string) {
    switch (type) {
      case 'audio': return <Music className="h-4 w-4 text-cyan-500" />
      case 'photo': return <ImageIcon className="h-4 w-4 text-green-500" />
      case 'rehearsal': return <Music className="h-4 w-4 text-cyan-500" />
      case 'event': return <Calendar className="h-4 w-4 text-blue-500" />
      case 'song': return <Music className="h-4 w-4 text-purple-500" />
      default: return <MessageSquare className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold">Комментарии</h1>
        <p className="text-muted-foreground mt-1">Все комментарии пользователей и администраторов</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10 flex-shrink-0">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-pink-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold">{totalCount}</p>
                <p className="text-xs text-muted-foreground truncate">Всего комментариев</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 flex-shrink-0">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold">{adminCount}</p>
                <p className="text-xs text-muted-foreground truncate">От администраторов</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10 flex-shrink-0">
                <UserCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold">{userCount}</p>
                <p className="text-xs text-muted-foreground truncate">От пользователей</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по тексту, имени или объекту..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={roleFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('all')}
          >
            Все
          </Button>
          <Button
            variant={roleFilter === 'admin' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('admin')}
            className="gap-1"
          >
            <Shield className="h-3.5 w-3.5" />
            Админы
          </Button>
          <Button
            variant={roleFilter === 'user' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('user')}
            className="gap-1"
          >
            <UserCircle className="h-3.5 w-3.5" />
            Пользователи
          </Button>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-3">
        {filteredComments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Комментарии не найдены
            </CardContent>
          </Card>
        ) : (
          filteredComments.map((comment) => (
            <Card key={`${comment.type}-${comment.id}`} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    {/* Section */}
                    <Link
                      href={comment.section_url}
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {getTypeIcon(comment.type)}
                      <span>{comment.section}</span>
                    </Link>

                    {/* Object */}
                    <Link
                      href={comment.object_url}
                      className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="truncate max-w-[200px]">{comment.object_name}</span>
                    </Link>

                    {/* Audio timestamp */}
                    {comment.timestamp_seconds !== null && (
                      <Link
                        href={`${comment.object_url}?audio=${comment.object_id}&t=${comment.timestamp_seconds}`}
                        className="flex items-center gap-1 text-cyan-500 hover:text-cyan-400 transition-colors"
                      >
                        <Clock className="h-3 w-3" />
                        <span>{formatTime(comment.timestamp_seconds)}</span>
                      </Link>
                    )}

                    {/* Date */}
                    <span className="text-muted-foreground">
                      {format(new Date(comment.created_at), 'd MMM, HH:mm', { locale: ru })}
                    </span>
                  </div>

                  {/* Reply indicator */}
                  {comment.parent_preview && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CornerDownRight className="h-3 w-3" />
                      <span className="truncate max-w-[300px]">
                        {'в ответ на: '}&quot;{comment.parent_preview}{comment.parent_preview.length >= 60 ? '...' : ''}&quot;
                      </span>
                    </div>
                  )}

                  {/* Content row */}
                  <div className="flex items-start gap-3">
                    {/* User info */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <AdminUserHoverCard
                        userId={comment.user_id}
                        userName={comment.user_name}
                        userRole={comment.user_role}
                        isAdmin={true}
                      >
                        <span className="font-medium text-sm">{comment.user_name}</span>
                      </AdminUserHoverCard>
                      {comment.user_role === 'admin' ? (
                        <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                          <Shield className="h-2.5 w-2.5" />
                          Админ
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">
                          <UserCircle className="h-2.5 w-2.5" />
                          Участник
                        </span>
                      )}
                    </div>

                    {/* Comment text */}
                    <p className="text-sm text-foreground">{comment.content}</p>
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
