import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function POST(request: Request) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { fileId, waveformData } = await request.json()

  if (!fileId || !waveformData) {
    return NextResponse.json({ error: 'Missing fileId or waveformData' }, { status: 400 })
  }

  const updated = await db.queryOne(
    `UPDATE multitrack_files
     SET waveform_data = $2::jsonb
     WHERE id = $1
     RETURNING id`,
    [fileId, JSON.stringify(waveformData)]
  )

  if (!updated) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
