import { Pool } from 'pg'
import { db } from '@/lib/db'

/**
 * Миграция пользователей из старой базы Supabase в текущий PostgreSQL.
 *
 * Источник: Supabase Postgres (схемы auth.users + public.profiles).
 * Назначение: локальный/прод PostgreSQL (таблицы public.users + public.profiles).
 *
 * Подключается напрямую к базе Supabase (а не через JS SDK), потому что
 * только прямой доступ к auth.users отдаёт bcrypt-хэш пароля
 * (encrypted_password) — без него пользователи с парольным входом не смогли бы
 * залогиниться после переезда.
 *
 * Переносятся только отсутствующие пользователи (идемпотентно, ON CONFLICT),
 * поэтому скрипт можно запускать сколько угодно раз, пока мы не съедем
 * с localhost на прод в Amazon.
 *
 * Требуется переменная окружения SUPABASE_DB_URL — строка подключения к базе
 * Supabase, например:
 *   postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
 */

export type MigrateUserStatus = 'migrated' | 'skipped' | 'error'

export interface MigrateUserDetail {
  email: string
  status: MigrateUserStatus
  message?: string
}

export interface MigrateUsersResult {
  /** Сколько пользователей найдено в базе Supabase */
  source: number
  /** Сколько новых пользователей перенесено */
  migrated: number
  /** Сколько уже существовало (пропущено) */
  skipped: number
  /** Сколько завершилось ошибкой */
  failed: number
  errors: string[]
  details: MigrateUserDetail[]
}

interface SupabaseUserRow {
  id: string
  email: string
  encrypted_password: string | null
  email_confirmed_at: string | null
  created_at: string | null
  updated_at: string | null
  username: string | null
  display_name: string | null
  avatar_url: string | null
  role: string | null
}

export async function migrateSupabaseUsers(): Promise<MigrateUsersResult> {
  const connectionString = process.env.SUPABASE_DB_URL

  if (!connectionString) {
    throw new Error(
      'SUPABASE_DB_URL не задан. Добавьте строку подключения к базе Supabase ' +
        '(например postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres) ' +
        'в переменные окружения.'
    )
  }

  // Отдельный пул к базе-источнику. Supabase требует SSL.
  const sourcePool = new Pool({
    connectionString,
    max: 3,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 10000,
  })

  const result: MigrateUsersResult = {
    source: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    details: [],
  }

  try {
    const { rows: sourceUsers } = await sourcePool.query<SupabaseUserRow>(
      `SELECT
         u.id,
         u.email,
         u.encrypted_password,
         u.email_confirmed_at,
         u.created_at,
         u.updated_at,
         p.username,
         p.display_name,
         p.avatar_url,
         p.role
       FROM auth.users u
       LEFT JOIN public.profiles p ON p.id = u.id
       WHERE u.email IS NOT NULL
         AND u.deleted_at IS NULL
       ORDER BY u.created_at ASC`
    )

    result.source = sourceUsers.length

    for (const su of sourceUsers) {
      try {
        const existing = await db.queryOne<{ id: string }>(
          'SELECT id FROM users WHERE id = $1 OR lower(email) = lower($2)',
          [su.id, su.email]
        )

        if (existing) {
          result.skipped++
          result.details.push({ email: su.email, status: 'skipped' })
          continue
        }

        await db.query(
          `INSERT INTO users (id, email, password_hash, email_verified, created_at, updated_at)
           VALUES ($1, $2, $3, $4, COALESCE($5, now()), COALESCE($6, now()))
           ON CONFLICT (id) DO NOTHING`,
          [
            su.id,
            su.email,
            su.encrypted_password ?? null,
            Boolean(su.email_confirmed_at),
            su.created_at,
            su.updated_at,
          ]
        )

        // role в Supabase ограничен ('fan' | 'admin'), но на всякий случай нормализуем
        const role = su.role === 'admin' ? 'admin' : 'fan'

        await db.query(
          `INSERT INTO profiles (id, username, display_name, avatar_url, role)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO NOTHING`,
          [su.id, su.username ?? null, su.display_name ?? su.email, su.avatar_url ?? null, role]
        )

        result.migrated++
        result.details.push({ email: su.email, status: 'migrated' })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        result.failed++
        result.errors.push(`${su.email}: ${message}`)
        result.details.push({ email: su.email, status: 'error', message })
      }
    }
  } finally {
    await sourcePool.end()
  }

  return result
}
