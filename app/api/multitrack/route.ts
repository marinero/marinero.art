import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rehearsalId = searchParams.get('rehearsal_id')

  if (!rehearsalId) {
    return NextResponse.json({ error: 'rehearsal_id is required' }, { status: 400 })
  }

  const groups = await db.queryMany<{ id: string; rehearsal_id: string; name: string; created_at: string }>(
    `SELECT * FROM multitrack_groups
     WHERE rehearsal_id = $1
     ORDER BY created_at ASC`,
    [rehearsalId]
  )

  const groupsWithFiles = await Promise.all(
    groups.map(async (group) => {
      const files = await db.queryMany(
        `SELECT * FROM multitrack_files
         WHERE multitrack_group_id = $1
         ORDER BY order_index ASC`,
        [group.id]
      )
      return { ...group, files }
    })
  )

  return NextResponse.json(groupsWithFiles)
}

export async function POST(request: Request) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const body = await request.json()
  const { rehearsal_id, name, files } = body

  if (!rehearsal_id || !name || !files || files.length === 0) {
    return NextResponse.json(
      { error: 'rehearsal_id, name, and files are required' },
      { status: 400 }
    )
  }

  const group = await db.queryOne<{ id: string }>(
    `INSERT INTO multitrack_groups (rehearsal_id, name)
     VALUES ($1, $2)
     RETURNING *`,
    [rehearsal_id, name]
  )

  if (!group) {
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }

  const insertedFiles = []
  for (let index = 0; index < files.length; index++) {
    const file = files[index] as {
      filename: string
      file_url: string
      duration_seconds?: number
      waveform_data?: number[]
    }
    const inserted = await db.queryOne(
      `INSERT INTO multitrack_files (
         multitrack_group_id, filename, file_url, duration_seconds,
         waveform_data, volume, order_index
       ) VALUES ($1, $2, $3, $4, $5, 100, $6)
       RETURNING *`,
      [
        group.id,
        file.filename,
        file.file_url,
        file.duration_seconds ?? null,
        file.waveform_data ? JSON.stringify(file.waveform_data) : null,
        index,
      ]
    )
    if (inserted) insertedFiles.push(inserted)
  }

  if (insertedFiles.length === 0) {
    await db.query('DELETE FROM multitrack_groups WHERE id = $1', [group.id])
    return NextResponse.json({ error: 'Failed to insert files' }, { status: 500 })
  }

  return NextResponse.json({ ...group, files: insertedFiles })
}

export async function DELETE(request: Request) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { searchParams } = new URL(request.url)
  const groupId = searchParams.get('id')

  if (!groupId) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  await db.query('DELETE FROM multitrack_groups WHERE id = $1', [groupId])
  return NextResponse.json({ success: true })
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const body = await request.json()
  const { type, id, ...updates } = body

  if (type === 'group') {
    const fields = Object.keys(updates)
    if (fields.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
    const values = fields.map((f) => updates[f])
    const updated = await db.queryOne(
      `UPDATE multitrack_groups SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    )
    if (!updated) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }
    return NextResponse.json(updated)
  }

  if (type === 'file') {
    const fields = Object.keys(updates)
    if (fields.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }
    const setClause = fields
      .map((f, i) => (f === 'waveform_data' ? `waveform_data = $${i + 2}::jsonb` : `${f} = $${i + 2}`))
      .join(', ')
    const values = fields.map((f) =>
      f === 'waveform_data' && updates[f] ? JSON.stringify(updates[f]) : updates[f]
    )
    const updated = await db.queryOne(
      `UPDATE multitrack_files SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    )
    if (!updated) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
