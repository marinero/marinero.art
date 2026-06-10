import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import type { Chord } from '@/lib/types'

export async function GET() {
  const chords = await db.queryMany<Chord>(
    `SELECT * FROM chords
     ORDER BY root_note ASC, name ASC`
  )

  return NextResponse.json({ chords })
}

export async function POST(request: Request) {
  const authResult = await requireAdmin()
  if ('error' in authResult) return authResult.error

  const body = await request.json()
  const { name, root_note, chord_type, fret_positions, finger_positions, base_fret } = body

  if (!name?.trim() || !fret_positions) {
    return NextResponse.json({ error: 'name and fret_positions are required' }, { status: 400 })
  }

  try {
    const chord = await db.queryOne<Chord>(
      `INSERT INTO chords (name, root_note, chord_type, fret_positions, finger_positions, base_fret)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name.trim(),
        root_note ?? null,
        chord_type ?? 'unknown',
        fret_positions,
        finger_positions ?? null,
        base_fret ?? 1,
      ]
    )

    return NextResponse.json({ chord })
  } catch (error) {
    const pgError = error as { code?: string }
    if (pgError.code === '23505') {
      return NextResponse.json({ error: 'This chord already exists in the library' }, { status: 409 })
    }
    throw error
  }
}
