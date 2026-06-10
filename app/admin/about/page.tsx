'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminAboutPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    fetch('/api/admin/about')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.about) {
          setTitle(data.about.title ?? '')
          setBody(data.about.body ?? '')
        }
        setLoading(false)
      })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    await fetch('/api/admin/about', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">О нас — описание</h1>
        <p className="text-muted-foreground">
          Общий текст в начале страницы «О нас»
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Текст раздела</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Заголовок</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="О нас"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Описание</label>
              <textarea
                className="w-full min-h-64 px-3 py-2 rounded-md border border-input bg-background text-sm"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="История группы, стиль, достижения..."
              />
              <p className="text-xs text-muted-foreground">
                Переводы строк сохраняются.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </Button>
              {saved && (
                <span className="text-sm text-green-600">Сохранено</span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
