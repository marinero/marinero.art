import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { resolveAlbum } from '@/lib/admin-resolve'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id: idOrSlug } = await params
  const album = await resolveAlbum<Record<string, unknown>>(idOrSlug)

  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 })
  }

  const photos = await db.queryMany(
    'SELECT * FROM photos WHERE album_id = $1 ORDER BY order_index ASC',
    [album.id]
  )

  return NextResponse.json({ album, photos })
}

export async function PATCH(
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

  if (typeof body.is_published === 'boolean' && Object.keys(body).length === 1) {
    await db.query(
      'UPDATE albums SET is_published = $2, updated_at = now() WHERE id = $1',
      [album.id, body.is_published]
    )
    return NextResponse.json({ ok: true })
  }

  if (
    typeof body.cover_image_url === 'string' &&
    Object.keys(body).length === 1
  ) {
    await db.query(
      'UPDATE albums SET cover_image_url = $2, updated_at = now() WHERE id = $1',
      [album.id, body.cover_image_url]
    )
    return NextResponse.json({ ok: true })
  }

  await db.query(
    `UPDATE albums SET
       title = $2,
       slug = $3,
       description = $4,
       cover_image_url = $5,
       event_date = $6,
       is_published = $7,
       updated_at = now()
     WHERE id = $1`,
    [
      album.id,
      body.title,
      body.slug,
      body.description ?? null,
      body.cover_image_url ?? null,
      body.event_date ?? null,
      body.is_published ?? false,
    ]
  )

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id: idOrSlug } = await params
  const album = await resolveAlbum<{ id: string }>(idOrSlug)

  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 })
  }

  await db.query('DELETE FROM albums WHERE id = $1', [album.id])

  return NextResponse.json({ ok: true })
}
