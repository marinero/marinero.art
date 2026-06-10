import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import type { BandMember, MemberTimelineSegment } from '@/lib/types'

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

export async function GET() {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const members = await db.queryMany<BandMember>(
    `SELECT * FROM band_members
     ORDER BY is_current DESC, order_index ASC, name ASC`
  )

  const segments = await db.queryMany<MemberTimelineSegment>(
    `SELECT * FROM member_timeline
     ORDER BY order_index ASC, start_year ASC`
  )

  const byMember = new Map<string, MemberTimelineSegment[]>()
  for (const s of segments) {
    const arr = byMember.get(s.member_id) ?? []
    arr.push(s)
    byMember.set(s.member_id, arr)
  }

  const withSegments = members.map((m) => ({
    ...m,
    segments: byMember.get(m.id) ?? [],
  }))

  return NextResponse.json({ members: withSegments })
}

export async function POST(request: Request) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const body = await request.json()

  const created = await db.queryOne<{ id: string }>(
    `INSERT INTO band_members (
       name, photo_url, instruments, bio, is_current, order_index
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      body.name,
      body.photo_url ?? null,
      body.instruments ?? null,
      body.bio ?? null,
      body.is_current ?? true,
      body.order_index ?? 0,
    ]
  )

  if (!created) {
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 })
  }

  await saveSegments(created.id, body.segments ?? [])

  return NextResponse.json({ id: created.id })
}
