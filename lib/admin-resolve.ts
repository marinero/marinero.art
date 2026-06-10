import { db } from '@/lib/db'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export async function resolveAlbum<T extends Record<string, unknown>>(
  idOrSlug: string
): Promise<T | null> {
  if (isUuid(idOrSlug)) {
    return db.queryOne<T>('SELECT * FROM albums WHERE id = $1', [idOrSlug])
  }
  return db.queryOne<T>('SELECT * FROM albums WHERE slug = $1', [idOrSlug])
}

export async function resolveRehearsal<T extends Record<string, unknown>>(
  idOrDate: string
): Promise<T | null> {
  let value = idOrDate
  try {
    value = decodeURIComponent(idOrDate)
    if (value.includes('%')) {
      value = decodeURIComponent(value)
    }
  } catch {
    value = idOrDate
  }

  if (isUuid(value)) {
    return db.queryOne<T>('SELECT * FROM rehearsals WHERE id = $1', [value])
  }

  // yyyy-MM-dd или ISO timestamp из JSON (2026-05-14T00:00:00.000Z)
  const dateOnly = value.includes('T') ? value.slice(0, 10) : value

  return db.queryOne<T>(
    'SELECT * FROM rehearsals WHERE rehearsal_date = $1::date',
    [dateOnly]
  )
}

export async function resolveSongText<T extends Record<string, unknown>>(
  idOrSlug: string
): Promise<T | null> {
  if (isUuid(idOrSlug)) {
    return db.queryOne<T>('SELECT * FROM song_texts WHERE id = $1', [idOrSlug])
  }
  return db.queryOne<T>('SELECT * FROM song_texts WHERE slug = $1', [idOrSlug])
}
