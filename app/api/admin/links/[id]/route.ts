import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id } = await params
  const body = await request.json()

  if (typeof body.is_active === 'boolean' && Object.keys(body).length === 1) {
    await db.query('UPDATE platform_links SET is_active = $2 WHERE id = $1', [
      id,
      body.is_active,
    ])
    return NextResponse.json({ ok: true })
  }

  if (
    typeof body.order_index === 'number' &&
    Object.keys(body).length === 1
  ) {
    await db.query('UPDATE platform_links SET order_index = $2 WHERE id = $1', [
      id,
      body.order_index,
    ])
    return NextResponse.json({ ok: true })
  }

  await db.query(
    `UPDATE platform_links SET
       platform = $2,
       url = $3,
       icon = $4,
       order_index = $5,
       is_active = $6
     WHERE id = $1`,
    [
      id,
      body.platform,
      body.url,
      body.icon ?? null,
      body.order_index ?? 0,
      body.is_active ?? true,
    ]
  )

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id } = await params
  await db.query('DELETE FROM platform_links WHERE id = $1', [id])

  return NextResponse.json({ ok: true })
}
