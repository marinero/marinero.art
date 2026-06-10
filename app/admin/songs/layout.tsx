import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({ segments: ['Админ', 'Тексты песен'] })

export default function AdminSongsLayout({ children }: { children: React.ReactNode }) {
  return children
}
