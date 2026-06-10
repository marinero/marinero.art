import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({ segments: ['Админ', 'Репетиции'] })

export default function AdminRehearsalsLayout({ children }: { children: React.ReactNode }) {
  return children
}
