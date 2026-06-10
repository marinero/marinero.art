import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({ segments: ['Админ', 'Фотогалерея'] })

export default function AdminAlbumsLayout({ children }: { children: React.ReactNode }) {
  return children
}
