import { pageMetadata } from '@/lib/metadata'

export const dynamic = 'force-dynamic'

export const metadata = pageMetadata({ segments: ['Профиль'] })

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
