import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { resolveRehearsal } from '@/lib/admin-resolve'
import {
  buildCommentThreads,
  groupAudioCommentsByFile,
  type CommentRow,
} from '@/lib/comment-threads'

async function saveRehearsalVideos(rehearsalId: string, videoIds: string[]) {
  await db.query('DELETE FROM rehearsal_videos WHERE rehearsal_id = $1', [
    rehearsalId,
  ])

  for (let i = 0; i < videoIds.length; i++) {
    await db.query(
      `INSERT INTO rehearsal_videos (rehearsal_id, video_id, display_order)
       VALUES ($1, $2, $3)`,
      [rehearsalId, videoIds[i], i]
    )
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id: idOrDate } = await params
  const rehearsal = await resolveRehearsal<{
    id: string
    rehearsal_date: string
    plan: string | null
    created_at: string
  }>(idOrDate)

  if (!rehearsal) {
    return NextResponse.json({ error: 'Rehearsal not found' }, { status: 404 })
  }

  const session = await auth()
  const profile = session?.user?.id
    ? await db.queryOne<{ role: string }>(
        'SELECT role FROM profiles WHERE id = $1',
        [session.user.id]
      )
    : null

  const [audioFiles, rehearsalCommentRows, videoLinks, allVideos, allSongs] =
    await Promise.all([
      db.queryMany<{ id: string }>(
        'SELECT * FROM audio_files WHERE rehearsal_id = $1 ORDER BY created_at ASC',
        [rehearsal.id]
      ),
      db.queryMany<CommentRow>(
        `SELECT c.id, c.content, c.created_at, c.user_id, c.parent_id, c.chords,
           p.display_name
         FROM comments c
         LEFT JOIN profiles p ON p.id = c.user_id
         WHERE c.type = 'rehearsal' AND c.object_id = $1
         ORDER BY c.created_at ASC`,
        [rehearsal.id]
      ),
      db.queryMany<{ video_id: string; display_order: number }>(
        `SELECT video_id, display_order FROM rehearsal_videos
         WHERE rehearsal_id = $1 ORDER BY display_order ASC`,
        [rehearsal.id]
      ),
      db.queryMany('SELECT * FROM videos ORDER BY order_index ASC'),
      db.queryMany<{ id: string; title: string; slug: string }>(
        'SELECT id, title, slug FROM song_texts ORDER BY title ASC'
      ),
    ])

  const audioIds = audioFiles.map((a) => a.id)
  let audioCommentRows: CommentRow[] = []

  if (audioIds.length > 0) {
    audioCommentRows = await db.queryMany<CommentRow>(
      `SELECT c.id, c.object_id, c.content, c.timestamp_seconds, c.created_at,
         c.user_id, c.parent_id, c.chords, p.display_name
       FROM comments c
       LEFT JOIN profiles p ON p.id = c.user_id
       WHERE c.type = 'audio' AND c.object_id = ANY($1::uuid[])
       ORDER BY c.created_at ASC`,
      [audioIds]
    )
  }

  const videoIds = videoLinks.map((v) => v.video_id)
  let rehearsalVideos: Record<string, unknown>[] = []

  if (videoIds.length > 0) {
    const videosData = await db.queryMany<{ id: string }>(
      'SELECT * FROM videos WHERE id = ANY($1::uuid[])',
      [videoIds]
    )
    rehearsalVideos = videoLinks
      .map((link) => {
        const video = videosData.find((v) => v.id === link.video_id)
        return video ? { ...video, display_order: link.display_order } : null
      })
      .filter(Boolean) as Record<string, unknown>[]
  }

  return NextResponse.json({
    rehearsal,
    audio_files: audioFiles,
    comments: buildCommentThreads(rehearsalCommentRows),
    audio_comments: groupAudioCommentsByFile(audioCommentRows),
    rehearsal_videos: rehearsalVideos,
    selected_video_ids: videoIds,
    all_videos: allVideos,
    all_songs: allSongs,
    current_user: session?.user?.id
      ? {
          id: session.user.id,
          isAdmin: profile?.role === 'admin',
        }
      : null,
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id: idOrDate } = await params
  const rehearsal = await resolveRehearsal<{ id: string }>(idOrDate)

  if (!rehearsal) {
    return NextResponse.json({ error: 'Rehearsal not found' }, { status: 404 })
  }

  const body = await request.json()

  const created = await db.queryOne<{ id: string }>(
    `INSERT INTO audio_files (rehearsal_id, file_url, filename, duration_seconds)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      rehearsal.id,
      body.file_url,
      body.filename,
      body.duration_seconds ?? null,
    ]
  )

  if (!created) {
    return NextResponse.json(
      { error: 'Failed to save audio file' },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: created.id })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id: idOrDate } = await params
  const rehearsal = await resolveRehearsal<{ id: string }>(idOrDate)

  if (!rehearsal) {
    return NextResponse.json({ error: 'Rehearsal not found' }, { status: 404 })
  }

  const body = await request.json()

  if (Array.isArray(body.videoIds)) {
    await saveRehearsalVideos(rehearsal.id, body.videoIds)
    return NextResponse.json({ ok: true })
  }

  // Assign / clear the song for an audio file of this rehearsal
  if (body.audioFileId && 'song_text_id' in body) {
    await db.query(
      'UPDATE audio_files SET song_text_id = $3 WHERE id = $1 AND rehearsal_id = $2',
      [body.audioFileId, rehearsal.id, body.song_text_id ?? null]
    )
    return NextResponse.json({ ok: true })
  }

  if ('plan' in body) {
    const plan =
      typeof body.plan === 'string' && body.plan.trim() !== ''
        ? body.plan
        : null
    await db.query(
      'UPDATE rehearsals SET plan = $2, updated_at = now() WHERE id = $1',
      [rehearsal.id, plan]
    )
    return NextResponse.json({ ok: true })
  }

  if (body.rehearsal_date) {
    await db.query(
      'UPDATE rehearsals SET rehearsal_date = $2::date, updated_at = now() WHERE id = $1',
      [rehearsal.id, body.rehearsal_date]
    )
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const { id: idOrDate } = await params
  const rehearsal = await resolveRehearsal<{ id: string }>(idOrDate)

  if (!rehearsal) {
    return NextResponse.json({ error: 'Rehearsal not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const audioFileId = searchParams.get('audioFileId')

  if (audioFileId) {
    await db.query(
      'DELETE FROM audio_files WHERE id = $1 AND rehearsal_id = $2',
      [audioFileId, rehearsal.id]
    )
    return NextResponse.json({ ok: true })
  }

  await db.query('DELETE FROM rehearsals WHERE id = $1', [rehearsal.id])

  return NextResponse.json({ ok: true })
}
