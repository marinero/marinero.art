import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({ segments: ['Регистрация'] })

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children
}
