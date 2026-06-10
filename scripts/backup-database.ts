#!/usr/bin/env npx tsx
/**
 * Полный бэкап базы данных в один SQL-файл (дамп данных).
 *
 * Та же логика доступна в админке: Обзор → Технические действия →
 * «Скачать бэкап базы данных».
 *
 * Использование:
 *   pnpm db:backup                 # → backups/marinero-backup-<дата>.sql
 *   pnpm db:backup ./my-dump.sql   # указать путь к файлу
 *
 * Перед запуском задайте в .env.local:
 *   DATABASE_URL=postgresql://user:pass@host:5432/dbname
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { Pool } from 'pg'
import { generateBackupSql } from '../lib/db-backup'

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
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL не задан (проверьте .env.local).')
    process.exit(1)
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19)
  const outPath =
    process.argv[2] || join(process.cwd(), 'backups', `marinero-backup-${stamp}.sql`)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  console.log('Создание бэкапа базы данных...')
  try {
    const sql = await generateBackupSql(pool)
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, sql, 'utf8')
    const sizeKb = Math.max(1, Math.round(Buffer.byteLength(sql, 'utf8') / 1024))
    console.log(`Готово: ${outPath} (${sizeKb} КБ)`)
  } finally {
    await pool.end()
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('\nБэкап прерван:', err instanceof Error ? err.message : err)
  process.exit(1)
})
