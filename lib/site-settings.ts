import { db } from '@/lib/db'

export type NotificationSettings = {
  mention_email_enabled: boolean
}

const NOTIFICATIONS_KEY = 'notifications'

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  mention_email_enabled: true,
}

function parseNotificationSettings(
  value: Partial<NotificationSettings> | null | undefined
): NotificationSettings {
  return {
    mention_email_enabled:
      typeof value?.mention_email_enabled === 'boolean'
        ? value.mention_email_enabled
        : DEFAULT_NOTIFICATION_SETTINGS.mention_email_enabled,
  }
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const row = await db.queryOne<{ value: Partial<NotificationSettings> }>(
    'SELECT value FROM site_settings WHERE key = $1',
    [NOTIFICATIONS_KEY]
  )

  return parseNotificationSettings(row?.value)
}

export async function updateNotificationSettings(
  patch: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  const current = await getNotificationSettings()
  const next = { ...current, ...patch }

  await db.query(
    `INSERT INTO site_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_at = now()`,
    [NOTIFICATIONS_KEY, JSON.stringify(next)]
  )

  return next
}

export async function isMentionEmailEnabled(): Promise<boolean> {
  const settings = await getNotificationSettings()
  return settings.mention_email_enabled
}
