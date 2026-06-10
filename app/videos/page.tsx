import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import Image from 'next/image'
import Link from 'next/link'
import { Video as VideoIcon, MessageCircle, Play } from 'lucide-react'
import type { Video } from '@/lib/types'
import { pageMetadata } from '@/lib/metadata'
import { resolveAssetUrl } from '@/lib/storage-keys'

export const metadata = pageMetadata({
  segments: ['Видео'],
  description: 'Видеозаписи с концертов и выступлений группы MARINERO',
})

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

function getYouTubeThumbnail(url: string): string | null {
  const videoId = getYouTubeId(url)
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
  }
  return null
}

export default async function VideosPage() {
  const { user, isAdmin, displayName } = await getSessionUser()

  const videos = await db.queryMany<Video>(
    `SELECT * FROM videos
     WHERE is_published = true
     ORDER BY order_index ASC`
  )

  const videoIds = videos.map((v) => v.id)
  const commentCounts = new Map<string, number>()

  if (videoIds.length > 0) {
    const counts = await db.queryMany<{ object_id: string }>(
      `SELECT object_id FROM comments
       WHERE type = 'video' AND object_id = ANY($1::uuid[])`,
      [videoIds]
    )

    counts.forEach((c) => {
      commentCounts.set(c.object_id, (commentCounts.get(c.object_id) || 0) + 1)
    })
  }

  const videosWithCounts = videos.map((video) => ({
    ...video,
    comment_count: commentCounts.get(video.id) || 0,
  }))

  const hasVideos = videosWithCounts.length > 0

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} isAdmin={isAdmin} displayName={displayName} />
      
      <main className="flex-1">
        <section className="py-16 bg-card border-b border-border">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Видео
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Записи с концертов, клипы и закулисье MARINERO
            </p>
          </div>
        </section>

        {hasVideos ? (
          <section className="py-16">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {videosWithCounts.map((video) => {
                  const thumbnail = video.thumbnail_url || (video.video_type === 'youtube' ? getYouTubeThumbnail(video.video_url) : null)
                  const commentCount = video.comment_count || 0
                  const videoUrl = video.slug ? `/videos/${video.slug}` : `/videos/${video.id}`
                  
                  return (
                    <Link
                      key={video.id}
                      href={videoUrl}
                      className="group relative overflow-hidden rounded-xl bg-card border border-border hover:border-primary/50 transition-all"
                    >
                      <div className="relative aspect-video">
                        {thumbnail ? (
                          <Image
                            src={resolveAssetUrl(thumbnail) ?? thumbnail}
                            alt={video.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-secondary flex items-center justify-center">
                            <VideoIcon className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                          <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform scale-90 group-hover:scale-100">
                            <Play className="h-6 w-6 text-primary-foreground ml-1" fill="currentColor" />
                          </div>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="font-semibold text-lg mb-1 line-clamp-2">{video.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-4 w-4" />
                            {commentCount}
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </section>
        ) : (
          <section className="py-16">
            <div className="container mx-auto px-4 text-center">
              <VideoIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Видео пока нет</h2>
              <p className="text-muted-foreground">
                Скоро здесь появятся записи с концертов
              </p>
            </div>
          </section>
        )}
      </main>
      
      <Footer />
    </div>
  )
}
