#!/usr/bin/env npx tsx
/**
 * Импорт архива Vercel Blob → MinIO + обновление URL в PostgreSQL.
 *
 * Использование:
 *   pnpm storage:import -- --source ./data/blob-archive
 *   pnpm storage:import -- --zip ~/Downloads/marinero-blob.zip
 *   pnpm storage:import -- --source ./data/blob-archive --dry-run
 *
 * Перед запуском:
 *   docker compose up minio minio-init postgres -d
 *
 * Скрипт читает .env.local и подставляет S3_ENDPOINT=http://localhost:9000
 * (для запуска с хоста, не из Docker).
 */

import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, rmSync } from 'fs'
import { join, relative, sep } from 'path'
import { execSync } from 'child_process'
import { Pool } from 'pg'
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import {
  extractStorageKey,
  guessContentType,
  resolveBucket,
  storageUrlForKey,
} from '../lib/storage-keys'

// --- env ---

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
// fallback for local dev
if (envFile !== '.env.local') {
  loadEnvFile(join(process.cwd(), '.env.local'))
}

// С хоста MinIO доступен как localhost, не minio
if (process.env.S3_ENDPOINT?.includes('minio:')) {
  process.env.S3_ENDPOINT = 'http://localhost:9000'
}

const BUCKETS = {
  public: process.env.S3_BUCKET_PUBLIC ?? 'marinero-public',
  private: process.env.S3_BUCKET_PRIVATE ?? 'marinero-private',
}

function createS3Client() {
  const config: ConstructorParameters<typeof S3Client>[0] = {
    region: process.env.S3_REGION ?? 'us-east-1',
  }
  if (process.env.S3_ENDPOINT) {
    config.endpoint = process.env.S3_ENDPOINT
    config.forcePathStyle = true
  }
  if (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    }
  }
  return new S3Client(config)
}

const s3 = createS3Client()

// --- CLI ---

function parseArgs() {
  const args = process.argv.slice(2)
  let source = ''
  let zip = ''
  let dryRun = false
  let skipDb = false
  let dbOnly = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source') source = args[++i] ?? ''
    else if (args[i] === '--zip') zip = args[++i] ?? ''
    else if (args[i] === '--dry-run') dryRun = true
    else if (args[i] === '--skip-db') skipDb = true
    else if (args[i] === '--db-only') dbOnly = true
  }

  if (!dbOnly && !source && !zip) {
    console.error(`
Usage:
  pnpm storage:import -- --source <extracted-folder>
  pnpm storage:import -- --zip <archive.zip>
  pnpm storage:import -- --db-only

Options:
  --dry-run   только показать план, без загрузки
  --skip-db   только загрузить файлы, не обновлять PostgreSQL
  --db-only   только обновить URL в PostgreSQL (файлы уже в S3)
`)
    process.exit(1)
  }

  return { source, zip, dryRun, skipDb, dbOnly }
}

// --- filesystem ---

function walkFiles(dir: string, base = dir): Map<string, string> {
  const map = new Map<string, string>()

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      for (const [k, v] of walkFiles(full, base)) {
        map.set(k, v)
      }
    } else {
      const rel = relative(base, full).split(sep).join('/')
      map.set(normalizeArchiveKey(rel), full)
    }
  }

  return map
}

/** Приводит путь из ZIP к S3-ключу (как в Vercel Blob pathname). */
function normalizeArchiveKey(relPath: string): string {
  let key = relPath.replace(/^\/+/, '')

  // Убираем обёртку экспорта, если есть
  const stripPrefixes = ['blob-export/', 'export/', 'marinero-blob/']
  for (const p of stripPrefixes) {
    if (key.startsWith(p)) key = key.slice(p.length)
  }

  return key
}

function findFileForKey(key: string, fileIndex: Map<string, string>): string | null {
  if (fileIndex.has(key)) return fileIndex.get(key)!

  // Поиск без учёта регистра / с разными префиксами
  const lower = key.toLowerCase()
  for (const [k, path] of fileIndex) {
    if (k.toLowerCase() === lower) return path
    if (k.endsWith('/' + key) || k.endsWith(key)) return path
  }

  return null
}

// --- S3 ---

async function objectExists(key: string): Promise<boolean> {
  const bucket = resolveBucket(key)
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKETS[bucket], Key: key }))
    return true
  } catch {
    return false
  }
}

async function uploadKeyFromPath(key: string, filePath: string, dryRun: boolean) {
  const bucket = resolveBucket(key)
  const contentType = guessContentType(key)

  if (dryRun) {
    console.log(`  [dry-run] ${bucket}/${key} ← ${filePath}`)
    return
  }

  if (await objectExists(key)) {
    console.log(`  skip (exists) ${key}`)
    return
  }

  const body = readFileSync(filePath)
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKETS[bucket],
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )
  console.log(`  uploaded ${bucket}/${key}`)
}

// --- DB ---

type UrlColumn = { table: string; column: string }

