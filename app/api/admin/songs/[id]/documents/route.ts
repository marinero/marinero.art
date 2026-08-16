import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { resolveSongText } from '@/lib/admin-resolve'
import type { SongDocument } from '@/lib/types'

const VALID_KINDS = ['sheet', 'tab', 'other'] as const

export async function GET(
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

  const documents = await db.queryMany<SongDocument>(
    `SELECT * FROM song_documents
     WHERE song_text_id = $1
     ORDER BY order_index ASC, created_at ASC`,
    [song.id]
  )

  return NextResponse.json({ documents })
}

export async function POST(
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

  if (!body.file_url || !body.filename) {
    return NextResponse.json(
      { error: 'file_url and filename are required' },
      { status: 400 }
    )
  }

  const kind = VALID_KINDS.includes(body.kind) ? body.kind : 'sheet'
  const title = (body.title as string)?.trim() || (body.filename as string)

  const nextOrder = await db.queryOne<{ max: number | null }>(
    'SELECT MAX(order_index) AS max FROM song_documents WHERE song_text_id = $1',
    [song.id]
  )

  const created = await db.queryOne<SongDocument>(
    `INSERT INTO song_documents
       (song_text_id, title, kind, file_url, filename, content_type, size_bytes, is_published, order_index)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      song.id,
      title,
      kind,
      body.file_url,
      body.filename,
      body.content_type ?? null,
      body.size_bytes ?? null,
      body.is_published ?? false,
      (nextOrder?.max ?? -1) + 1,
    ]
  )

  return NextResponse.json({ document: created })
}
