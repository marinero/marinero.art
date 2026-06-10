import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id } = await params

  const [albumRows, videoRows] = await Promise.all([
    db.queryMany<{ album_id: string }>(
      `SELECT album_id FROM event_albums
       WHERE event_id = $1
       ORDER BY display_order ASC`,
      [id]
    ),
    db.queryMany<{ video_id: string }>(
      `SELECT video_id FROM event_videos
       WHERE event_id = $1
       ORDER BY display_order ASC`,
      [id]
    ),
  ])

  return NextResponse.json({
    albumIds: albumRows.map((row) => row.album_id),
    videoIds: videoRows.map((row) => row.video_id),
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id } = await params
  const body = await request.json()

  if (typeof body.is_published === 'boolean' && Object.keys(body).length === 1) {
    await db.query(
      'UPDATE events SET is_published = $2, updated_at = now() WHERE id = $1',
      [id, body.is_published]
    )
    return NextResponse.json({ ok: true })
  }

  await db.query(
    `UPDATE events SET
       title = $2,
       slug = $3,
       description = $4,
       venue = $5,
       city = $6,
       event_date = $7,
       doors_time = $8,
       venue_address = $9,
       google_maps_url = $10,
       how_to_get = $11,
       entry_rules = $12,
       contacts = $13,
       ticket_url = $14,
       image_url = $15,
       is_published = $16,
       updated_at = now()
     WHERE id = $1`,
    [
      id,
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

  if (Array.isArray(body.albumIds) && Array.isArray(body.videoIds)) {
    await saveEventRelations(id, body.albumIds, body.videoIds)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id } = await params
  await db.query('DELETE FROM events WHERE id = $1', [id])

  return NextResponse.json({ ok: true })
}
