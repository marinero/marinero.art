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

  const album = await db.queryOne<{ title: string; description: string | null }>(
    `SELECT title, description FROM albums
     WHERE slug = $1 AND is_published = true`,
    [slug]
  )

  if (!album) {
    return pageMetadata({ segments: ['Фотогалерея', 'Альбом не найден'] })
  }

  return pageMetadata({
    segments: ['Фотогалерея', album.title],
    description: album.description ?? `Фотоальбом «${album.title}» — группа MARINERO`,
  })
}

export default function AlbumDetailLayout({ children }: LayoutProps) {
  return children
}
