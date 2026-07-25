'use client'

import { useEffect, useMemo, useState } from 'react'
import { CommentInput } from '@/components/comments/comment-input'
import { ChordLibrary } from '@/components/songs/chord-library'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Music, X } from 'lucide-react'
import {
  buildChordMap,
  remapChordsForText,
  splitTextWithChords,
} from '@/lib/text-chords'
import type { Chord, CommentChord } from '@/lib/types'

interface CommentChordComposerProps {
  value: string
  onChange: (value: string) => void
  chords: CommentChord[]
  onChordsChange: (chords: CommentChord[]) => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}

export function CommentChordComposer({
  value,
  onChange,
  chords,
  onChordsChange,
  placeholder,
  disabled,
  autoFocus,
  className,
}: CommentChordComposerProps) {
  const [chordMode, setChordMode] = useState(false)
  const [activeChord, setActiveChord] = useState<Chord | null>(null)
  const [library, setLibrary] = useState<Chord[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/chords')
      .then((res) => (res.ok ? res.json() : { chords: [] }))
      .then((data) => {
        if (!cancelled) setLibrary((data.chords ?? []) as Chord[])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const chordMap = useMemo(() => buildChordMap(library), [library])

  const handleTextChange = (next: string) => {
    if (chords.length > 0 && next !== value) {
      onChordsChange(remapChordsForText(value, next, chords))
    }
    onChange(next)
  }

  const placeChordAt = (position: number) => {
    if (!activeChord) return
    const existing = chords.find((c) => c.position === position)
    if (existing && existing.chord_id === activeChord.id) {
      // Same chord clicked again → remove it
      onChordsChange(chords.filter((c) => c.position !== position))
      return
    }
    const withoutPos = chords.filter((c) => c.position !== position)
    onChordsChange(
      [...withoutPos, { chord_id: activeChord.id, position }].sort(
        (a, b) => a.position - b.position
      )
    )
  }

  const removeChordAt = (position: number) => {
    onChordsChange(chords.filter((c) => c.position !== position))
  }

  const slices = splitTextWithChords(value, chords)

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-start gap-2">
        <CommentInput
          value={value}
          onChange={handleTextChange}
          multiline
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className="flex-1 min-h-[80px]"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={chordMode ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setChordMode((v) => !v)}
          disabled={disabled || !value.trim()}
          className="gap-2"
        >
          <Music className="h-4 w-4" />
          {chordMode ? 'Готово' : 'Аккорды'}
        </Button>
        {chords.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {chords.length} аккорд(ов)
          </span>
        )}
        {chords.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChordsChange([])}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Очистить
          </Button>
        )}
      </div>

      {chordMode && (
        <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground">
            {activeChord
              ? `Выбран ${activeChord.name}. Кликните на букву в тексте, чтобы поставить аккорд.`
              : 'Выберите аккорд ниже, затем кликните на букву в тексте.'}
          </p>

          {/* Text with per-character placement targets */}
          <div className="rounded-md border bg-background p-3 font-mono text-sm overflow-x-auto">
            {slices.map((slice, lineIndex) => (
              <div key={lineIndex}>
                {/* Chord row */}
                <div className="relative h-5">
                  {slice.chords.map((c) => {
                    const chord = chordMap.get(c.chord_id)
                    return (
                      <span
                        key={c.position}
                        className="absolute top-0 group flex items-center text-primary font-semibold"
                        style={{ left: `${c.relativePosition}ch` }}
                      >
                        {chord?.name ?? '?'}
                        <button
                          type="button"
                          onClick={() => removeChordAt(c.position)}
                          className="ml-0.5 opacity-0 group-hover:opacity-100 text-destructive"
                          title="Удалить"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
                {/* Character targets */}
                <div className="whitespace-pre">
                  {slice.line.length === 0 ? (
                    <span
                      className={cn(
                        'inline-block min-h-[1.2em] w-full',
                        activeChord && 'cursor-pointer hover:bg-primary/10'
                      )}
                      onClick={() => activeChord && placeChordAt(slice.lineStart)}
                    >
                      {'\u00A0'}
                    </span>
                  ) : (
                    slice.line.split('').map((char, charIndex) => {
                      const position = slice.lineStart + charIndex
                      const hasChord = chords.some((c) => c.position === position)
                      return (
                        <span
                          key={charIndex}
                          onClick={() => activeChord && placeChordAt(position)}
                          className={cn(
                            'relative',
                            activeChord && 'cursor-pointer hover:bg-primary/20',
                            hasChord && 'text-primary font-bold'
                          )}
                        >
                          {char === ' ' ? '\u00A0' : char}
                        </span>
                      )
                    })
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Chord picker */}
          <div className="h-[260px] rounded-md border">
            <ChordLibrary
              selectedChordId={activeChord?.id ?? null}
              onSelectChord={(chord) => setActiveChord(chord)}
              className="h-full"
            />
          </div>
        </div>
      )}
    </div>
  )
}
