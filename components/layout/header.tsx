'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, X, User, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/', label: 'Главная' },
  { href: '/about', label: 'О нас' },
  { href: '/events', label: 'Концерты' },
  { href: '/videos', label: 'Видео' },
  { href: '/gallery', label: 'Фото' },
  { href: '/songs', label: 'Песни' },
  { href: '/links', label: 'Слушать' },
]

interface HeaderProps {
  user?: { id: string; email?: string } | null
  isAdmin?: boolean
  displayName?: string | null
}

export function Header({ user, isAdmin, displayName }: HeaderProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      return
    }

    let cancelled = false

    async function fetchUnreadCount() {
      try {
        const response = await fetch('/api/notifications/activity?count_only=1')
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled) {
          setUnreadCount(data.unread_count ?? 0)
        }
      } catch {
        // ignore polling errors
      }
    }

    if (pathname === '/profile/activity') {
      setUnreadCount(0)
      return
    }

    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [user, pathname])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/marinero/marinero_logo.png"
            alt="MARINERO"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <span className="font-[family-name:var(--font-logo)] text-2xl tracking-wider text-primary">
            MARINERO
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'px-4 py-2 font-[family-name:var(--font-logo)] text-base tracking-wide rounded-lg transition-colors',
                pathname === link.href
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* User Actions */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              {isAdmin && (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="font-[family-name:var(--font-logo)] text-base tracking-wide cursor-pointer">
                    Админ
                  </Button>
                </Link>
              )}
              <div className="flex items-center gap-1">
                <Link
                  href="/profile/activity"
                  className="relative flex items-center justify-center h-10 w-10 rounded-lg hover:bg-secondary transition-colors"
                  aria-label="Комментарии и упоминания"
                >
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
                <Link href="/profile" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary transition-colors">
                  <User className="h-5 w-5 text-muted-foreground" />
                  {displayName && (
                    <span className="font-[family-name:var(--font-logo)] text-base tracking-wide text-foreground">
                      {displayName}
                    </span>
                  )}
                </Link>
              </div>
            </>
          ) : (
            <Link href="/auth/login">
              <Button variant="default" size="sm" className="font-[family-name:var(--font-logo)] text-base tracking-wide cursor-pointer">
                Войти
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'px-4 py-3 font-[family-name:var(--font-logo)] text-lg tracking-wide rounded-lg transition-colors',
                  pathname === link.href
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-border my-2 pt-2">
              {user ? (
                <>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 font-[family-name:var(--font-logo)] text-lg tracking-wide text-muted-foreground hover:text-foreground"
                    >
                      Админ панель
                    </Link>
                  )}
                  <Link
                    href="/profile/activity"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3 font-[family-name:var(--font-logo)] text-lg tracking-wide text-muted-foreground hover:text-foreground"
                  >
                    <span>Комментарии</span>
                    {unreadCount > 0 && (
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-3 font-[family-name:var(--font-logo)] text-lg tracking-wide text-muted-foreground hover:text-foreground"
                  >
                    Профиль
                  </Link>
                </>
              ) : (
                <Link
                  href="/auth/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 font-[family-name:var(--font-logo)] text-lg tracking-wide text-primary"
                >
                  Войти
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
