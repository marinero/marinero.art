import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import type { Chord } from '@/lib/types'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult) return authResult.error

  const { id } = await params
  const body = await request.json()
  const { name, root_note, chord_type, fret_positions, finger_positions, base_fret } = body

  if (!name?.trim() || !fret_positions) {
    return NextResponse.json({ error: 'name and fret_positions are required' }, { status: 400 })
  }

  const chord = await db.queryOne<Chord>(
    `UPDATE chords SET
       name = $2,
       root_note = $3,
       chord_type = $4,
       fret_positions = $5,
       finger_positions = $6,
       base_fret = $7
     WHERE id = $1
     RETURNING *`,
    [
      id,
      name.trim(),
      root_note ?? null,
      chord_type ?? 'unknown',
      JSON.stringify(fret_positions),
      finger_positions ? JSON.stringify(finger_positions) : null,
      base_fret ?? 1,
    ]
  )

  if (!chord) {
    return NextResponse.json({ error: 'Chord not found' }, { status: 404 })
  }

  return NextResponse.json({ chord })
}
