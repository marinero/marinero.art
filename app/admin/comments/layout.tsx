import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({ segments: ['Админ', 'Комментарии'] })

export default function AdminCommentsLayout({ children }: { children: React.ReactNode }) {
  return children
}
