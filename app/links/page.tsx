import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import Image from 'next/image'
import type { PlatformLink } from '@/lib/types'
import { ExternalLink } from 'lucide-react'
import { PlatformIcon } from '@/components/platform-icon'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  segments: ['Слушать'],
  description: 'Слушайте музыку MARINERO на всех популярных платформах',
})

export default async function LinksPage() {
  const { user, isAdmin, displayName } = await getSessionUser()

  const links = await db.queryMany<PlatformLink>(
    'SELECT * FROM platform_links WHERE is_active = true ORDER BY order_index'
  )

  const platformLinks: PlatformLink[] = links.length ? links : [
    { id: '1', platform: 'Spotify', url: 'https://open.spotify.com/', icon: null, order_index: 1, is_active: true, created_at: '' },
    { id: '2', platform: 'YouTube', url: 'https://youtube.com/', icon: null, order_index: 2, is_active: true, created_at: '' },
    { id: '3', platform: 'Apple Music', url: 'https://music.apple.com/', icon: null, order_index: 3, is_active: true, created_at: '' },
    { id: '4', platform: 'VK Music', url: 'https://vk.com/music', icon: null, order_index: 4, is_active: true, created_at: '' },
    { id: '5', platform: 'Yandex Music', url: 'https://music.yandex.ru/', icon: null, order_index: 5, is_active: true, created_at: '' },
    { id: '6', platform: 'SoundCloud', url: 'https://soundcloud.com/', icon: null, order_index: 6, is_active: true, created_at: '' },
    { id: '7', platform: 'Instagram', url: 'https://instagram.com/', icon: null, order_index: 7, is_active: true, created_at: '' },
    { id: '8', platform: 'Telegram', url: 'https://t.me/', icon: null, order_index: 8, is_active: true, created_at: '' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} isAdmin={isAdmin} displayName={displayName} />
      
      <main className="flex-1">
        <section className="py-16 bg-card border-b border-border">
          <div className="container mx-auto px-4 text-center">
            <div className="flex justify-center mb-6">
              <Image
                src="/images/marinero/marinero_logo.png"
                alt="MARINERO"
                width={100}
                height={100}
                className="rounded-2xl"
              />
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Слушайте MARINERO
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Наша музыка доступна на всех популярных платформах. Выберите удобную для вас.
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto space-y-4">
              {platformLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-5 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-secondary/50 transition-all group"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <PlatformIcon platform={link.platform} className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{link.platform}</h3>
                  </div>
                  <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  )
}
