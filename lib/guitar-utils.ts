import { Note, Chord as TonalChord, Interval } from 'tonal'

// Standard tuning: E2, A2, D3, G3, B3, E4
export const STANDARD_TUNING = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']

// Note names in chromatic order
export const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Enharmonic equivalents
export const ENHARMONIC_MAP: Record<string, string> = {
  'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B',
  'E#': 'F', 'B#': 'C'
}

/**
 * Get the note at a specific fret on a specific string
 */
export function getNoteAtPosition(stringIndex: number, fret: number): { note: string; octave: number; fullNote: string } {
  const openNote = STANDARD_TUNING[stringIndex]
  const openNoteName = Note.pitchClass(openNote) || ''
  const openOctave = Note.octave(openNote) || 0
  
  const openNoteIndex = CHROMATIC_NOTES.indexOf(normalizeNote(openNoteName))
  const newNoteIndex = (openNoteIndex + fret) % 12
  const octaveIncrease = Math.floor((openNoteIndex + fret) / 12)
  
  const note = CHROMATIC_NOTES[newNoteIndex]
  const octave = openOctave + octaveIncrease
  
  return { note, octave, fullNote: `${note}${octave}` }
}

/**
 * Normalize note name to sharp notation
 */
export function normalizeNote(note: string): string {
  const pitchClass = Note.pitchClass(note) || note
  return ENHARMONIC_MAP[pitchClass] || pitchClass
}

/**
 * Get all notes from fret positions array
 * fretPositions: [E, A, D, G, B, e] where -1 = muted, 0 = open
 */
export function getNotesFromFretPositions(fretPositions: number[]): string[] {
  const notes: string[] = []
  
  fretPositions.forEach((fret, stringIndex) => {
    if (fret >= 0) {
      const { note } = getNoteAtPosition(stringIndex, fret)
      if (!notes.includes(note)) {
        notes.push(note)
      }
    }
  })
  
  return notes
}

/**
 * Get full notes with octaves from fret positions
 */
export function getFullNotesFromFretPositions(fretPositions: number[]): string[] {
  const notes: string[] = []
  
  fretPositions.forEach((fret, stringIndex) => {
    if (fret >= 0) {
      const { fullNote } = getNoteAtPosition(stringIndex, fret)
      notes.push(fullNote)
    }
  })
  
  return notes
}

/**
 * Detect chord name from a set of notes
 */
export function detectChordFromNotes(notes: string[]): { name: string; root: string; type: string } | null {
  if (notes.length < 2) return null
  
  const normalizedNotes = notes.map(normalizeNote)
  const uniqueNotes = [...new Set(normalizedNotes)]
  
  // Try to detect chord using tonal
  const detected = TonalChord.detect(uniqueNotes)
  
  if (detected.length > 0) {
    const chordName = detected[0]
    const parsed = TonalChord.get(chordName)
    
    if (parsed.tonic && parsed.type) {
      return {
        name: chordName,
        root: parsed.tonic,
        type: parsed.type || 'major'
      }
    }
  }
  
  // Fallback: try each note as potential root
  for (const root of uniqueNotes) {
    const intervals = uniqueNotes
      .filter(n => n !== root)
      .map(n => {
        const semitones = (CHROMATIC_NOTES.indexOf(n) - CHROMATIC_NOTES.indexOf(root) + 12) % 12
        return Interval.fromSemitones(semitones)
      })
      .filter(Boolean)
    
    const chordType = detectChordType(intervals as string[])
    if (chordType) {
      return {
        name: `${root}${chordType}`,
        root,
        type: chordType
      }
    }
  }
  
  return null
}

/**
 * Detect chord type from intervals
 */
function detectChordType(intervals: string[]): string | null {
  const intervalSet = new Set(intervals)
  
  // Major
  if (intervalSet.has('3M') && intervalSet.has('5P')) {
    if (intervalSet.has('7M')) return 'maj7'
    if (intervalSet.has('7m')) return '7'
    return ''
  }
  
  // Minor
  if (intervalSet.has('3m') && intervalSet.has('5P')) {
    if (intervalSet.has('7M')) return 'mMaj7'
    if (intervalSet.has('7m')) return 'm7'
    return 'm'
  }
  
  // Diminished
  if (intervalSet.has('3m') && intervalSet.has('5d')) {
    if (intervalSet.has('7d')) return 'dim7'
    if (intervalSet.has('7m')) return 'm7b5'
    return 'dim'
  }
  
  // Augmented
  if (intervalSet.has('3M') && intervalSet.has('5A')) {
    return 'aug'
  }
  
  // Sus4
  if (intervalSet.has('4P') && intervalSet.has('5P') && !intervalSet.has('3M') && !intervalSet.has('3m')) {
    return 'sus4'
  }
  
  // Sus2
  if (intervalSet.has('2M') && intervalSet.has('5P') && !intervalSet.has('3M') && !intervalSet.has('3m')) {
    return 'sus2'
  }
  
  // Power chord
  if (intervalSet.has('5P') && intervalSet.size === 1) {
    return '5'
  }
  
  return null
}

/**
 * Calculate the base fret for chord diagram display
 */
export function calculateBaseFret(fretPositions: number[]): number {
  const playedFrets = fretPositions.filter(f => f > 0)
  if (playedFrets.length === 0) return 1
  
  const minFret = Math.min(...playedFrets)
  const maxFret = Math.max(...playedFrets)
  
  // If all frets fit within first 4 frets, show from fret 1
  if (maxFret <= 4) return 1
  
  // Otherwise, start from the minimum fret
  return minFret
}

/**
 * Get frequency for a note (for audio playback)
 */
export function getNoteFrequency(note: string, octave: number): number {
  const noteIndex = CHROMATIC_NOTES.indexOf(normalizeNote(note))
  if (noteIndex === -1) return 440
  
  // A4 = 440Hz is our reference
  const semitonesFromA4 = noteIndex - 9 + (octave - 4) * 12
  return 440 * Math.pow(2, semitonesFromA4 / 12)
}

/**
 * Generate a slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}
