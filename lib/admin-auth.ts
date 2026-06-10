import { auth } from '@/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function requireAdmin() {
  const session = await auth()

  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const profile = await db.queryOne<{ role: string }>(
    'SELECT role FROM profiles WHERE id = $1',
    [session.user.id]
  )

  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { session }
}
