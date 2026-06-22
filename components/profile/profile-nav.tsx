'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const profileLinks = [
  { href: '/profile', label: 'Аккаунт' },
  { href: '/profile/activity', label: 'Комментарии' },
]

export function ProfileNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 border-b border-border">
      {profileLinks.map((link) => {
        const isActive =
          link.href === '/profile'
            ? pathname === '/profile'
            : pathname.startsWith(link.href)

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
