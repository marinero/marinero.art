'use client'

import { useEffect, useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { NotificationSettings } from '@/lib/site-settings'

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notifications, setNotifications] = useState<NotificationSettings>({
    mention_email_enabled: true,
  })

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.notifications) {
          setNotifications(data.notifications)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function updateMentionEmailEnabled(checked: boolean) {
    const previous = notifications
    setNotifications((current) => ({
      ...current,
      mention_email_enabled: checked,
    }))
    setSaving(true)

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifications: { mention_email_enabled: checked },
        }),
      })

      if (!response.ok) {
        setNotifications(previous)
        return
      }

      const data = await response.json()
      if (data?.notifications) {
        setNotifications(data.notifications)
      }
    } catch {
      setNotifications(previous)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Настройки</h1>
        <p className="text-muted-foreground">
          Общие настройки сайта для всех пользователей
        </p>
      </div>

      <Tabs defaultValue="notifications">
        <TabsList>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Уведомления
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Уведомления</CardTitle>
              <CardDescription>
                Настройки e-mail уведомлений для всего сайта
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="mention-email-enabled"
                  checked={notifications.mention_email_enabled}
                  disabled={saving}
                  onCheckedChange={(value) =>
                    updateMentionEmailEnabled(value === true)
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="mention-email-enabled" className="cursor-pointer">
                    Отправлять e-mail при упоминании в комментарии
                  </Label>
                  {saving && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Сохранение...
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
