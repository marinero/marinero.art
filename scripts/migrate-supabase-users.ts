#!/usr/bin/env npx tsx
/**
 * Миграция пользователей из старой базы Supabase → текущий PostgreSQL.
 *
 * Переносит только тех пользователей, которых ещё нет в целевой базе
 * (идемпотентно), вместе с bcrypt-хэшем пароля и профилем.
 * Запускать можно сколько угодно раз, пока не переедем с localhost на прод.
 *
 * Использование:
 *   pnpm users:migrate
 *
 * Перед запуском задайте в .env.local:
 *   DATABASE_URL=...   (целевой PostgreSQL — куда переносим)
 *   SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
 *
 * Та же логика доступна в админке: Обзор → Быстрые действия → Технические действия.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

function loadEnvFile(path: string) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvFile(join(process.cwd(), '.env.local'))

async function main() {
  // Импортируем после загрузки env, чтобы пулы подхватили строки подключения.
  const { migrateSupabaseUsers } = await import('../lib/migrate-supabase-users')

  console.log('Миграция пользователей Supabase → PostgreSQL...\n')

  const result = await migrateSupabaseUsers()

  console.log(`Найдено в Supabase: ${result.source}`)
  console.log(`Перенесено новых:   ${result.migrated}`)
  console.log(`Пропущено (есть):   ${result.skipped}`)
  console.log(`Ошибок:             ${result.failed}\n`)

  for (const d of result.details) {
    const mark = d.status === 'migrated' ? '+' : d.status === 'skipped' ? '=' : '!'
    console.log(`  ${mark} ${d.email}${d.message ? ` — ${d.message}` : ''}`)
  }

  if (result.errors.length > 0) {
    console.error('\nОшибки:')
    for (const e of result.errors) console.error(`  - ${e}`)
    process.exit(1)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('\nМиграция прервана:', err instanceof Error ? err.message : err)
  process.exit(1)
})
