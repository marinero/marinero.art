'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { splitTextWithChords } from '@/lib/text-chords'
import type { Chord, CommentChord } from '@/lib/types'

interface TextWithChordsDisplayProps {
  text: string
  chords: CommentChord[]
  chordMap: Map<string, Chord>
  onChordClick?: (chord: Chord) => void
  activeChordId?: string
  /** Custom renderer for the text of a single line (e.g. @mentions). */
  renderText?: (line: string) => ReactNode
  className?: string
}

/**
 * Read-only rendering of text with chord names placed above characters.
 * The block is monospaced so `ch`-based positioning aligns with characters.
 */
export function TextWithChordsDisplay({
  text,
  chords,
  chordMap,
  onChordClick,
  activeChordId,
  renderText,
  className,
}: TextWithChordsDisplayProps) {
  const slices = splitTextWithChords(text, chords)

  return (
    <span className={cn('block font-mono whitespace-pre-wrap break-words', className)}>
      {slices.map((slice, lineIndex) => {
        const isEmptyLine = slice.line.length === 0

        return (
          <span key={lineIndex} className="block">
            {slice.chords.length > 0 && (
              <span className="relative block h-5 text-primary font-semibold text-sm leading-5">
                {slice.chords.map((c) => {
                  const chord = chordMap.get(c.chord_id)
                  return (
                    <button
                      key={c.position}
                      type="button"
                      onClick={() => chord && onChordClick?.(chord)}
                      className={cn(
                        'absolute top-0 cursor-pointer hover:text-primary/80 transition-colors',
                        !onChordClick && 'cursor-default',
                        activeChordId && chord?.id === activeChordId && 'underline'
                      )}
                      style={{ left: `${c.relativePosition}ch` }}
                    >
                      {chord?.name ?? '?'}
                    </button>
                  )
                })}
              </span>
            )}
            <span className="block leading-relaxed">
              {isEmptyLine ? '\u00A0' : renderText ? renderText(slice.line) : slice.line}
            </span>
          </span>
        )
      })}
    </span>
  )
}
