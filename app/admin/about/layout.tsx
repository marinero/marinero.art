import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({ segments: ['Админ', 'О нас'] })

export default function AdminAboutLayout({ children }: { children: React.ReactNode }) {
  return children
}
