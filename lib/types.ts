export interface Profile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  role: 'fan' | 'admin'
  created_at: string
  updated_at: string
}

export interface Album {
  id: string
  title: string
  slug: string
  description: string | null
  cover_image_url: string | null
  event_date: string | null
  is_published: boolean
  created_at: string
  updated_at: string
  photos?: Photo[]
  photo_count?: number
}

export interface Photo {
  id: string
  album_id: string
  url: string
  thumbnail_url: string | null
  caption: string | null
  order_index: number
  created_at: string
  comments?: Comment[]
  comment_count?: number
}

/** A chord placed over comment/song text at a character position. */
export interface CommentChord {
  chord_id: string
  position: number
}

export interface Comment {
  id: string
  type: 'audio' | 'photo' | 'rehearsal' | 'event' | 'song' | 'video'
  object_id: string
  user_id: string
  content: string
  created_at: string
  parent_id?: string | null
  timestamp_seconds?: number | null
  chords?: CommentChord[] | null
  profile?: Profile
}

export interface Event {
  id: string
  title: string
  slug: string
  description: string | null
  venue: string | null
  city: string | null
  event_date: string
  doors_time: string | null
  venue_address: string | null
  google_maps_url: string | null
  how_to_get: string | null
  entry_rules: string | null
  contacts: string | null
  ticket_url: string | null
  image_url: string | null
  is_published: boolean
  created_at: string
  updated_at: string
  comment_count?: number
}

export interface PlatformLink {
  id: string
  platform: string
  url: string
  icon: string | null
  order_index: number
  is_active: boolean
  created_at: string
}

// Song Texts & Chords
export interface SongText {
  id: string
  title: string
  slug: string
  text_content: string
  bpm: number | null
  is_published: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  chords?: SongTextChord[]
}

export interface Chord {
  id: string
  name: string
  root_note: string
  chord_type: string
  fret_positions: number[] // [E, A, D, G, B, e] -1 = muted, 0 = open
  finger_positions: number[] | null
  base_fret: number
  created_at: string
}

export interface SongTextChord {
  id: string
  song_text_id: string
  chord_id: string
  position: number
  created_at: string
  chord?: Chord
}

// Documents attached to a song (sheet music, tabs, other files)
export type SongDocumentKind = 'sheet' | 'tab' | 'sheet_tab' | 'other'

export interface SongDocument {
  id: string
  song_text_id: string
  title: string
  kind: SongDocumentKind
  file_url: string
  filename: string
  content_type: string | null
  size_bytes: number | null
  is_published: boolean
  order_index: number
  created_at: string
  updated_at: string
}

// Guitar fretboard types
export type GuitarString = 1 | 2 | 3 | 4 | 5 | 6
export type Fret = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

export interface FretPosition {
  string: GuitarString
  fret: Fret
}

export interface NotePosition extends FretPosition {
  note: string
  octave: number
}

// Junction table for event-album many-to-many relationship
export interface EventAlbum {
  id: string
  event_id: string
  album_id: string
  display_order: number
  created_at: string
  album?: Album
}

// Video types
export interface Video {
  id: string
  title: string
  slug: string | null
  description: string | null
  video_url: string
  video_type: 'youtube' | 'vk' | 'rutube' | 'custom'
  thumbnail_url: string | null
  duration_seconds: number | null
  is_published: boolean
  order_index: number
  created_at: string
  updated_at: string
  comment_count?: number
  song_text_id?: string | null
}

// Audio recording attached to a rehearsal
export interface AudioFile {
  id: string
  rehearsal_id: string
  file_url: string
  filename: string
  duration_seconds: number | null
  song_text_id?: string | null
  created_at: string
}

// Junction table for event-video many-to-many relationship
export interface EventVideo {
  id: string
  event_id: string
  video_id: string
  display_order: number
  created_at: string
  video?: Video
}

// Junction table for rehearsal-video many-to-many relationship
export interface RehearsalVideo {
  id: string
  rehearsal_id: string
  video_id: string
  display_order: number
  created_at: string
  video?: Video
}

// Multitrack types
export interface MultitrackGroup {
  id: string
  rehearsal_id: string
  name: string
  song_text_id?: string | null
  created_at: string
  files?: MultitrackFile[]
  comments?: MultitrackComment[]
  comment_count?: number
}

export interface MultitrackFile {
  id: string
  multitrack_group_id: string
  filename: string
  file_url: string
  duration_seconds: number | null
  waveform_data: number[] | null // Array of amplitude values (0-1)
  volume: number // 0-100
  order_index: number
  created_at: string
}

export interface MultitrackComment {
  id: string
  multitrack_group_id: string
  user_id: string
  content: string
  timestamp_seconds: number | null
  solo_track_id: string | null
  parent_id: string | null
  created_at: string
  updated_at: string
  chords?: CommentChord[] | null
  profile?: Profile
}

// About section
export interface AboutContent {
  id: number
  title: string | null
  body: string | null
  updated_at: string
}

export type ReleaseType = 'album' | 'ep' | 'single' | 'live' | 'compilation'

export interface DiscographyLink {
  id: string
  discography_id: string
  platform: string
  url: string
  icon: string | null
  order_index: number
  created_at: string
}

export interface DiscographyItem {
  id: string
  title: string
  year: number | null
  release_type: ReleaseType
  cover_image_url: string | null
  description: string | null
  order_index: number
  is_published: boolean
  created_at: string
  updated_at: string
  links?: DiscographyLink[]
}

export interface MemberTimelineSegment {
  id: string
  member_id: string
  role: string
  start_year: number
  end_year: number | null
  order_index: number
  created_at: string
}

export interface BandMember {
  id: string
  name: string
  photo_url: string | null
  instruments: string | null
  bio: string | null
  is_current: boolean
  order_index: number
  created_at: string
  updated_at: string
  segments?: MemberTimelineSegment[]
}
