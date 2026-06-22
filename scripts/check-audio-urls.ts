#!/usr/bin/env npx tsx
/**
 * Проверяет audio_files и multitrack_files: URL в БД, ключ S3, наличие файла.
 *
 *   pnpm storage:check-audio
 *   pnpm storage:check-audio -- --limit 10
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { Pool } from 'pg'
import { extractStorageKey, resolveAudioUrl } from '../lib/storage-keys'
import { fileExists } from '../lib/storage'

function loadEnvFile(path: string) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    let val = trimmed.slice(eq + 1)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

const envFile = process.env.ENV_FILE ?? '.env.local'
loadEnvFile(join(process.cwd(), envFile))

if (process.env.S3_ENDPOINT?.includes('minio:')) {
  process.env.S3_ENDPOINT = 'http://localhost:9000'
}

function parseLimit(): number | null {
  const idx = process.argv.indexOf('--limit')
  if (idx === -1) return null
  const n = parseInt(process.argv[idx + 1] ?? '', 10)
  return Number.isFinite(n) ? n : null
}

async function main() {
  const limit = parseLimit()
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  type Row = { id: string; filename: string; file_url: string; source: string }

  const audio = await pool.query<Row>(
    `SELECT id, filename, file_url, 'audio_files' AS source FROM audio_files ORDER BY created_at DESC`
  )
  const multitrack = await pool.query<Row>(
    `SELECT id, filename, file_url, 'multitrack_files' AS source FROM multitrack_files ORDER BY created_at DESC`
  )

  const rows = [...audio.rows, ...multitrack.rows].slice(0, limit ?? undefined)

  let ok = 0
  let broken = 0

  console.log(`Checking ${rows.length} audio records...\n`)

  for (const row of rows) {
    const key = extractStorageKey(row.file_url)
    const resolved = resolveAudioUrl(row.file_url)
    let status = 'OK'
    let detail = ''

    if (!key) {
      status = 'NO_KEY'
      detail = `cannot parse: ${row.file_url}`
      broken++
    } else {
      const exists = await fileExists(key)
      if (!exists) {
        status = 'MISSING_S3'
        detail = `key=${key}`
        broken++
      } else {
        ok++
      }
    }

    const mark = status === 'OK' ? '✓' : '✗'
    console.log(`${mark} [${status}] ${row.source} ${row.filename}`)
    console.log(`    db:       ${row.file_url}`)
    console.log(`    resolved: ${resolved ?? '—'}`)
    if (detail) console.log(`    detail:   ${detail}`)
    console.log()
  }

  console.log(`Done: ${ok} ok, ${broken} broken`)
  await pool.end()
  process.exit(broken > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
