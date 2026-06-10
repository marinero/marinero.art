'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Database } from 'lucide-react'

export function MigrateAudioButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ updated: number; failed: number; total: number; errors?: string[] } | null>(null)

  async function handleMigrate() {
    if (!confirm('Запустить миграцию длительности аудио файлов? Это может занять некоторое время.')) {
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/migrate-audio-duration', {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка миграции')
      }

      setResult(data)
    } catch (error: any) {
      alert(`Ошибка: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full justify-start gap-3 h-auto p-3"
        onClick={handleMigrate}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <Database className="h-5 w-5 text-primary" />
        )}
        <span>{loading ? 'Миграция...' : 'Обновить длительность аудио'}</span>
      </Button>
      {result && (
        <div className="text-xs text-muted-foreground px-3 space-y-1">
          <p>
            Обновлено: {result.updated} из {result.total}
            {result.failed > 0 && `, ошибок: ${result.failed}`}
          </p>
          {result.errors && result.errors.length > 0 && (
            <details className="text-destructive">
              <summary className="cursor-pointer">Показать ошибки</summary>
              <ul className="mt-1 space-y-0.5 max-h-32 overflow-auto">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
