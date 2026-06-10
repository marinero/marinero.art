import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET() {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const links = await db.queryMany(
    'SELECT * FROM platform_links ORDER BY order_index ASC'
  )

  return NextResponse.json({ links })
}

export async function POST(request: Request) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const body = await request.json()

  const created = await db.queryOne<{ id: string }>(
    `INSERT INTO platform_links (platform, url, icon, order_index, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      body.platform,
      body.url,
      body.icon ?? null,
      body.order_index ?? 0,
      body.is_active ?? true,
    ]
  )

  if (!created) {
    return NextResponse.json({ error: 'Failed to create link' }, { status: 500 })
  }

  return NextResponse.json({ id: created.id })
}
