import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { migrateSupabaseUsers } from '@/lib/migrate-supabase-users'

export async function POST() {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  try {
    const result = await migrateSupabaseUsers()
    return NextResponse.json({ message: 'Migration complete', ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[migrate-supabase-users]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
