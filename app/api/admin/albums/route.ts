import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET() {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const albums = await db.queryMany(
    `SELECT a.*,
       (SELECT COUNT(*)::int FROM photos p WHERE p.album_id = a.id) AS photo_count
     FROM albums a
     ORDER BY a.event_date DESC NULLS LAST`
  )

  return NextResponse.json({ albums })
}

export async function POST(request: Request) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const body = await request.json()

  const created = await db.queryOne<{ id: string }>(
    `INSERT INTO albums (
       slug, title, description, cover_image_url, event_date, is_published
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      body.slug,
      body.title,
      body.description ?? null,
      body.cover_image_url ?? null,
      body.event_date ?? null,
      body.is_published ?? false,
    ]
  )

  if (!created) {
    return NextResponse.json({ error: 'Failed to create album' }, { status: 500 })
  }

  return NextResponse.json({ id: created.id })
}
