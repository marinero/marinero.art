import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

interface SegmentInput {
  role: string
  start_year: number
  end_year: number | null
}

async function saveSegments(memberId: string, segments: SegmentInput[]) {
  await db.query('DELETE FROM member_timeline WHERE member_id = $1', [memberId])
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    if (!s?.role || !s.start_year) continue
    await db.query(
      `INSERT INTO member_timeline (member_id, role, start_year, end_year, order_index)
       VALUES ($1, $2, $3, $4, $5)`,
      [memberId, s.role, s.start_year, s.end_year ?? null, i]
    )
  }
}

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
    'name',
    'photo_url',
    'instruments',
    'bio',
    'is_current',
    'order_index',
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
      `UPDATE band_members SET ${fields.join(', ')} WHERE id = $${i}`,
      values
    )
  }

  if ('segments' in body) {
    await saveSegments(id, body.segments ?? [])
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
  await db.query('DELETE FROM band_members WHERE id = $1', [id])

  return NextResponse.json({ ok: true })
}
