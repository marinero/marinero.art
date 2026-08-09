import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'

interface AccessDeniedProps {
  user?: { id: string; email?: string } | null
  displayName?: string | null
  title?: string
  message?: string
}

/**
 * Full-page "access denied" screen shown when a signed-in but non-admin user
 * lands on an admin-only route. Rendered in the same shell as the rest of the
 * site (header + footer) so the transition doesn't feel like a hard error.
 */
export function AccessDenied({
  user,
  displayName,
  title = 'Доступ только для администраторов',
  message = 'Эта страница доступна только администраторам сайта. Если вам нужен доступ, обратитесь к администратору.',
}: AccessDeniedProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} isAdmin={false} displayName={displayName} />
      <main className="flex-1 container mx-auto px-4 py-16 flex items-center justify-center">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <ShieldAlert className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold">{title}</h1>
          <p className="mt-3 text-muted-foreground">{message}</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/">
              <Button className="font-[family-name:var(--font-logo)] text-base tracking-wide cursor-pointer">
                На главную
              </Button>
            </Link>
            <Link href="/profile">
              <Button
                variant="outline"
                className="font-[family-name:var(--font-logo)] text-base tracking-wide cursor-pointer"
              >
                Мой профиль
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
