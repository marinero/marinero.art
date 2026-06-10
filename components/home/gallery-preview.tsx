import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Camera } from 'lucide-react'
import { db } from '@/lib/db'
import type { Photo } from '@/lib/types'

const demoPhotos = [
  '/images/marinero/hero_bg.jpg',
  '/images/marinero/gallery_1.jpg',
  '/images/marinero/gallery_2.jpg',
  '/images/marinero/gallery_3.jpg',
  '/images/marinero/gallery_4.jpg',
]

export async function GalleryPreview() {
  const photos = await db.queryMany<Photo>(
    `SELECT p.* FROM photos p
     INNER JOIN albums a ON a.id = p.album_id
     WHERE a.is_published = true
     ORDER BY p.created_at DESC
     LIMIT 5`
  )

  const displayPhotos = photos.length
    ? photos.map((photo) => ({
        id: photo.id,
        url: photo.thumbnail_url || photo.url,
        alt: photo.caption || 'MARINERO фото',
      }))
    : demoPhotos.map((url, index) => ({
        id: String(index),
        url,
        alt: `MARINERO фото ${index + 1}`,
      }))

  return (
    <section className="py-20 bg-card">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">
              Фотогалерея
            </h2>
            <p className="text-muted-foreground">
              Моменты с концертов и репетиций
            </p>
          </div>
          <Link href="/gallery" className="hidden md:block">
            <Button variant="outline" className="gap-2">
              Все фото
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 md:grid-rows-2 gap-4">
          {displayPhotos.map((photo, index) => (
            <Link
              key={photo.id}
              href="/gallery"
              className={`relative overflow-hidden rounded-xl group ${
                index === 0 ? 'row-span-2' : ''
              }`}
            >
              <div className={`relative h-full ${index === 0 ? 'aspect-[3/4]' : 'aspect-square'}`}>
                <Image
                  src={photo.url}
                  alt={photo.alt}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2 text-white">
                    <Camera className="h-4 w-4" />
                    <span className="text-sm">Смотреть</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 md:hidden text-center">
          <Link href="/gallery">
            <Button variant="outline" className="gap-2">
              Все фото
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
