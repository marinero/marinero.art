import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { pageMetadata } from '@/lib/metadata'

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params

  const video =
    (await db.queryOne<{ title: string; description: string | null }>(
      `SELECT title, description FROM videos
       WHERE slug = $1 AND is_published = true`,
      [slug]
    )) ??
    (await db.queryOne<{ title: string; description: string | null }>(
      `SELECT title, description FROM videos
       WHERE id = $1 AND is_published = true`,
      [slug]
    ))

  if (!video) {
    return pageMetadata({ segments: ['Видео', 'Видео не найдено'] })
  }

  return pageMetadata({
    segments: ['Видео', video.title],
    description: video.description ?? `Видео «${video.title}» — группа MARINERO`,
  })
}

export default function VideoDetailLayout({ children }: LayoutProps) {
  return children
}
