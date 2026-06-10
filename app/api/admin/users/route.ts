import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET() {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const rows = await db.queryMany<{
    id: string
    email: string
    email_verified: boolean
    created_at: string
    display_name: string | null
    avatar_url: string | null
    role: string | null
  }>(
    `SELECT u.id, u.email, u.email_verified, u.created_at,
       p.display_name, p.avatar_url, p.role
     FROM users u
     LEFT JOIN profiles p ON p.id = u.id
     ORDER BY u.created_at DESC`
  )

  const users = rows.map((row) => ({
    id: row.id,
    email: row.email,
    email_confirmed_at: row.email_verified ? row.created_at : null,
    created_at: row.created_at,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    role: row.role || 'fan',
  }))

  return NextResponse.json({ users })
}
