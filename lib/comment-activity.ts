import { db } from '@/lib/db'
import { commentMentionsUser } from '@/lib/comment-mentions'
import { adminRehearsalUrl } from '@/lib/rehearsal-url'

export type CommentActivityKind = 'reply' | 'mention'
export type CommentActivitySource = 'comment' | 'multitrack'

export type CommentActivityItem = {
  id: string
  source: CommentActivitySource
  kind: CommentActivityKind
  content: string
  created_at: string
  author_id: string
  author_name: string
  context_label: string
  context_url: string
  parent_preview: string | null
  is_unread: boolean
}

type RawActivityRow = {
  id: string
  source: CommentActivitySource
  kind: CommentActivityKind
  content: string
  created_at: string
  user_id: string
  type: string
  object_id: string | null
  parent_preview: string | null
}

async function getUserActivityProfile(userId: string) {
  return db.queryOne<{
    username: string | null
    display_name: string | null
    comment_activity_seen_at: string | null
  }>(
    `SELECT username, display_name, comment_activity_seen_at
     FROM profiles
     WHERE id = $1`,
    [userId]
  )
}

function isUnread(createdAt: string, seenAt: string | null): boolean {
  if (!seenAt) return true
  return new Date(createdAt).getTime() > new Date(seenAt).getTime()
}

async function fetchReplyRows(userId: string): Promise<RawActivityRow[]> {
  const commentReplies = await db.queryMany<{
    id: string
    type: string
    content: string
    created_at: string
    user_id: string
    object_id: string | null
    parent_preview: string | null
  }>(
    `SELECT c.id, c.type, c.content, c.created_at, c.user_id, c.object_id,
            left(parent.content, 120) AS parent_preview
     FROM comments c
     INNER JOIN comments parent ON parent.id = c.parent_id
     WHERE parent.user_id = $1
       AND c.user_id <> $1`,
    [userId]
  )

  const multitrackReplies = await db.queryMany<{
    id: string
    content: string
    created_at: string
    user_id: string
    multitrack_group_id: string
    parent_preview: string | null
  }>(
    `SELECT mc.id, mc.content, mc.created_at, mc.user_id, mc.multitrack_group_id,
            left(parent.content, 120) AS parent_preview
     FROM multitrack_comments mc
     INNER JOIN multitrack_comments parent ON parent.id = mc.parent_id
     WHERE parent.user_id = $1
       AND mc.user_id <> $1`,
    [userId]
  )

  return [
    ...commentReplies.map((row) => ({
      id: row.id,
      source: 'comment' as const,
      kind: 'reply' as const,
      content: row.content,
      created_at: row.created_at,
      user_id: row.user_id,
      type: row.type,
      object_id: row.object_id,
      parent_preview: row.parent_preview,
    })),
    ...multitrackReplies.map((row) => ({
      id: row.id,
      source: 'multitrack' as const,
      kind: 'reply' as const,
      content: row.content,
      created_at: row.created_at,
      user_id: row.user_id,
      type: 'multitrack',
      object_id: row.multitrack_group_id,
      parent_preview: row.parent_preview,
    })),
  ]
}

async function fetchMentionCandidates(
  userId: string,
  username: string | null,
  displayName: string | null,
  replyIds: Set<string>
): Promise<RawActivityRow[]> {
  const patterns: string[] = []
  const params: unknown[] = [userId]
  let paramIndex = 2

  if (username?.trim()) {
    patterns.push(`lower(c.content) LIKE '%@' || lower($${paramIndex}) || '%'`)
    params.push(username.trim())
    paramIndex += 1
  }

  if (displayName?.trim()) {
    patterns.push(`c.content ILIKE '%@"' || replace($${paramIndex}, '"', '') || '"%'`)
    params.push(displayName.trim())
    paramIndex += 1
    patterns.push(`lower(c.content) LIKE '%@' || lower($${paramIndex}) || '%'`)
    params.push(displayName.trim())
    paramIndex += 1
  }

  if (patterns.length === 0) return []

  const commentMentions = await db.queryMany<{
    id: string
    type: string
    content: string
    created_at: string
    user_id: string
    object_id: string | null
  }>(
    `SELECT c.id, c.type, c.content, c.created_at, c.user_id, c.object_id
     FROM comments c
     WHERE c.user_id <> $1
       AND c.content LIKE '%@%'
       AND (${patterns.join(' OR ')})
       AND NOT EXISTS (
         SELECT 1
         FROM comments parent
         WHERE parent.id = c.parent_id
           AND parent.user_id = $1
       )`,
    params
  )

  const multitrackParams = [userId, ...params.slice(1)]
  const multitrackMentions = await db.queryMany<{
    id: string
    content: string
    created_at: string
    user_id: string
    multitrack_group_id: string
  }>(
    `SELECT mc.id, mc.content, mc.created_at, mc.user_id, mc.multitrack_group_id
     FROM multitrack_comments mc
     WHERE mc.user_id <> $1
       AND mc.content LIKE '%@%'
       AND (${patterns.map((pattern) => pattern.replace(/c\./g, 'mc.')).join(' OR ')})
       AND NOT EXISTS (
         SELECT 1
         FROM multitrack_comments parent
         WHERE parent.id = mc.parent_id
           AND parent.user_id = $1
       )`,
    multitrackParams
  )

  const rows: RawActivityRow[] = []

  for (const row of commentMentions) {
    if (replyIds.has(row.id)) continue
    if (!commentMentionsUser(row.content, username, displayName)) continue
    rows.push({
      id: row.id,
      source: 'comment',
      kind: 'mention',
      content: row.content,
      created_at: row.created_at,
      user_id: row.user_id,
      type: row.type,
      object_id: row.object_id,
      parent_preview: null,
    })
  }

  for (const row of multitrackMentions) {
    if (replyIds.has(row.id)) continue
    if (!commentMentionsUser(row.content, username, displayName)) continue
    rows.push({
      id: row.id,
      source: 'multitrack',
      kind: 'mention',
      content: row.content,
      created_at: row.created_at,
      user_id: row.user_id,
      type: 'multitrack',
      object_id: row.multitrack_group_id,
      parent_preview: null,
    })
  }

  return rows
}

