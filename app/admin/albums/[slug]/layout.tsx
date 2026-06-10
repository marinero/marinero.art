import type { Metadata } from 'next'
import { resolveAlbum } from '@/lib/admin-resolve'
import { pageMetadata } from '@/lib/metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params

  if (slug === 'new') {
    return pageMetadata({ segments: ['Админ', 'Фотогалерея', 'Новый альбом'] })
  }

  const album = await resolveAlbum<{ title: string }>(slug)

  return pageMetadata({
    segments: ['Админ', 'Фотогалерея', album ? `"${album.title}"` : 'Редактирование'],
  })
}

export default function AdminAlbumEditorLayout({ children }: { children: React.ReactNode }) {
  return children
}
