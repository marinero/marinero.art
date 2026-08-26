import { db } from '@/lib/db'
import { deleteFile } from '@/lib/storage'
import { extractStorageKey } from '@/lib/storage-keys'

type LinkInput = { platform?: string; url?: string; icon?: string | null }

export async function replaceSongLinks(songId: string, links: LinkInput[]) {
  await db.query('DELETE FROM song_links WHERE song_text_id = $1', [songId])

  const valid = links.filter(
    (l) =>
      l &&
      typeof l.platform === 'string' &&
      l.platform.trim() &&
      typeof l.url === 'string' &&
      l.url.trim()
  )

  for (let i = 0; i < valid.length; i++) {
    const link = valid[i]
    await db.query(
      `INSERT INTO song_links (song_text_id, platform, url, icon, order_index)
       VALUES ($1, $2, $3, $4, $5)`,
      [songId, link.platform!.trim(), link.url!.trim(), link.icon ?? null, i]
    )
  }
}

export async function deleteStoredAudio(storedUrl: string | null | undefined) {
  const key = storedUrl ? extractStorageKey(storedUrl) : null
  if (!key) return
  try {
    await deleteFile(key)
  } catch (error) {
    console.error('Failed to delete song audio:', error)
  }
}
