import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

async function attachProfiles<T extends { user_id: string }>(comments: T[]) {
  if (comments.length === 0) return []

  const userIds = [...new Set(comments.map((c) => c.user_id))]
  const profiles = await db.queryMany<{
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
  }>(
    `SELECT id, username, display_name, avatar_url FROM profiles WHERE id = ANY($1::uuid[])`,
    [userIds]
  )
  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  return comments.map((c) => ({
    ...c,
    profile: profileMap.get(c.user_id) ?? null,
  }))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const groupId = searchParams.get('group_id')

  if (!groupId) {
    return NextResponse.json({ error: 'group_id is required' }, { status: 400 })
  }

  const comments = await db.queryMany<{ id: string; user_id: string; content: string; multitrack_group_id: string; timestamp_seconds: number | null; solo_track_id: string | null; parent_id: string | null; created_at: string; updated_at: string }>(
    `SELECT * FROM multitrack_comments
     WHERE multitrack_group_id = $1
     ORDER BY created_at ASC`,
    [groupId]
  )

  return NextResponse.json(await attachProfiles(comments))
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { multitrack_group_id, content, timestamp_seconds, solo_track_id, parent_id } = body

  if (!multitrack_group_id || !content) {
    return NextResponse.json(
      { error: 'multitrack_group_id and content are required' },
      { status: 400 }
    )
  }

  const comment = await db.queryOne<{ id: string; user_id: string; content: string; multitrack_group_id: string; timestamp_seconds: number | null; solo_track_id: string | null; parent_id: string | null; created_at: string; updated_at: string }>(
    `INSERT INTO multitrack_comments (
       multitrack_group_id, user_id, content, timestamp_seconds, solo_track_id, parent_id
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      multitrack_group_id,
      session.user.id,
      content,
      timestamp_seconds ?? null,
      solo_track_id ?? null,
      parent_id ?? null,
    ]
  )

  if (!comment) {
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }

  const [withProfile] = await attachProfiles([comment])
  return NextResponse.json(withProfile)
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const commentId = searchParams.get('id')

  if (!commentId) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const comment = await db.queryOne<{ user_id: string }>(
    'SELECT user_id FROM multitrack_comments WHERE id = $1',
    [commentId]
  )

  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  const profile = await db.queryOne<{ role: string }>(
    'SELECT role FROM profiles WHERE id = $1',
    [session.user.id]
  )

  if (comment.user_id !== session.user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.query('DELETE FROM multitrack_comments WHERE id = $1', [commentId])
  return NextResponse.json({ success: true })
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, content } = body

  if (!id || !content) {
    return NextResponse.json({ error: 'id and content are required' }, { status: 400 })
  }

  const comment = await db.queryOne<{ user_id: string }>(
    'SELECT user_id FROM multitrack_comments WHERE id = $1',
    [id]
  )

  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  if (comment.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updated = await db.queryOne<{ id: string; user_id: string; content: string; multitrack_group_id: string; timestamp_seconds: number | null; solo_track_id: string | null; parent_id: string | null; created_at: string; updated_at: string }>(
    `UPDATE multitrack_comments
     SET content = $2, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, content]
  )

  if (!updated) {
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 })
  }

  const [withProfile] = await attachProfiles([updated])
  return NextResponse.json(withProfile)
}
