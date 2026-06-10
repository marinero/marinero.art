import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { Album, Photo } from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const album = await db.queryOne<Album>(
    `SELECT * FROM albums WHERE slug = $1 AND is_published = true`,
    [slug]
  )

  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 })
  }

  const photos = await db.queryMany<Photo>(
    `SELECT * FROM photos
     WHERE album_id = $1
     ORDER BY order_index ASC`,
    [album.id]
  )

  return NextResponse.json({ album, photos })
}
