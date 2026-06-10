'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Calendar,
  Images,
  Link as LinkIcon,
  Users,
  LogOut,
  Menu,
  X,
  Home,
  Music,
  MessageSquare,
  FileText,
  Video,
  Info,
  Disc3,
  UserSquare,
} from 'lucide-react'

const navItems = [
  { href: '/admin', label: 'Обзор', icon: LayoutDashboard },
  { href: '/admin/about', label: 'О нас', icon: Info },
  { href: '/admin/discography', label: 'Дискография', icon: Disc3 },
  { href: '/admin/members', label: 'Участники', icon: UserSquare },
  { href: '/admin/events', label: 'Концерты', icon: Calendar },
  { href: '/admin/videos', label: 'Видео', icon: Video },
  { href: '/admin/albums', label: 'Альбомы', icon: Images },
  { href: '/admin/rehearsals', label: 'Репетиции', icon: Music },
  { href: '/admin/songs', label: 'Тексты песен', icon: FileText },
  { href: '/admin/comments', label: 'Комментарии', icon: MessageSquare },
  { href: '/admin/links', label: 'Ссылки', icon: LinkIcon },
  { href: '/admin/users', label: 'Пользователи', icon: Users },
]

interface AdminSidebarProps {
  userName: string
}

export function AdminSidebar({ userName }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await signOut({ redirect: false })
    router.push('/')
    router.refresh()
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/marinero/marinero_logo.png"
            alt="MARINERO"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <div>
            <span className="font-display text-lg font-bold text-primary">MARINERO</span>
            <p className="text-xs text-muted-foreground">Админ панель</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || 
            (item.href !== '/admin' && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User & Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <Link href="/">
          <Button variant="outline" className="w-full justify-start gap-2">
            <Home className="h-4 w-4" />
            На сайт
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <p className="font-medium truncate max-w-[140px]">{userName}</p>
            <p className="text-xs text-muted-foreground">Администратор</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile Toggle */}
      <Button
        variant="outline"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border flex flex-col transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent />
      </aside>
    </>
  )
}
