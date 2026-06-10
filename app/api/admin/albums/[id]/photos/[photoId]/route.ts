import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { photoId } = await params
  const body = await request.json()

  await db.query('UPDATE photos SET caption = $2 WHERE id = $1', [
    photoId,
    body.caption ?? null,
  ])

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { photoId } = await params
  await db.query('DELETE FROM photos WHERE id = $1', [photoId])

  return NextResponse.json({ ok: true })
}
