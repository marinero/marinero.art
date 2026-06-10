import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { SongViewer } from './song-viewer'
import { SongRehearsals, type RehearsalTake } from './song-rehearsals'
import type {
  Chord,
  SongText,
  SongTextChord,
  AudioFile,
  Video,
  MultitrackGroup,
  MultitrackFile,
} from '@/lib/types'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/metadata'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params

  const song = await db.queryOne<{ title: string }>(
    `SELECT title FROM song_texts
     WHERE slug = $1 AND is_published = true`,
    [slug]
  )

  if (!song) {
    return pageMetadata({ segments: ['Тексты песен', 'Песня не найдена'] })
  }

  return pageMetadata({
    segments: ['Тексты песен', `"${song.title}"`],
    description: `Текст и аккорды песни "${song.title}"`,
  })
}

export default async function SongPage({ params }: PageProps) {
  const { slug } = await params
  const { user, isAdmin, displayName } = await getSessionUser()

  const song = await db.queryOne<SongText>(
    `SELECT * FROM song_texts
     WHERE slug = $1 ${isAdmin ? '' : 'AND is_published = true'}`,
    [slug]
  )

  if (!song) {
    notFound()
  }

  const chordRows = await db.queryMany<{
    id: string
    song_text_id: string
    chord_id: string
    position: number
    created_at: string
    chord: Chord
  }>(
    `SELECT stc.id, stc.song_text_id, stc.chord_id, stc.position, stc.created_at,
            json_build_object(
              'id', c.id,
              'name', c.name,
              'root_note', c.root_note,
              'chord_type', c.chord_type,
              'fret_positions', c.fret_positions,
              'finger_positions', c.finger_positions,
              'base_fret', c.base_fret,
              'created_at', c.created_at
            ) AS chord
     FROM song_text_chords stc
     INNER JOIN chords c ON c.id = stc.chord_id
     WHERE stc.song_text_id = $1
     ORDER BY stc.position ASC`,
    [song.id]
  )

  const chords: SongTextChord[] = chordRows.map((row) => ({
    id: row.id,
    song_text_id: row.song_text_id,
    chord_id: row.chord_id,
    position: row.position,
    created_at: row.created_at,
    chord: row.chord,
  }))

  // Admins see rehearsal recordings/multitracks (internal) plus every tagged
  // video. Regular users only see published videos tagged with this song
  // (the song itself is already guaranteed published for them by the query above).
  let rehearsalTakes: RehearsalTake[] = []
  let songVideos: Video[] = []
  if (isAdmin) {
    const media = await getSongMedia(song.id)
    rehearsalTakes = media.rehearsals
    songVideos = media.videos
  } else {
    songVideos = await getPublishedSongVideos(song.id)
  }

  const showMedia = isAdmin || songVideos.length > 0

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} isAdmin={isAdmin} displayName={displayName} />
      <main className="flex-1 container mx-auto px-4 py-8">
        <SongViewer 
          song={song} 
          chords={chords} 
        />
        {showMedia && (
          <div className="max-w-4xl mx-auto mt-6">
            <SongRehearsals
              rehearsals={rehearsalTakes}
              videos={songVideos}
              songSlug={song.slug}
              isAdmin={isAdmin}
            />
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}

async function getPublishedSongVideos(songId: string): Promise<Video[]> {
  return db.queryMany<Video>(
    `SELECT * FROM videos
     WHERE song_text_id = $1 AND is_published = true
     ORDER BY order_index ASC, created_at DESC`,
    [songId]
  )
}

type AudioTake = AudioFile & { rehearsal_date: string }
type MultitrackTake = MultitrackGroup & { rehearsal_date: string }

async function getSongMedia(
  songId: string
): Promise<{ rehearsals: RehearsalTake[]; videos: Video[] }> {
  const [audio, multitracks, videos] = await Promise.all([
    db.queryMany<AudioTake>(
      `SELECT af.id, af.rehearsal_id, af.file_url, af.filename,
              af.duration_seconds, af.song_text_id, af.created_at,
              r.rehearsal_date
       FROM audio_files af
       JOIN rehearsals r ON r.id = af.rehearsal_id
       WHERE af.song_text_id = $1
       ORDER BY r.rehearsal_date DESC, af.created_at ASC`,
      [songId]
    ),
    db.queryMany<MultitrackTake>(
      `SELECT mg.id, mg.rehearsal_id, mg.name, mg.song_text_id, mg.created_at,
              r.rehearsal_date
       FROM multitrack_groups mg
       JOIN rehearsals r ON r.id = mg.rehearsal_id
       WHERE mg.song_text_id = $1
       ORDER BY r.rehearsal_date DESC, mg.created_at ASC`,
      [songId]
    ),
    db.queryMany<Video>(
      `SELECT * FROM videos
       WHERE song_text_id = $1
       ORDER BY order_index ASC, created_at DESC`,
      [songId]
    ),
  ])

  // Attach multitrack files
  const groupIds = multitracks.map((g) => g.id)
  let filesByGroup: Record<string, MultitrackFile[]> = {}
  if (groupIds.length > 0) {
    const files = await db.queryMany<MultitrackFile>(
      `SELECT * FROM multitrack_files
       WHERE multitrack_group_id = ANY($1::uuid[])
       ORDER BY order_index ASC`,
      [groupIds]
    )
    filesByGroup = files.reduce<Record<string, MultitrackFile[]>>((acc, f) => {
      ;(acc[f.multitrack_group_id] ??= []).push(f)
      return acc
    }, {})
  }

  // Group recordings + multitracks by rehearsal
  const byRehearsal = new Map<string, RehearsalTake>()
  function ensure(id: string, date: string): RehearsalTake {
    let take = byRehearsal.get(id)
    if (!take) {
      take = { rehearsal_id: id, rehearsal_date: date, audio: [], multitracks: [] }
      byRehearsal.set(id, take)
    }
    return take
  }

  for (const a of audio) ensure(a.rehearsal_id, a.rehearsal_date).audio.push(a)
  for (const g of multitracks) {
    ensure(g.rehearsal_id, g.rehearsal_date).multitracks.push({
      ...g,
      files: filesByGroup[g.id] ?? [],
    })
  }

  const rehearsals = Array.from(byRehearsal.values()).sort(
    (a, b) =>
      new Date(b.rehearsal_date).getTime() - new Date(a.rehearsal_date).getTime()
  )

  return { rehearsals, videos }
}
