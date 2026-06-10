import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({ segments: ['Админ', 'Концерты'] })

export default function AdminEventsLayout({ children }: { children: React.ReactNode }) {
  return children
}
