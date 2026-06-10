import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import type { AboutContent } from '@/lib/types'

export async function GET() {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const about = await db.queryOne<AboutContent>(
    'SELECT * FROM about_content WHERE id = 1'
  )

  return NextResponse.json({ about })
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const body = await request.json()

  await db.query(
    `INSERT INTO about_content (id, title, body, updated_at)
     VALUES (1, $1, $2, now())
     ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title,
           body = EXCLUDED.body,
           updated_at = now()`,
    [body.title ?? null, body.body ?? null]
  )

  return NextResponse.json({ ok: true })
}
