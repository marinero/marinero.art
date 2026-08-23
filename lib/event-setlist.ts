import { db } from '@/lib/db'
import { normalizeSetlistSong, type SetlistSong } from '@/lib/song-tech'

const SONG_SELECT = `
  st.id,
  st.title,
  st.slug,
  st.bpm,
  COALESCE(st.tech_meta, '{}'::jsonb) AS tech_meta,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object('id', d.id, 'title', d.title, 'kind', d.kind)
        ORDER BY d.order_index ASC, d.created_at ASC
      )
      FROM song_documents d
      WHERE d.song_text_id = st.id
    ),
    '[]'::json
  ) AS documents
`

type SongRow = {
  id: string
  title: string
  slug: string
  bpm: string | null
  tech_meta: unknown
  documents: unknown
}

export async function listSongsForSetlist(): Promise<SetlistSong[]> {
  const rows = await db.queryMany<SongRow>(
    `SELECT ${SONG_SELECT}
     FROM song_texts st
     ORDER BY st.title ASC`
  )
  return rows.map(normalizeSetlistSong)
}

export async function getEventSetlist(eventId: string): Promise<SetlistSong[]> {
  const rows = await db.queryMany<SongRow>(
    `SELECT ${SONG_SELECT}
     FROM event_songs es
     JOIN song_texts st ON st.id = es.song_text_id
     WHERE es.event_id = $1
     ORDER BY es.display_order ASC`,
    [eventId]
  )
  return rows.map(normalizeSetlistSong)
}

export async function saveEventSongs(eventId: string, songIds: string[]) {
  const unique: string[] = []
  for (const id of songIds) {
    if (typeof id === 'string' && id && !unique.includes(id)) unique.push(id)
  }

  await db.query('DELETE FROM event_songs WHERE event_id = $1', [eventId])

  for (let i = 0; i < unique.length; i++) {
    await db.query(
      `INSERT INTO event_songs (event_id, song_text_id, display_order)
       VALUES ($1, $2, $3)`,
      [eventId, unique[i], i]
    )
  }
}
