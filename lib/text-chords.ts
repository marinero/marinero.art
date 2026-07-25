import type { Chord, CommentChord } from '@/lib/types'

/**
 * Comment types that support a chord layer over their text.
 * Photos are intentionally excluded — chords make no sense there.
 */
export const CHORDS_ENABLED_COMMENT_TYPES = [
  'song',
  'video',
  'audio',
  'rehearsal',
  'event',
] as const

export type ChordEnabledCommentType =
  (typeof CHORDS_ENABLED_COMMENT_TYPES)[number]

export function commentTypeSupportsChords(type: string | null | undefined): boolean {
  return CHORDS_ENABLED_COMMENT_TYPES.includes(type as ChordEnabledCommentType)
}

/** Max number of chords allowed on a single comment (basic abuse guard). */
export const MAX_COMMENT_CHORDS = 100

/**
 * Validate + normalize a chords payload coming from a client.
 * Returns a clean array of { chord_id, position } or null when there is
 * nothing valid to store. Throws never — invalid entries are dropped.
 */
export function sanitizeCommentChords(
  input: unknown,
  contentLength: number
): CommentChord[] | null {
  if (!Array.isArray(input)) return null

  const seen = new Set<number>()
  const result: CommentChord[] = []

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const chordId = (raw as Record<string, unknown>).chord_id
    const position = (raw as Record<string, unknown>).position

    if (typeof chordId !== 'string' || !chordId) continue
    if (typeof position !== 'number' || !Number.isInteger(position)) continue
    if (position < 0 || position >= contentLength) continue
    if (seen.has(position)) continue // one chord per character position

    seen.add(position)
    result.push({ chord_id: chordId, position })

    if (result.length >= MAX_COMMENT_CHORDS) break
  }

  if (result.length === 0) return null

  result.sort((a, b) => a.position - b.position)
  return result
}

/**
 * Shift chord positions when text is edited, keeping chords anchored to
 * their characters. Mirrors the logic used in the song editor.
 */
export function shiftChordPositions(
  chords: CommentChord[],
  cursorPosition: number,
  changeType: 'insert' | 'delete',
  changeLength: number
): CommentChord[] {
  if (changeType === 'insert') {
    return chords.map((c) => ({
      ...c,
      position: c.position >= cursorPosition ? c.position + changeLength : c.position,
    }))
  }

  const deleteStart = cursorPosition
  const deleteEnd = cursorPosition + changeLength

  return chords
    .filter((c) => c.position < deleteStart || c.position >= deleteEnd)
    .map((c) => ({
      ...c,
      position: c.position >= deleteEnd ? c.position - changeLength : c.position,
    }))
}

/**
 * Recompute chord positions after an arbitrary text edit, using a
 * common-prefix/suffix diff (no cursor info required). Chords inside the
 * changed span are dropped; chords after it are shifted.
 */
export function remapChordsForText(
  oldText: string,
  newText: string,
  chords: CommentChord[]
): CommentChord[] {
  if (oldText === newText || chords.length === 0) return chords

  const maxPrefix = Math.min(oldText.length, newText.length)
  let prefix = 0
  while (prefix < maxPrefix && oldText[prefix] === newText[prefix]) prefix++

  let suffix = 0
  while (
    suffix < maxPrefix - prefix &&
    oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]
  ) {
    suffix++
  }

  const removedLength = oldText.length - prefix - suffix
  const addedLength = newText.length - prefix - suffix

  let next = chords
  if (removedLength > 0) {
    next = shiftChordPositions(next, prefix, 'delete', removedLength)
  }
  if (addedLength > 0) {
    next = shiftChordPositions(next, prefix, 'insert', addedLength)
  }
  return next
}

export interface ChordLineSlice<T extends { position: number }> {
  line: string
  /** Global character index where this line starts. */
  lineStart: number
  /** Chords whose position falls within this line. */
  chords: Array<T & { relativePosition: number }>
}

/**
 * Split text into lines and attach the chords that belong to each line,
 * with positions made relative to the line start. Newlines count as one
 * character, matching how positions are stored.
 */
export function splitTextWithChords<T extends { position: number }>(
  text: string,
  chords: T[]
): ChordLineSlice<T>[] {
  const lines = text.split('\n')
  const slices: ChordLineSlice<T>[] = []
  let globalPosition = 0

  for (const line of lines) {
    const lineStart = globalPosition
    const lineEnd = lineStart + line.length
    globalPosition = lineEnd + 1 // +1 for the newline

    const lineChords = chords
      .filter((c) => c.position >= lineStart && c.position < lineEnd)
      .map((c) => ({ ...c, relativePosition: c.position - lineStart }))

    slices.push({ line, lineStart, chords: lineChords })
  }

  return slices
}

/** Build a quick lookup from chord id to full chord. */
export function buildChordMap(chords: Chord[]): Map<string, Chord> {
  return new Map(chords.map((c) => [c.id, c]))
}