async function enrichActivityRows(
  rows: RawActivityRow[],
  seenAt: string | null
): Promise<CommentActivityItem[]> {
  if (rows.length === 0) return []

  const authorIds = [...new Set(rows.map((row) => row.user_id))]
  const profiles = await db.queryMany<{
    id: string
    display_name: string | null
    username: string | null
  }>(
    'SELECT id, display_name, username FROM profiles WHERE id = ANY($1::uuid[])',
    [authorIds]
  )
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]))

  const audioIds = rows
    .filter((row) => row.type === 'audio' && row.object_id)
    .map((row) => row.object_id!)
  const photoIds = rows
    .filter((row) => row.type === 'photo' && row.object_id)
    .map((row) => row.object_id!)
  const eventIds = rows
    .filter((row) => row.type === 'event' && row.object_id)
    .map((row) => row.object_id!)
  const songIds = rows
    .filter((row) => row.type === 'song' && row.object_id)
    .map((row) => row.object_id!)
  const videoIds = rows
    .filter((row) => row.type === 'video' && row.object_id)
    .map((row) => row.object_id!)
  const rehearsalIds = rows
    .filter((row) => row.type === 'rehearsal' && row.object_id)
    .map((row) => row.object_id!)
  const multitrackIds = rows
    .filter((row) => row.type === 'multitrack' && row.object_id)
    .map((row) => row.object_id!)

  const audioMap = new Map<
    string,
    { filename: string; rehearsal_date: string; song_slug: string | null }
  >()
  if (audioIds.length > 0) {
    const audioFiles = await db.queryMany<{
      id: string
      filename: string
      rehearsal_date: string
      song_slug: string | null
    }>(
      `SELECT af.id, af.filename, r.rehearsal_date::text AS rehearsal_date, st.slug AS song_slug
       FROM audio_files af
       JOIN rehearsals r ON r.id = af.rehearsal_id
       LEFT JOIN song_texts st ON st.id = af.song_text_id
       WHERE af.id = ANY($1::uuid[])`,
      [audioIds]
    )
    audioFiles.forEach((file) => audioMap.set(file.id, file))
  }

  const photoMap = new Map<string, { album_slug: string }>()
  if (photoIds.length > 0) {
    const photos = await db.queryMany<{ id: string; album_id: string }>(
      'SELECT id, album_id FROM photos WHERE id = ANY($1::uuid[])',
      [photoIds]
    )
    if (photos.length > 0) {
      const albums = await db.queryMany<{ id: string; slug: string }>(
        'SELECT id, slug FROM albums WHERE id = ANY($1::uuid[])',
        [[...new Set(photos.map((photo) => photo.album_id))]]
      )
      const albumSlugMap = new Map(albums.map((album) => [album.id, album.slug]))
      photos.forEach((photo) => {
        const slug = albumSlugMap.get(photo.album_id)
        if (slug) photoMap.set(photo.id, { album_slug: slug })
      })
    }
  }

  const eventMap = new Map<string, { slug: string; title: string }>()
  if (eventIds.length > 0) {
    const events = await db.queryMany<{ id: string; slug: string; title: string }>(
      'SELECT id, slug, title FROM events WHERE id = ANY($1::uuid[])',
      [eventIds]
    )
    events.forEach((event) => eventMap.set(event.id, event))
  }

  const songMap = new Map<string, { slug: string; title: string }>()
  if (songIds.length > 0) {
    const songs = await db.queryMany<{ id: string; slug: string; title: string }>(
      'SELECT id, slug, title FROM song_texts WHERE id = ANY($1::uuid[])',
      [songIds]
    )
    songs.forEach((song) => songMap.set(song.id, song))
  }

  const videoMap = new Map<string, { slug: string; title: string }>()
  if (videoIds.length > 0) {
    const videos = await db.queryMany<{ id: string; slug: string; title: string }>(
      'SELECT id, slug, title FROM videos WHERE id = ANY($1::uuid[])',
      [videoIds]
    )
    videos.forEach((video) => videoMap.set(video.id, video))
  }

  const rehearsalMap = new Map<string, { rehearsal_date: string }>()
  if (rehearsalIds.length > 0) {
    const rehearsals = await db.queryMany<{ id: string; rehearsal_date: string }>(
      'SELECT id, rehearsal_date::text AS rehearsal_date FROM rehearsals WHERE id = ANY($1::uuid[])',
      [rehearsalIds]
    )
    rehearsals.forEach((rehearsal) => rehearsalMap.set(rehearsal.id, rehearsal))
  }

  const multitrackMap = new Map<string, { title: string; song_slug: string | null }>()
  if (multitrackIds.length > 0) {
    const groups = await db.queryMany<{
      id: string
      title: string
      song_slug: string | null
    }>(
      `SELECT mg.id, mg.title, st.slug AS song_slug
       FROM multitrack_groups mg
       LEFT JOIN song_texts st ON st.id = mg.song_text_id
       WHERE mg.id = ANY($1::uuid[])`,
      [multitrackIds]
    )
    groups.forEach((group) => multitrackMap.set(group.id, group))
  }

  return rows.map((row) => {
    const author = profileMap.get(row.user_id)
    const authorName =
      author?.display_name?.trim() ||
      author?.username?.trim() ||
      'Пользователь'

    let contextLabel = 'Комментарий'
    let contextUrl = '/'

    switch (row.type) {
      case 'audio': {
        const audio = row.object_id ? audioMap.get(row.object_id) : null
        contextLabel = audio?.filename
          ? `Аудио: ${audio.filename}`
          : 'Комментарий к аудио'
        contextUrl = audio?.song_slug
          ? `/songs/${audio.song_slug}`
          : audio
            ? adminRehearsalUrl(audio.rehearsal_date, { audio: row.object_id ?? undefined })
            : '/songs'
        break
      }
      case 'photo': {
        const photo = row.object_id ? photoMap.get(row.object_id) : null
        contextLabel = 'Фотография'
        contextUrl = photo
          ? `/gallery/${photo.album_slug}?photo=${row.object_id}`
          : '/gallery'
        break
      }
      case 'rehearsal': {
        const rehearsal = row.object_id ? rehearsalMap.get(row.object_id) : null
        contextLabel = rehearsal
          ? `Репетиция ${rehearsal.rehearsal_date}`
          : 'Репетиция'
        contextUrl = rehearsal
          ? adminRehearsalUrl(rehearsal.rehearsal_date)
          : '/songs'
        break
      }
      case 'event': {
        const event = row.object_id ? eventMap.get(row.object_id) : null
        contextLabel = event?.title ? `Концерт: ${event.title}` : 'Концерт'
        contextUrl = event ? `/events/${event.slug}` : '/events'
        break
      }
      case 'song': {
        const song = row.object_id ? songMap.get(row.object_id) : null
        contextLabel = song?.title ? `Песня: ${song.title}` : 'Песня'
        contextUrl = song ? `/songs/${song.slug}` : '/songs'
        break
      }
      case 'video': {
        const video = row.object_id ? videoMap.get(row.object_id) : null
        contextLabel = video?.title ? `Видео: ${video.title}` : 'Видео'
        contextUrl = video ? `/videos/${video.slug}` : '/videos'
        break
      }
      case 'multitrack': {
        const group = row.object_id ? multitrackMap.get(row.object_id) : null
        contextLabel = group?.title
          ? `Мультитрек: ${group.title}`
          : 'Мультитрек'
        contextUrl = group?.song_slug
          ? `/songs/${group.song_slug}`
          : '/songs'
        break
      }
    }

    return {
      id: `${row.source}:${row.id}`,
      source: row.source,
      kind: row.kind,
      content: row.content,
      created_at: row.created_at,
      author_id: row.user_id,
      author_name: authorName,
      context_label: contextLabel,
      context_url: contextUrl,
      parent_preview: row.parent_preview,
      is_unread: isUnread(row.created_at, seenAt),
    }
  })
}

async function collectActivityRows(userId: string): Promise<{
  rows: RawActivityRow[]
  seenAt: string | null
}> {
  const profile = await getUserActivityProfile(userId)
  if (!profile) {
    return { rows: [], seenAt: null }
  }

  const replies = await fetchReplyRows(userId)
  const replyIds = new Set(replies.map((row) => row.id))
  const mentions = await fetchMentionCandidates(
    userId,
    profile.username,
    profile.display_name,
    replyIds
  )

  const rows = [...replies, ...mentions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return { rows, seenAt: profile.comment_activity_seen_at }
}

export async function getCommentActivityItems(
  userId: string
): Promise<CommentActivityItem[]> {
  const { rows, seenAt } = await collectActivityRows(userId)
  return enrichActivityRows(rows, seenAt)
}

export async function getUnreadCommentActivityCount(userId: string): Promise<number> {
  const items = await getCommentActivityItems(userId)
  return items.filter((item) => item.is_unread).length
}

export async function markCommentActivitySeen(userId: string): Promise<void> {
  await db.query(
    `UPDATE profiles
     SET comment_activity_seen_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [userId]
  )
}
