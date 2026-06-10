import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { resolveSongText } from '@/lib/admin-resolve'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id: idOrSlug } = await params
  const song = await resolveSongText<Record<string, unknown>>(idOrSlug)

  if (!song) {
    return NextResponse.json({ error: 'Song not found' }, { status: 404 })
  }

  const chords = await db.queryMany(
    `SELECT stc.*,
       row_to_json(c.*) AS chord
     FROM song_text_chords stc
     JOIN chords c ON c.id = stc.chord_id
     WHERE stc.song_text_id = $1
     ORDER BY stc.position ASC`,
    [song.id]
  )

  return NextResponse.json({ song, chords })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id: idOrSlug } = await params
  const song = await resolveSongText<{ id: string }>(idOrSlug)

  if (!song) {
    return NextResponse.json({ error: 'Song not found' }, { status: 404 })
  }

  const body = await request.json()

  if (typeof body.is_published === 'boolean' && Object.keys(body).length === 1) {
    await db.query(
      'UPDATE song_texts SET is_published = $2, updated_at = now() WHERE id = $1',
      [song.id, body.is_published]
    )
    return NextResponse.json({ ok: true })
  }

  await db.query(
    `UPDATE song_texts SET
       title = COALESCE($2, title),
       text_content = COALESCE($3, text_content),
       bpm = $4,
       updated_at = now()
     WHERE id = $1`,
    [
      song.id,
      body.title ?? null,
      body.text_content ?? null,
      body.bpm ?? null,
    ]
  )

  if (Array.isArray(body.chords)) {
    await db.query('DELETE FROM song_text_chords WHERE song_text_id = $1', [
      song.id,
    ])

    for (const chord of body.chords) {
      await db.query(
        `INSERT INTO song_text_chords (song_text_id, chord_id, position)
         VALUES ($1, $2, $3)`,
        [song.id, chord.chord_id, chord.position]
      )
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id: idOrSlug } = await params
  const song = await resolveSongText<{ id: string }>(idOrSlug)

  if (!song) {
    return NextResponse.json({ error: 'Song not found' }, { status: 404 })
  }

  await db.query('DELETE FROM song_texts WHERE id = $1', [song.id])

  return NextResponse.json({ ok: true })
}
