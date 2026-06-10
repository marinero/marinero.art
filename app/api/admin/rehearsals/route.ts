import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET() {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const rehearsals = await db.queryMany(
    `SELECT r.id, r.rehearsal_date, r.created_at,
       (SELECT COUNT(*)::int FROM rehearsal_videos rv WHERE rv.rehearsal_id = r.id) AS videos_count,
       (SELECT COUNT(*)::int FROM audio_files af WHERE af.rehearsal_id = r.id) AS audio_files_count,
       (SELECT COUNT(*)::int FROM multitrack_groups mg WHERE mg.rehearsal_id = r.id) AS multitrack_groups_count,
       (
         (SELECT COUNT(*)::int FROM comments c
          WHERE c.type = 'rehearsal' AND c.object_id = r.id)
         + (SELECT COUNT(*)::int FROM comments c
            JOIN audio_files af ON af.id = c.object_id
            WHERE c.type = 'audio' AND af.rehearsal_id = r.id)
         + (SELECT COUNT(*)::int FROM comments c
            JOIN rehearsal_videos rv ON rv.video_id = c.object_id
            WHERE c.type = 'video' AND rv.rehearsal_id = r.id)
         + (SELECT COUNT(*)::int FROM multitrack_comments mc
            JOIN multitrack_groups mg ON mg.id = mc.multitrack_group_id
            WHERE mg.rehearsal_id = r.id)
       ) AS comments_count
     FROM rehearsals r
     ORDER BY r.rehearsal_date DESC`
  )

  return NextResponse.json({ rehearsals })
}

export async function POST(request: Request) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const body = await request.json()

  if (!body.rehearsal_date) {
    return NextResponse.json(
      { error: 'rehearsal_date is required' },
      { status: 400 }
    )
  }

  const created = await db.queryOne<{ id: string }>(
    `INSERT INTO rehearsals (rehearsal_date) VALUES ($1::date) RETURNING id`,
    [body.rehearsal_date]
  )

  if (!created) {
    return NextResponse.json(
      { error: 'Failed to create rehearsal' },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: created.id })
}
