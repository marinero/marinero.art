import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

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
      'UPDATE videos SET is_published = $2, updated_at = now() WHERE id = $1',
      [id, body.is_published]
    )
    return NextResponse.json({ ok: true })
  }

  // Assign / clear the song for a video
  if ('song_text_id' in body && Object.keys(body).length === 1) {
    await db.query(
      'UPDATE videos SET song_text_id = $2, updated_at = now() WHERE id = $1',
      [id, body.song_text_id ?? null]
    )
    return NextResponse.json({ ok: true })
  }

  await db.query(
    `UPDATE videos SET
       title = $2,
       slug = $3,
       description = $4,
       video_url = $5,
       video_type = $6,
       thumbnail_url = $7,
       is_published = $8,
       order_index = $9,
       song_text_id = $10,
       updated_at = now()
     WHERE id = $1`,
    [
      id,
      body.title,
      body.slug,
      body.description ?? null,
      body.video_url,
      body.video_type ?? 'youtube',
      body.thumbnail_url ?? null,
      body.is_published ?? true,
      body.order_index ?? 0,
      body.song_text_id ?? null,
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

  const { id } = await params
  await db.query('DELETE FROM videos WHERE id = $1', [id])

  return NextResponse.json({ ok: true })
}
