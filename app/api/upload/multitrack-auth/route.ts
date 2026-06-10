import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await db.queryOne<{ role: string }>(
      'SELECT role FROM profiles WHERE id = $1',
      [session.user.id]
    )

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
