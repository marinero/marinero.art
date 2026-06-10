import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({ segments: ['Админ', 'Участники'] })

export default function AdminMembersLayout({ children }: { children: React.ReactNode }) {
  return children
}
