import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET() {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const videos = await db.queryMany(
    'SELECT * FROM videos ORDER BY order_index ASC'
  )

  return NextResponse.json({ videos })
}

export async function POST(request: Request) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const body = await request.json()

  const countResult = await db.queryOne<{ count: string }>(
    'SELECT count(*)::text AS count FROM videos'
  )
  const orderIndex = body.order_index ?? Number(countResult?.count ?? 0)

  const created = await db.queryOne<{ id: string }>(
    `INSERT INTO videos (
       title, slug, description, video_url, video_type,
       thumbnail_url, is_published, order_index
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      body.title,
      body.slug,
      body.description ?? null,
      body.video_url,
      body.video_type ?? 'youtube',
      body.thumbnail_url ?? null,
      body.is_published ?? true,
      orderIndex,
    ]
  )

  if (!created) {
    return NextResponse.json({ error: 'Failed to create video' }, { status: 500 })
  }

  return NextResponse.json({ id: created.id })
}
