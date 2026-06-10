import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export async function POST() {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  return NextResponse.json(
    { error: 'Email confirmation resend is not configured yet' },
    { status: 501 }
  )
}
