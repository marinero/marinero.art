import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { resolveSongText } from '@/lib/admin-resolve'
import { normalizeTechMeta } from '@/lib/song-tech'
import { deleteStoredAudio, replaceSongLinks } from '@/lib/song-links'

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
  const song = await resolveSongText<{
    id: string
    audio_url: string | null
  }>(idOrSlug)

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

  const sets: string[] = ['updated_at = now()']
  const values: unknown[] = []
  let index = 2

  if (typeof body.title === 'string') {
    sets.push(`title = $${index++}`)
    values.push(body.title)
  }
  if (typeof body.text_content === 'string') {
    sets.push(`text_content = $${index++}`)
    values.push(body.text_content)
  }
  if (body.bpm !== undefined) {
    const bpm =
      typeof body.bpm === 'string' ? body.bpm.trim() || null : body.bpm
    sets.push(`bpm = $${index++}`)
    values.push(bpm)
  }
  if (body.tech_meta !== undefined) {
    sets.push(`tech_meta = $${index++}::jsonb`)
    values.push(JSON.stringify(normalizeTechMeta(body.tech_meta)))
  }
  if (body.audio_url !== undefined) {
    const nextUrl =
      typeof body.audio_url === 'string' && body.audio_url.trim()
        ? body.audio_url.trim()
        : null
    if (song.audio_url && song.audio_url !== nextUrl) {
      await deleteStoredAudio(song.audio_url)
    }
    sets.push(`audio_url = $${index++}`)
    values.push(nextUrl)
  }
  if (body.audio_filename !== undefined) {
    const nextName =
      typeof body.audio_filename === 'string' && body.audio_filename.trim()
        ? body.audio_filename.trim()
        : null
    sets.push(`audio_filename = $${index++}`)
    values.push(nextName)
  }

  if (sets.length > 1) {
    await db.query(
      `UPDATE song_texts SET ${sets.join(', ')} WHERE id = $1`,
      [song.id, ...values]
    )
  }

  if (Array.isArray(body.links)) {
    await replaceSongLinks(song.id, body.links)
  }

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
  const song = await resolveSongText<{ id: string; audio_url: string | null }>(idOrSlug)

  if (!song) {
    return NextResponse.json({ error: 'Song not found' }, { status: 404 })
  }

  await deleteStoredAudio(song.audio_url)
  await db.query('DELETE FROM song_texts WHERE id = $1', [song.id])

  return NextResponse.json({ ok: true })
}
