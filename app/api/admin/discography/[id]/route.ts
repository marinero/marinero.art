import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { replaceDiscographyLinks } from '@/lib/discography'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id } = await params
  const body = await request.json()

  const fields: string[] = []
  const values: unknown[] = []
  let i = 1

  const allowed = [
    'title',
    'year',
    'release_type',
    'cover_image_url',
    'description',
    'order_index',
    'is_published',
  ] as const

  for (const key of allowed) {
    if (key in body) {
      fields.push(`${key} = $${i++}`)
      values.push(body[key])
    }
  }

  if (fields.length > 0) {
    fields.push('updated_at = now()')
    values.push(id)

    await db.query(
      `UPDATE discography SET ${fields.join(', ')} WHERE id = $${i}`,
      values
    )
  }

  if (Array.isArray(body.links)) {
    await replaceDiscographyLinks(id, body.links)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id } = await params
  await db.query('DELETE FROM discography WHERE id = $1', [id])

  return NextResponse.json({ ok: true })
}
