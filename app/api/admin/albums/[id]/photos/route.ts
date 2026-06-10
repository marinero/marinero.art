import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { resolveAlbum } from '@/lib/admin-resolve'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id: idOrSlug } = await params
  const album = await resolveAlbum<{ id: string }>(idOrSlug)

  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 })
  }

  const body = await request.json()

  const countResult = await db.queryOne<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM photos WHERE album_id = $1',
    [album.id]
  )
  const orderIndex = body.order_index ?? Number(countResult?.count ?? 0)

  const created = await db.queryOne<{ id: string }>(
    `INSERT INTO photos (album_id, url, thumbnail_url, caption, order_index)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      album.id,
      body.url,
      body.thumbnail_url ?? null,
      body.caption ?? null,
      orderIndex,
    ]
  )

  if (!created) {
    return NextResponse.json({ error: 'Failed to create photo' }, { status: 500 })
  }

  return NextResponse.json({ id: created.id })
}