const URL_COLUMNS: UrlColumn[] = [
  { table: 'albums', column: 'cover_image_url' },
  { table: 'photos', column: 'url' },
  { table: 'photos', column: 'thumbnail_url' },
  { table: 'events', column: 'image_url' },
  { table: 'discography', column: 'cover_image_url' },
  { table: 'band_members', column: 'photo_url' },
  { table: 'videos', column: 'thumbnail_url' },
  { table: 'profiles', column: 'avatar_url' },
  { table: 'audio_files', column: 'file_url' },
  { table: 'multitrack_files', column: 'file_url' },
  { table: 'song_texts', column: 'audio_url' },
]

async function collectDbKeys(pool: Pool): Promise<Map<string, string[]>> {
  /** key → ["table.column:id", ...] */
  const keyRefs = new Map<string, string[]>()

  for (const { table, column } of URL_COLUMNS) {
    const { rows } = await pool.query(
      `SELECT id, ${column} AS url FROM ${table} WHERE ${column} IS NOT NULL AND ${column} != ''`
    )
    for (const row of rows) {
      const key = extractStorageKey(row.url)
      if (!key) continue
      const ref = `${table}.${column}:${row.id}`
      const list = keyRefs.get(key) ?? []
      list.push(ref)
      keyRefs.set(key, list)
    }
  }

  return keyRefs
}

async function updateDbUrls(pool: Pool, dryRun: boolean) {
  for (const { table, column } of URL_COLUMNS) {
    const { rows } = await pool.query(
      `SELECT id, ${column} AS url FROM ${table} WHERE ${column} IS NOT NULL AND ${column} != ''`
    )

    for (const row of rows) {
      const key = extractStorageKey(row.url)
      if (!key) continue

      const newUrl = storageUrlForKey(key)
      if (newUrl === row.url) continue

      if (dryRun) {
        console.log(`  [dry-run] UPDATE ${table} ${row.id}: ${newUrl}`)
      } else {
        await pool.query(`UPDATE ${table} SET ${column} = $1 WHERE id = $2`, [newUrl, row.id])
        console.log(`  updated ${table}.${column} ${row.id}`)
      }
    }
  }
}

// --- main ---

async function main() {
  const { source, zip, dryRun, skipDb, dbOnly } = parseArgs()

  if (dbOnly) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    console.log('Updating database URLs only...')
    await updateDbUrls(pool, dryRun)
    await pool.end()
    console.log(`\nDone. Public files URL base: ${process.env.NEXT_PUBLIC_STORAGE_URL}`)
    return
  }

  let workDir = source
  let tempDir = ''

  if (zip) {
    if (!existsSync(zip)) {
      console.error(`ZIP not found: ${zip}`)
      process.exit(1)
    }
    tempDir = join(process.cwd(), '.tmp-blob-import')
    rmSync(tempDir, { recursive: true, force: true })
    mkdirSync(tempDir, { recursive: true })
    console.log(`Extracting ${zip} → ${tempDir}`)
    execSync(`unzip -q -o ${JSON.stringify(zip)} -d ${JSON.stringify(tempDir)}`, {
      stdio: 'inherit',
    })
    workDir = tempDir
  }

  if (!existsSync(workDir)) {
    console.error(`Source not found: ${workDir}`)
    process.exit(1)
  }

  console.log(`Indexing files in ${workDir}...`)
  const fileIndex = walkFiles(workDir)
  console.log(`Found ${fileIndex.size} files in archive`)

  const pool = skipDb
    ? null
    : new Pool({ connectionString: process.env.DATABASE_URL })

  const dbKeys = pool ? await collectDbKeys(pool) : new Map<string, string[]>()
  console.log(`Found ${dbKeys.size} unique storage keys referenced in DB`)

  const keysToUpload = new Set<string>([
    ...dbKeys.keys(),
    ...fileIndex.keys(),
  ])

  // Не загружаем временные чанки
  for (const k of keysToUpload) {
    if (k.startsWith('temp-chunks/')) keysToUpload.delete(k)
  }

  const target = process.env.S3_ENDPOINT ? 'MinIO' : `S3 (${process.env.S3_REGION})`
  console.log(`\nUploading ${keysToUpload.size} objects to ${target}...`)
  let uploaded = 0
  let missing = 0

  for (const key of keysToUpload) {
    const filePath = findFileForKey(key, fileIndex)
    if (!filePath) {
      if (dbKeys.has(key)) {
        console.warn(`  MISSING in archive (referenced in DB): ${key}`)
        missing++
      }
      continue
    }
    await uploadKeyFromPath(key, filePath, dryRun)
    uploaded++
  }

  if (pool && !skipDb) {
    console.log('\nUpdating database URLs...')
    await updateDbUrls(pool, dryRun)
    await pool.end()
  }

  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true })
  }

  console.log(`
Done.
  Uploaded/skipped: ${uploaded}
  Missing in archive: ${missing}
  Public files URL base: ${process.env.NEXT_PUBLIC_STORAGE_URL}
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
