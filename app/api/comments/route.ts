import { auth } from '@/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { buildCommentThreads, type CommentRow } from '@/lib/comment-threads'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const objectId = searchParams.get('object_id')

  if (!type || !objectId) {
    return NextResponse.json({ error: 'type and object_id required' }, { status: 400 })
  }

  const rows = await db.queryMany<CommentRow>(
    `SELECT c.id, c.object_id, c.content, c.timestamp_seconds, c.created_at,
       c.user_id, c.parent_id, p.display_name, p.username, p.role
     FROM comments c
     LEFT JOIN profiles p ON p.id = c.user_id
     WHERE c.type = $1 AND c.object_id = $2
     ORDER BY c.created_at ASC`,
    [type, objectId]
  )

  return NextResponse.json({ comments: buildCommentThreads(rows) })
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { type, object_id, content, parent_id, timestamp_seconds } = body

  if (!type || !content?.trim()) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const created = await db.queryOne<{ id: string }>(
    `INSERT INTO comments (type, object_id, user_id, content, parent_id, timestamp_seconds)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      type,
      object_id ?? null,
      session.user.id,
      content.trim(),
      parent_id ?? null,
      timestamp_seconds ?? null,
    ]
  )

  if (!created) {
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }

  return NextResponse.json({ id: created.id })
}
