import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import Image from 'next/image'
import Link from 'next/link'
import { Camera, Images } from 'lucide-react'
import type { Album } from '@/lib/types'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  segments: ['Фотогалерея'],
  description: 'Фотографии с концертов и мероприятий группы MARINERO',
})

const demoPhotos = [
  { url: '/images/marinero/hero_bg.jpg', alt: 'MARINERO на сцене' },
  { url: '/images/marinero/gallery_1.jpg', alt: 'Концерт в Валенсии' },
  { url: '/images/marinero/gallery_4.jpg', alt: 'Выступление' },
  { url: '/images/marinero/gallery_5.jpg', alt: 'Басист' },
  { url: '/images/marinero/gallery_6.jpg', alt: 'Гитарист' },
  { url: '/images/marinero/gallery_3.jpg', alt: 'На сцене' },
  { url: '/images/marinero/gallery_2.jpg', alt: 'Дуэт' },
  { url: '/images/marinero/gallery_7.jpg', alt: 'Вокалист' },
  { url: '/images/marinero/gallery_8.jpg', alt: 'Репетиция' },
  { url: '/images/marinero/gallery_9.jpg', alt: 'Гитара' },
  { url: '/images/marinero/gallery_10.jpg', alt: 'Концерт' },
  { url: '/images/marinero/gallery_11.jpg', alt: 'Гитарист' },
  { url: '/images/marinero/gallery_12.jpg', alt: 'Портрет' },
  { url: '/images/marinero/gallery_13.jpg', alt: 'Рок стиль' },
  { url: '/images/marinero/gallery_14.jpg', alt: 'Педали' },
  { url: '/images/marinero/gallery_15.jpg', alt: 'Выступление' },
]

export default async function GalleryPage() {
  const { user, isAdmin, displayName } = await getSessionUser()

  const albumRows = await db.queryMany<Album & { photo_count: number }>(
    `SELECT a.*, COUNT(p.id)::int AS photo_count
     FROM albums a
     LEFT JOIN photos p ON p.album_id = a.id
     WHERE a.is_published = true
     GROUP BY a.id
     ORDER BY a.event_date DESC NULLS LAST`
  )

  const albums = albumRows.map(({ photo_count, ...album }) => ({
    ...album,
    photo_count,
  }))

  const hasAlbums = albums.length > 0

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} isAdmin={isAdmin} displayName={displayName} />
      
      <main className="flex-1">
        <section className="py-16 bg-card border-b border-border">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Фотогалерея
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Моменты с концертов, репетиций и закулисья MARINERO
            </p>
          </div>
        </section>

        {hasAlbums ? (
          <section className="py-16">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {albums.map((album) => (
                  <Link
                    key={album.id}
                    href={`/gallery/${album.slug}`}
                    className="group relative overflow-hidden rounded-xl bg-card border border-border hover:border-primary/50 transition-all"
                  >
                    <div className="relative aspect-[4/3]">
                      {album.cover_image_url ? (
                        <Image
                          src={album.cover_image_url}
                          alt={album.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-secondary flex items-center justify-center">
                          <Images className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="font-semibold text-lg mb-1">{album.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Camera className="h-4 w-4" />
                        <span>{album.photo_count} фото</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="py-16">
            <div className="container mx-auto px-4">
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                {demoPhotos.map((photo, index) => (
                  <div
                    key={index}
                    className="break-inside-avoid group relative overflow-hidden rounded-xl"
                  >
                    <div className="relative">
                      <Image
                        src={photo.url}
                        alt={photo.alt}
                        width={600}
                        height={index % 3 === 0 ? 800 : index % 2 === 0 ? 600 : 400}
                        className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      
      <Footer />
    </div>
  )
}
