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

  const event = await db.queryOne<{ title: string; description: string | null }>(
    `SELECT title, description FROM events
     WHERE slug = $1 AND is_published = true`,
    [slug]
  )

  if (!event) {
    return pageMetadata({ segments: ['Концерты', 'Концерт не найден'] })
  }

  return pageMetadata({
    segments: ['Концерты', event.title],
    description: event.description ?? `Концерт «${event.title}» — группа MARINERO`,
  })
}

export default function EventDetailLayout({ children }: LayoutProps) {
  return children
}
