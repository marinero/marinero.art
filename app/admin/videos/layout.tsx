import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({ segments: ['Админ', 'Видео'] })

export default function AdminVideosLayout({ children }: { children: React.ReactNode }) {
  return children
}
