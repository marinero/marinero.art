import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { listSongsForSetlist, saveEventSongs } from '@/lib/event-setlist'

async function saveEventRelations(
  eventId: string,
  albumIds: string[],
  videoIds: string[]
) {
  await db.query('DELETE FROM event_albums WHERE event_id = $1', [eventId])
  await db.query('DELETE FROM event_videos WHERE event_id = $1', [eventId])

  for (let i = 0; i < albumIds.length; i++) {
    await db.query(
      `INSERT INTO event_albums (event_id, album_id, display_order)
       VALUES ($1, $2, $3)`,
      [eventId, albumIds[i], i]
    )
  }

  for (let i = 0; i < videoIds.length; i++) {
    await db.query(
      `INSERT INTO event_videos (event_id, video_id, display_order)
       VALUES ($1, $2, $3)`,
      [eventId, videoIds[i], i]
    )
  }
}

export async function GET() {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const [events, albums, videos, songs] = await Promise.all([
    db.queryMany('SELECT * FROM events ORDER BY event_date ASC'),
    db.queryMany('SELECT * FROM albums ORDER BY event_date DESC NULLS LAST'),
    db.queryMany('SELECT * FROM videos ORDER BY order_index ASC'),
    listSongsForSetlist(),
  ])

  return NextResponse.json({ events, albums, videos, songs })
}

export async function POST(request: Request) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const body = await request.json()
  const albumIds: string[] = body.albumIds ?? []
  const videoIds: string[] = body.videoIds ?? []
  const songIds: string[] = body.songIds ?? []

  const created = await db.queryOne<{ id: string }>(
    `INSERT INTO events (
       title, slug, description, venue, city, event_date,
       doors_time, venue_address, google_maps_url, how_to_get,
       entry_rules, contacts, ticket_url, image_url, is_published
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id`,
    [
      body.title,
      body.slug,
      body.description ?? null,
      body.venue ?? null,
      body.city ?? null,
      body.event_date,
      body.doors_time ?? null,
      body.venue_address ?? null,
      body.google_maps_url ?? null,
      body.how_to_get ?? null,
      body.entry_rules ?? null,
      body.contacts ?? null,
      body.ticket_url ?? null,
      body.image_url ?? null,
      body.is_published ?? true,
    ]
  )

  if (!created) {
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }

  await saveEventRelations(created.id, albumIds, videoIds)
  await saveEventSongs(created.id, songIds)

  return NextResponse.json({ id: created.id })
}
