import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

const MENTIONABLE_FILTER = `(username IS NOT NULL OR NULLIF(TRIM(display_name), '') IS NOT NULL)`

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Number(searchParams.get('limit') ?? 12), 20)

  const users = query
    ? await db.queryMany<{
        id: string
        username: string | null
        display_name: string | null
        avatar_url: string | null
      }>(
        `SELECT id, username, display_name, avatar_url
         FROM profiles
         WHERE ${MENTIONABLE_FILTER}
           AND id <> $3
           AND (username ILIKE $1 OR display_name ILIKE $1)
         ORDER BY
           CASE WHEN username ILIKE $2 THEN 0 WHEN display_name ILIKE $2 THEN 1 ELSE 2 END,
           COALESCE(display_name, username) ASC
         LIMIT $4`,
        [`%${query}%`, `${query}%`, session.user.id, limit]
      )
    : await db.queryMany<{
        id: string
        username: string | null
        display_name: string | null
        avatar_url: string | null
      }>(
        `SELECT id, username, display_name, avatar_url
         FROM profiles
         WHERE ${MENTIONABLE_FILTER}
           AND id <> $1
         ORDER BY COALESCE(display_name, username) ASC
         LIMIT $2`,
        [session.user.id, limit]
      )

  return NextResponse.json({ users })
}
