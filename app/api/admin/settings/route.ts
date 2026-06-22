import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from '@/lib/site-settings'

export async function GET() {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const notifications = await getNotificationSettings()

  return NextResponse.json({ notifications })
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const body = await request.json()
  const patch = body?.notifications as Partial<NotificationSettings> | undefined

  if (!patch || typeof patch !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (
    'mention_email_enabled' in patch &&
    typeof patch.mention_email_enabled !== 'boolean'
  ) {
    return NextResponse.json(
      { error: 'mention_email_enabled must be a boolean' },
      { status: 400 }
    )
  }

  const notifications = await updateNotificationSettings(patch)

  return NextResponse.json({ notifications })
}
