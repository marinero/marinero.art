import Link from 'next/link'
import { LogIn, Lock } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'

interface RestrictedNoticeProps {
  user?: { id: string; email?: string } | null
  displayName?: string | null
  isAdmin?: boolean
  title: string
  message: string
  /** When set, shows a "Войти" button that returns to `redirectTo` after login. */
  login?: { redirectTo: string } | null
}

/**
 * Friendly full-page notice shown instead of a bare 404 when a page exists but
 * the current visitor may not view it yet (e.g. an unpublished song). Rendered
 * in the same shell as the rest of the site (header + footer).
 */
export function RestrictedNotice({
  user,
  displayName,
  isAdmin = false,
  title,
  message,
  login = null,
}: RestrictedNoticeProps) {
  const Icon = login ? LogIn : Lock

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} isAdmin={isAdmin} displayName={displayName} />
      <main className="flex-1 container mx-auto px-4 py-16 flex items-center justify-center">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold">{title}</h1>
          <p className="mt-3 text-muted-foreground">{message}</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            {login && (
              <Link href={`/auth/login?redirect=${encodeURIComponent(login.redirectTo)}`}>
                <Button className="font-[family-name:var(--font-logo)] text-base tracking-wide cursor-pointer">
                  Войти
                </Button>
              </Link>
            )}
            <Link href="/">
              <Button
                variant={login ? 'outline' : 'default'}
                className="font-[family-name:var(--font-logo)] text-base tracking-wide cursor-pointer"
              >
                На главную
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
