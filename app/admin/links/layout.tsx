import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({ segments: ['Админ', 'Слушать'] })

export default function AdminLinksLayout({ children }: { children: React.ReactNode }) {
  return children
}
