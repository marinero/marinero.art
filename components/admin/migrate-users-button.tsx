'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, UserPlus } from 'lucide-react'

interface MigrateResult {
  source: number
  migrated: number
  skipped: number
  failed: number
  errors?: string[]
}

export function MigrateUsersButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<MigrateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleMigrate() {
    if (
      !confirm(
        'Перенести новых пользователей из старой базы Supabase в PostgreSQL?\n' +
          'Уже существующие пользователи будут пропущены.'
      )
    ) {
      return
    }

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const response = await fetch('/api/admin/migrate-supabase-users', {
        method: 'POST',
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || `Ошибка миграции (HTTP ${response.status})`)
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
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
          <UserPlus className="h-5 w-5 text-primary" />
        )}
        <span>{loading ? 'Миграция...' : 'Перенести пользователей из Supabase'}</span>
      </Button>
      {error && (
        <p className="text-xs text-destructive px-3 whitespace-pre-wrap break-words">{error}</p>
      )}
      {result && (
        <div className="text-xs px-3 space-y-1">
          <p className="font-medium text-foreground">
            Мигрировано: {result.migrated}{' '}
            {result.migrated === 1
              ? 'пользователь'
              : result.migrated >= 2 && result.migrated <= 4
                ? 'пользователя'
                : 'пользователей'}
          </p>
          <p className="text-muted-foreground">
            Найдено в Supabase: {result.source}, пропущено (уже есть): {result.skipped}
            {result.failed > 0 && (
              <span className="text-destructive">, ошибок: {result.failed}</span>
            )}
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
