import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({ segments: ['Вход'] })

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
