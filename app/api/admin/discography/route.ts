import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { replaceDiscographyLinks } from '@/lib/discography'
import type { DiscographyItem, DiscographyLink } from '@/lib/types'

export async function GET() {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const items = await db.queryMany<DiscographyItem>(
    `SELECT * FROM discography
     ORDER BY order_index ASC, year DESC NULLS LAST`
  )

  if (items.length) {
    const ids = items.map((i) => i.id)
    const links = await db.queryMany<DiscographyLink>(
      `SELECT * FROM discography_links
       WHERE discography_id = ANY($1)
       ORDER BY order_index ASC, created_at ASC`,
      [ids]
    )
    const byItem = new Map<string, DiscographyLink[]>()
    for (const link of links) {
      const arr = byItem.get(link.discography_id) ?? []
      arr.push(link)
      byItem.set(link.discography_id, arr)
    }
    for (const item of items) {
      item.links = byItem.get(item.id) ?? []
    }
  }

  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const body = await request.json()

  const created = await db.queryOne<{ id: string }>(
    `INSERT INTO discography (
       title, year, release_type, cover_image_url, description, order_index, is_published
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      body.title,
      body.year ?? null,
      body.release_type ?? 'album',
      body.cover_image_url ?? null,
      body.description ?? null,
      body.order_index ?? 0,
      body.is_published ?? true,
    ]
  )

  if (!created) {
    return NextResponse.json({ error: 'Failed to create release' }, { status: 500 })
  }

  if (Array.isArray(body.links)) {
    await replaceDiscographyLinks(created.id, body.links)
  }

  return NextResponse.json({ id: created.id })
}
