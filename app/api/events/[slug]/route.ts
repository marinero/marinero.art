import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { Album, Event, Video } from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const event = await db.queryOne<Event>(
    `SELECT * FROM events
     WHERE slug = $1 AND is_published = true`,
    [slug]
  )

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const albums = await db.queryMany<Album & { photo_count: number; display_order: number }>(
    `SELECT a.*, ea.display_order, COUNT(p.id)::int AS photo_count
     FROM event_albums ea
     INNER JOIN albums a ON a.id = ea.album_id
     LEFT JOIN photos p ON p.album_id = a.id
     WHERE ea.event_id = $1 AND a.is_published = true
     GROUP BY ea.display_order, a.id
     ORDER BY ea.display_order ASC`,
    [event.id]
  )

  const videos = await db.queryMany<Video & { display_order: number }>(
    `SELECT v.*, ev.display_order
     FROM event_videos ev
     INNER JOIN videos v ON v.id = ev.video_id
     WHERE ev.event_id = $1 AND v.is_published = true
     ORDER BY ev.display_order ASC`,
    [event.id]
  )

  return NextResponse.json({
    event,
    albums: albums.map(({ photo_count, ...album }) => ({
      ...album,
      photo_count,
    })),
    videos: videos.map(({ display_order: _, ...video }) => video),
  })
}
