import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { generateBackupSql } from '@/lib/db-backup'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  try {
    const sql = await generateBackupSql(db)
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19)
    const filename = `marinero-backup-${stamp}.sql`

    return new NextResponse(sql, {
      status: 200,
      headers: {
        'Content-Type': 'application/sql; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Backup failed' },
      { status: 500 }
    )
  }
}
