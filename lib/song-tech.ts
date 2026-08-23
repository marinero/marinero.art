import type { SongDocumentKind } from '@/lib/types'

export const TECH_KEYS = [
  'score_synth',
  'score_bvox',
  'score_bass',
  'preset_qc',
  'preset_gp200',
  'preset_vl_rack',
  'preset_xv5080',
  'ableton',
  'audio_click',
  'audio_guide',
  'audio_synth',
  'audio_bvox1',
  'audio_bvox2',
  'midi_qc',
  'midi_gp200',
  'midi_vlive',
] as const

export type TechKey = (typeof TECH_KEYS)[number]

export type TechFileRef = {
  url: string
  filename: string
  content_type?: string | null
}

export type TechCellValue = string | TechFileRef
export type TechMeta = Record<TechKey, TechCellValue>
export type CellType = 'pdf_file' | 'media_file' | 'midi_file' | 'text'
export type OuterGroupId = 'score_presets' | 'playback'
export type InnerGroupId = 'score' | 'presets' | 'audio' | 'midi'

export type TechColumn = {
  key: TechKey
  label: string
  type: CellType
  outer: OuterGroupId
  inner: InnerGroupId | null
}

export const TECH_COLUMNS: TechColumn[] = [
  { key: 'score_synth', label: 'Synth', type: 'pdf_file', outer: 'score_presets', inner: 'score' },
  { key: 'score_bvox', label: 'BVox', type: 'pdf_file', outer: 'score_presets', inner: 'score' },
  { key: 'score_bass', label: 'Bass', type: 'pdf_file', outer: 'score_presets', inner: 'score' },
  { key: 'preset_qc', label: 'QC', type: 'text', outer: 'score_presets', inner: 'presets' },
  { key: 'preset_gp200', label: 'GP-200', type: 'text', outer: 'score_presets', inner: 'presets' },
  { key: 'preset_vl_rack', label: 'VL Rack', type: 'text', outer: 'score_presets', inner: 'presets' },
  { key: 'preset_xv5080', label: 'XV-5080', type: 'text', outer: 'score_presets', inner: 'presets' },
  { key: 'audio_click', label: 'Click', type: 'media_file', outer: 'playback', inner: 'audio' },
  { key: 'audio_guide', label: 'Guide', type: 'media_file', outer: 'playback', inner: 'audio' },
  { key: 'audio_synth', label: 'Synth', type: 'media_file', outer: 'playback', inner: 'audio' },
  { key: 'audio_bvox1', label: 'BVox 1', type: 'media_file', outer: 'playback', inner: 'audio' },
  { key: 'audio_bvox2', label: 'BVox 2', type: 'media_file', outer: 'playback', inner: 'audio' },
  { key: 'midi_qc', label: 'QC', type: 'midi_file', outer: 'playback', inner: 'midi' },
  { key: 'midi_gp200', label: 'GP-200', type: 'midi_file', outer: 'playback', inner: 'midi' },
  { key: 'midi_vlive', label: 'VLive', type: 'midi_file', outer: 'playback', inner: 'midi' },
]

export const FILE_KEYS: TechKey[] = [
  'score_synth',
  'score_bvox',
  'score_bass',
  'audio_click',
  'audio_guide',
  'audio_synth',
  'audio_bvox1',
  'audio_bvox2',
  'midi_qc',
  'midi_gp200',
  'midi_vlive',
]

export const OUTER_GROUPS: { id: OuterGroupId; label: string }[] = [
  { id: 'score_presets', label: 'Score / Presets' },
  { id: 'playback', label: 'Ableton / Audio / MIDI' },
]

export const INNER_GROUPS: { id: InnerGroupId; label: string; outer: OuterGroupId }[] = [
  { id: 'score', label: 'Score', outer: 'score_presets' },
  { id: 'presets', label: 'Presets', outer: 'score_presets' },
  { id: 'audio', label: 'Ableton', outer: 'playback' },
  { id: 'midi', label: 'MIDI', outer: 'playback' },
]

export type SetlistDocument = {
  id: string
  title: string
  kind: SongDocumentKind
}

export type SetlistSong = {
  id: string
  title: string
  slug: string
  bpm: string | null
  tech_meta: TechMeta
  documents: SetlistDocument[]
}

export function emptyTechMeta(): TechMeta {
  return Object.fromEntries(TECH_KEYS.map((key) => [key, ''])) as TechMeta
}

export function isFileRef(value: TechCellValue | unknown): value is TechFileRef {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as TechFileRef).url === 'string' &&
      (value as TechFileRef).url
  )
}

export function asTextValue(value: TechCellValue | undefined): string {
  return typeof value === 'string' ? value : ''
}

export function normalizeTechMeta(raw: unknown): TechMeta {
  const base = emptyTechMeta()
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Record<string, unknown>
  for (const key of TECH_KEYS) {
    const value = obj[key]
    if (FILE_KEYS.includes(key)) {
      if (isFileRef(value)) {
        base[key] = {
          url: value.url,
          filename: value.filename || 'file',
          content_type: value.content_type ?? null,
        }
      } else if (value === 'no') {
        base[key] = 'no'
      } else {
        base[key] = ''
      }
      continue
    }
    if (typeof value === 'string') base[key] = value
  }
  return base
}

export function normalizeSetlistSong(row: {
  id: string
  title: string
  slug: string
  bpm: string | number | null
  tech_meta: unknown
  documents: unknown
}): SetlistSong {
  const documents = Array.isArray(row.documents)
    ? (row.documents as SetlistDocument[])
    : []
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    bpm: row.bpm == null || row.bpm === '' ? null : String(row.bpm),
    tech_meta: normalizeTechMeta(row.tech_meta),
    documents,
  }
}

export const DOC_KIND_SHORT: Record<SongDocumentKind, string> = {
  sheet: 'Н',
  tab: 'Т',
  sheet_tab: 'Н+Т',
  other: 'файл',
}

export const DOC_KIND_LABEL: Record<SongDocumentKind, string> = {
  sheet: 'Ноты',
  tab: 'Табы',
  sheet_tab: 'Ноты + Табы',
  other: 'Другое',
}
