import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { deleteFile } from '@/lib/storage'
import { extractStorageKey } from '@/lib/storage-keys'
import type { SongDocument } from '@/lib/types'

const VALID_KINDS = ['sheet', 'tab', 'sheet_tab', 'other'] as const

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { docId } = await params
  const body = await request.json()

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM song_documents WHERE id = $1',
    [docId]
  )
  if (!existing) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const kind =
    body.kind !== undefined && VALID_KINDS.includes(body.kind) ? body.kind : null

  const updated = await db.queryOne<SongDocument>(
    `UPDATE song_documents SET
       title = COALESCE($2, title),
       kind = COALESCE($3, kind),
       is_published = COALESCE($4, is_published),
       order_index = COALESCE($5, order_index),
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      docId,
      typeof body.title === 'string' ? body.title.trim() : null,
      kind,
      typeof body.is_published === 'boolean' ? body.is_published : null,
      typeof body.order_index === 'number' ? body.order_index : null,
    ]
  )

  return NextResponse.json({ document: updated })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { docId } = await params

  const doc = await db.queryOne<{ file_url: string }>(
    'SELECT file_url FROM song_documents WHERE id = $1',
    [docId]
  )
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  await db.query('DELETE FROM song_documents WHERE id = $1', [docId])

  // Убираем файл из хранилища (не критично при ошибке — запись уже удалена).
  const key = extractStorageKey(doc.file_url)
  if (key) {
    try {
      await deleteFile(key)
    } catch (error) {
      console.error('Failed to delete document file:', error)
    }
  }

  return NextResponse.json({ ok: true })
}
