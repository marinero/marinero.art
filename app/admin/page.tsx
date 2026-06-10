import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Images, Link as LinkIcon, Users, MessageSquare, Music, FileText, Video } from 'lucide-react'
import Link from 'next/link'
import { MigrateAudioButton } from '@/components/admin/migrate-audio-button'
import { MigrateUsersButton } from '@/components/admin/migrate-users-button'
import { BackupDatabaseButton } from '@/components/admin/backup-database-button'

async function countTable(table: string): Promise<number> {
  const result = await db.queryOne<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${table}`
  )
  return Number(result?.count ?? 0)
}

export default async function AdminDashboardPage() {
  const [
    eventsCount,
    albumsCount,
    linksCount,
    usersCount,
    commentsCount,
    rehearsalsCount,
    songsCount,
    videosCount,
  ] = await Promise.all([
    countTable('events'),
    countTable('albums'),
    countTable('platform_links'),
    countTable('profiles'),
    countTable('comments'),
    countTable('rehearsals'),
    countTable('song_texts'),
    countTable('videos'),
  ])

  const stats = [
    {
      title: 'Концерты',
      value: eventsCount,
      icon: Calendar,
      href: '/admin/events',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Видео',
      value: videosCount,
      icon: Video,
      href: '/admin/videos',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'Альбомы',
      value: albumsCount,
      icon: Images,
      href: '/admin/albums',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Репетиции',
      value: rehearsalsCount,
      icon: Music,
      href: '/admin/rehearsals',
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
    },
    {
      title: 'Тексты песен',
      value: songsCount,
      icon: FileText,
      href: '/admin/songs',
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Комментарии',
      value: commentsCount,
      icon: MessageSquare,
      href: '/admin/comments',
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
    },
    {
      title: 'Ссылки',
      value: linksCount,
      icon: LinkIcon,
      href: '/admin/links',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Пользователи',
      value: usersCount,
      icon: Users,
      href: '/admin/users',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ]

  const recentEvents = await db.queryMany<{
    id: string
    title: string
    event_date: string
    city: string | null
  }>(
    `SELECT id, title, event_date, city
     FROM events
     ORDER BY created_at DESC
     LIMIT 5`
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Панель управления</h1>
        <p className="text-muted-foreground mt-1">Обзор контента MARINERO</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.title} href={stat.href}>
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.title}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Быстрые действия</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/admin/events?create=true"
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <Calendar className="h-5 w-5 text-primary" />
              <span>Добавить концерт</span>
            </Link>
            <Link
              href="/admin/videos?create=true"
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <Video className="h-5 w-5 text-primary" />
              <span>Добавить видео</span>
            </Link>
            <Link
              href="/admin/albums?create=true"
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <Images className="h-5 w-5 text-primary" />
              <span>Создать альбом</span>
            </Link>
            <Link
              href="/admin/rehearsals?create=true"
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <Music className="h-5 w-5 text-primary" />
              <span>Добавить репетицию</span>
            </Link>
            <Link
              href="/admin/songs?create=true"
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <FileText className="h-5 w-5 text-primary" />
              <span>Добавить текст песни</span>
            </Link>
            <Link
              href="/admin/links?create=true"
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <LinkIcon className="h-5 w-5 text-primary" />
              <span>Добавить ссылку</span>
            </Link>

            <div className="pt-3 mt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Технические действия</p>
              <div className="space-y-2">
                <BackupDatabaseButton />
                <MigrateAudioButton />
                <MigrateUsersButton />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Последние концерты</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEvents.length > 0 ? (
              <div className="space-y-3">
                {recentEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/admin/events/${event.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.city}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.event_date).toLocaleDateString('ru-RU')}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-4 text-center">
                Нет концертов
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
