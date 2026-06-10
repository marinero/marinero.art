'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, DatabaseBackup } from 'lucide-react'

export function BackupDatabaseButton() {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  async function handleBackup() {
    setLoading(true)
    setDone(null)

    try {
      const response = await fetch('/api/admin/backup', { method: 'POST' })

      if (!response.ok) {
        let message = 'Ошибка создания бэкапа'
        try {
          const data = await response.json()
          message = data.error || message
        } catch {
          // non-JSON error
        }
        throw new Error(message)
      }

      // Extract filename from Content-Disposition, fallback to a timestamped name
      const disposition = response.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      const filename = match?.[1] || `marinero-backup-${Date.now()}.sql`

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      const sizeKb = Math.max(1, Math.round(blob.size / 1024))
      setDone(`${filename} · ${sizeKb} КБ`)
    } catch (error) {
      alert(`Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full justify-start gap-3 h-auto p-3"
        onClick={handleBackup}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <DatabaseBackup className="h-5 w-5 text-primary" />
        )}
        <span>{loading ? 'Создание бэкапа...' : 'Скачать бэкап базы данных'}</span>
      </Button>
      {done && (
        <p className="text-xs text-muted-foreground px-3">
          Бэкап скачан: {done}
        </p>
      )}
    </div>
  )
}
