import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({ segments: ['Админ', 'Пользователи'] })

export default function AdminUsersLayout({ children }: { children: React.ReactNode }) {
  return children
}
