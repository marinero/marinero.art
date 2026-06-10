import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({ segments: ['Админ', 'Дискография'] })

export default function AdminDiscographyLayout({ children }: { children: React.ReactNode }) {
  return children
}
