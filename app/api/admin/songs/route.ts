import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET() {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const songs = await db.queryMany(
    'SELECT * FROM song_texts ORDER BY created_at DESC'
  )

  return NextResponse.json({ songs })
}

export async function POST(request: Request) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const body = await request.json()

  try {
    const created = await db.queryOne<{ id: string }>(
      `INSERT INTO song_texts (title, slug, text_content, bpm, is_published)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        body.title,
        body.slug,
        body.text_content ?? '',
        body.bpm ?? null,
        body.is_published ?? false,
      ]
    )

    if (!created) {
      return NextResponse.json({ error: 'Failed to create song' }, { status: 500 })
    }

    return NextResponse.json({ id: created.id })
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === '23505') {
      return NextResponse.json(
        { error: 'Song with this slug already exists' },
        { status: 409 }
      )
    }
    throw err
  }
}
