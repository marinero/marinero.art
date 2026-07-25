import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { commentTypeSupportsChords, sanitizeCommentChords } from '@/lib/text-chords'

async function checkCommentPermission(commentId: string, userId: string) {
  const comment = await db.queryOne<{ user_id: string; type: string; content: string }>(
    'SELECT user_id, type, content FROM comments WHERE id = $1',
    [commentId]
  )

  if (!comment) {
    return { error: NextResponse.json({ error: 'Comment not found' }, { status: 404 }) }
  }

  const profile = await db.queryOne<{ role: string }>(
    'SELECT role FROM profiles WHERE id = $1',
    [userId]
  )

  const isAdmin = profile?.role === 'admin'
  if (comment.user_id !== userId && !isAdmin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { comment, isAdmin }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const permission = await checkCommentPermission(id, session.user.id)
  if ('error' in permission) return permission.error

  const body = await request.json()
  const { content, timestamp_seconds, chords } = body

  const updateData: { content?: string; timestamp_seconds?: number | null } = {}

  if (typeof content === 'string' && content.trim()) {
    updateData.content = content.trim()
  }

  if (permission.isAdmin && timestamp_seconds !== undefined) {
    updateData.timestamp_seconds = timestamp_seconds
  }

  // Chords are re-evaluated against the effective (new or existing) content.
  let chordsUpdate: { value: string | null } | null = null
  if (chords !== undefined && commentTypeSupportsChords(permission.comment.type)) {
    const effectiveContent = updateData.content ?? permission.comment.content
    const sanitized = sanitizeCommentChords(chords, effectiveContent.length)
    chordsUpdate = { value: sanitized ? JSON.stringify(sanitized) : null }
  }

  if (Object.keys(updateData).length === 0 && !chordsUpdate) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const updated = await db.queryOne(
    `UPDATE comments SET
       content = COALESCE($2, content),
       timestamp_seconds = COALESCE($3, timestamp_seconds),
       chords = CASE WHEN $4 THEN $5::jsonb ELSE chords END
     WHERE id = $1
     RETURNING *`,
    [
      id,
      updateData.content ?? null,
      updateData.timestamp_seconds ?? null,
      chordsUpdate !== null,
      chordsUpdate?.value ?? null,
    ]
  )

  if (!updated) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ comment: updated })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const permission = await checkCommentPermission(id, session.user.id)
  if ('error' in permission) return permission.error

  await db.query('DELETE FROM comments WHERE id = $1', [id])

  return NextResponse.json({ success: true })
}
