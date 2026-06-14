import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { adminRehearsalUrl } from '@/lib/rehearsal-url'

export async function GET() {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const comments = await db.queryMany<{
    id: string
    type: string
    content: string
    created_at: string
    user_id: string
    timestamp_seconds: number | null
    object_id: string | null
    parent_id: string | null
  }>(
    `SELECT id, type, content, created_at, user_id,
       timestamp_seconds, object_id, parent_id
     FROM comments
     ORDER BY created_at DESC`
  )

  const userIds = [...new Set(comments.map((c) => c.user_id))]
  let profileMap = new Map<
    string,
    { display_name: string | null; role: string | null }
  >()

  if (userIds.length > 0) {
    const profiles = await db.queryMany<{
      id: string
      display_name: string | null
      role: string | null
    }>(
      'SELECT id, display_name, role FROM profiles WHERE id = ANY($1::uuid[])',
      [userIds]
    )
    profileMap = new Map(profiles.map((p) => [p.id, p]))
  }

  const audioObjectIds = comments
    .filter((c) => c.type === 'audio' && c.object_id)
    .map((c) => c.object_id!)
  const audioFileMap = new Map<
    string,
    { filename: string; rehearsal_id: string }
  >()

  if (audioObjectIds.length > 0) {
    const audioFiles = await db.queryMany<{
      id: string
      filename: string
      rehearsal_id: string
    }>(
      'SELECT id, filename, rehearsal_id FROM audio_files WHERE id = ANY($1::uuid[])',
      [audioObjectIds]
    )
    audioFiles.forEach((af) => audioFileMap.set(af.id, af))
  }

  const rehearsalIds = new Set<string>()
  comments.forEach((c) => {
    if (c.type === 'rehearsal' && c.object_id) rehearsalIds.add(c.object_id)
  })
  audioFileMap.forEach((af) => rehearsalIds.add(af.rehearsal_id))

  const rehearsalMap = new Map<string, { id: string; rehearsal_date: string }>()
  if (rehearsalIds.size > 0) {
    const rehearsals = await db.queryMany<{
      id: string
      rehearsal_date: string
    }>(
      'SELECT id, rehearsal_date::text AS rehearsal_date FROM rehearsals WHERE id = ANY($1::uuid[])',
      [[...rehearsalIds]]
    )
    rehearsals.forEach((r) => rehearsalMap.set(r.id, r))
  }

  const commentContentMap = new Map(comments.map((c) => [c.id, c.content]))

  const photoObjectIds = comments
    .filter((c) => c.type === 'photo' && c.object_id)
    .map((c) => c.object_id!)
  const photoAlbumMap = new Map<string, { album_slug: string }>()

  if (photoObjectIds.length > 0) {
    const photos = await db.queryMany<{ id: string; album_id: string }>(
      'SELECT id, album_id FROM photos WHERE id = ANY($1::uuid[])',
      [photoObjectIds]
    )
    if (photos.length > 0) {
      const albumIds = [...new Set(photos.map((p) => p.album_id))]
      const albums = await db.queryMany<{ id: string; slug: string }>(
        'SELECT id, slug FROM albums WHERE id = ANY($1::uuid[])',
        [albumIds]
      )
      const albumSlugMap = new Map(albums.map((a) => [a.id, a.slug]))
      photos.forEach((p) => {
        const slug = albumSlugMap.get(p.album_id)
        if (slug) photoAlbumMap.set(p.id, { album_slug: slug })
      })
    }
  }

  const normalizedComments = comments.map((c) => {
    const userProfile = profileMap.get(c.user_id)
    let section = ''
    let section_url = ''
    let object_name = ''
    let object_url = ''

    switch (c.type) {
      case 'audio': {
        const audioFile = audioFileMap.get(c.object_id || '')
        const rehearsal = audioFile
          ? rehearsalMap.get(audioFile.rehearsal_id)
          : null
        section = 'Репетиции'
        section_url = '/admin/rehearsals'
        object_name = audioFile?.filename || 'Аудио файл'
        object_url = rehearsal
          ? adminRehearsalUrl(rehearsal.rehearsal_date, {
              audio: c.object_id || undefined,
            })
          : '/admin/rehearsals'
        break
      }
      case 'photo': {
        const photoAlbum = photoAlbumMap.get(c.object_id || '')
        section = 'Фото'
        section_url = '/gallery'
        object_name = 'Фотография'
        object_url = photoAlbum
          ? `/gallery/${photoAlbum.album_slug}?photo=${c.object_id}`
          : '/gallery'
        break
      }
      case 'rehearsal': {
        const rehearsal = rehearsalMap.get(c.object_id || '')
        section = 'Репетиции'
        section_url = '/admin/rehearsals'
        object_name = rehearsal
          ? `Репетиция ${rehearsal.rehearsal_date}`
          : 'Репетиция'
        object_url = rehearsal
          ? adminRehearsalUrl(rehearsal.rehearsal_date)
          : '/admin/rehearsals'
        break
      }
      case 'event':
        section = 'Концерты'
        section_url = '/admin/events'
        object_name = 'Событие'
        object_url = '/admin/events'
        break
      case 'song':
        section = 'Песни'
        section_url = '/songs'
        object_name = 'Песня'
        object_url = '/songs'
        break
    }

    return {
      id: c.id,
      type: c.type,
      content: c.content,
      created_at: c.created_at,
      user_id: c.user_id,
      user_name: userProfile?.display_name || 'Неизвестный',
      user_role: userProfile?.role || 'fan',
      timestamp_seconds: c.timestamp_seconds,
      object_id: c.object_id,
      parent_id: c.parent_id,
      parent_preview: c.parent_id
        ? (commentContentMap.get(c.parent_id) || '').slice(0, 60)
        : null,
      section,
      section_url,
      object_name,
      object_url,
    }
  })

  return NextResponse.json({ comments: normalizedComments })
}
