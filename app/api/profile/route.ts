import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import type { Profile } from '@/lib/types'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await db.queryOne<Profile>(
    'SELECT * FROM profiles WHERE id = $1',
    [session.user.id]
  )

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json({
    user: { id: session.user.id, email: session.user.email },
    profile,
  })
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : undefined
  const username =
    body.username === null || typeof body.username === 'string'
      ? body.username?.trim() || null
      : undefined

  if (displayName === undefined && username === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const profile = await db.queryOne<Profile>(
    `UPDATE profiles SET
       display_name = COALESCE($2, display_name),
       username = COALESCE($3, username),
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [session.user.id, displayName ?? null, username ?? null]
  )

  return NextResponse.json({ profile })
}
