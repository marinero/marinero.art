import type { Metadata } from 'next'
import { resolveSongText } from '@/lib/admin-resolve'
import { pageMetadata } from '@/lib/metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params

  if (slug === 'new') {
    return pageMetadata({ segments: ['Админ', 'Тексты песен', 'Новая песня'] })
  }

  const song = await resolveSongText<{ title: string }>(slug)

  return pageMetadata({
    segments: ['Админ', 'Тексты песен', song ? `"${song.title}"` : 'Редактирование'],
  })
}

export default function AdminSongEditorLayout({ children }: { children: React.ReactNode }) {
  return children
}
