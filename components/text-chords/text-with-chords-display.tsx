'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { splitTextWithChords } from '@/lib/text-chords'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChordDiagram } from '@/components/songs/chord-diagram'
import { Button } from '@/components/ui/button'
import { Volume2 } from 'lucide-react'
import type { Chord, CommentChord } from '@/lib/types'

interface TextWithChordsDisplayProps {
  text: string
  chords: CommentChord[]
  chordMap: Map<string, Chord>
  /** Called when the user presses "play" inside a chord's popover. */
  onChordClick?: (chord: Chord) => void
  activeChordId?: string
  /** Custom renderer for the text of a single line (e.g. @mentions). */
  renderText?: (line: string) => ReactNode
  className?: string
}

/**
 * Read-only rendering of text with chord names placed above characters.
 * The block is monospaced so `ch`-based positioning aligns with characters.
 * Clicking a chord opens a popover with its fingering diagram and a play button.
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
                    <span
                      key={c.position}
                      className="absolute top-0"
                      style={{ left: `${c.relativePosition}ch` }}
                    >
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              'cursor-pointer hover:text-primary/80 transition-colors whitespace-nowrap',
                              activeChordId && chord?.id === activeChordId && 'underline'
                            )}
                          >
                            {chord?.name ?? '?'}
                          </button>
                        </PopoverTrigger>
                        {chord && (
                          <PopoverContent className="w-auto p-3" align="start">
                            <div className="flex flex-col items-center gap-2">
                              <ChordDiagram
                                name={chord.name}
                                fretPositions={chord.fret_positions as number[]}
                                fingerPositions={chord.finger_positions as number[] | null}
                                baseFret={chord.base_fret}
                                size="md"
                              />
                              {onChordClick && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2 font-sans"
                                  onClick={() => onChordClick(chord)}
                                >
                                  <Volume2 className="h-4 w-4" />
                                  Воспроизвести
                                </Button>
                              )}
                            </div>
                          </PopoverContent>
                        )}
                      </Popover>
                    </span>
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
