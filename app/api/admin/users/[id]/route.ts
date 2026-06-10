import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id: userId } = await params

  const row = await db.queryOne<{
    id: string
    email: string
    email_verified: boolean
    created_at: string
    username: string | null
    display_name: string | null
    role: string | null
    profile_created_at: string | null
    profile_updated_at: string | null
  }>(
    `SELECT u.id, u.email, u.email_verified, u.created_at,
       p.username, p.display_name, p.role,
       p.created_at AS profile_created_at,
       p.updated_at AS profile_updated_at
     FROM users u
     LEFT JOIN profiles p ON p.id = u.id
     WHERE u.id = $1`,
    [userId]
  )

  if (!row) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const countResult = await db.queryOne<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM comments WHERE user_id = $1',
    [userId]
  )

  return NextResponse.json({
    user: {
      id: row.id,
      username: row.username,
      display_name: row.display_name,
      role: row.role || 'fan',
      email: row.email,
      email_confirmed: row.email_verified,
      created_at: row.profile_created_at || row.created_at,
      last_sign_in_at: null,
      comment_count: Number(countResult?.count ?? 0),
    },
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id: userId } = await params
  const body = await request.json()

  if (!body.role || !['fan', 'admin'].includes(body.role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const updated = await db.queryOne<{ id: string }>(
    `UPDATE profiles SET role = $2, updated_at = now() WHERE id = $1 RETURNING id`,
    [userId, body.role]
  )

  if (!updated) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
