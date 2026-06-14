import { db } from '@/lib/db'
import { isUuid, rehearsalDateSlug } from '@/lib/rehearsal-url'

export { isUuid } from '@/lib/rehearsal-url'

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

  return db.queryOne<T>(
    'SELECT * FROM rehearsals WHERE rehearsal_date = $1::date',
    [rehearsalDateSlug(value)]
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
