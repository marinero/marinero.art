'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Chord, SongTextChord } from '@/lib/types'

export function TextWithChords({
  text,
  chords,
  draggedChord,
  hoveredPosition,
  onHoverPosition,
  onDrop,
  onRemoveChord,
  onPlayChord,
  onTextChange,
  isPlaying,
}: {
  text: string
  chords: SongTextChord[]
  draggedChord: Chord | null
  hoveredPosition: number | null
  onHoverPosition: (pos: number | null) => void
  onDrop: (position: number) => void
  onRemoveChord: (position: number) => void
  onPlayChord: (position: number) => void
  onTextChange: (
    newText: string,
    cursorPosition?: number,
    changeType?: 'insert' | 'delete',
    changeLength?: number
  ) => void
  isPlaying: boolean
}) {
  const [isEditMode, setIsEditMode] = useState(!text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevTextRef = useRef(text)

  useEffect(() => {
    if (isEditMode && textareaRef.current) textareaRef.current.focus()
  }, [isEditMode])

  useEffect(() => {
    prevTextRef.current = text
  }, [text])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    const oldText = prevTextRef.current
    const cursorPos = e.target.selectionStart
    const lengthDiff = newText.length - oldText.length

    if (lengthDiff > 0) {
      onTextChange(newText, cursorPos - lengthDiff, 'insert', lengthDiff)
    } else if (lengthDiff < 0) {
      onTextChange(newText, cursorPos, 'delete', Math.abs(lengthDiff))
    } else {
      onTextChange(newText)
    }

    prevTextRef.current = newText
  }

  if (isEditMode) {
    return (
      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInputChange}
          onBlur={() => text && setIsEditMode(false)}
          className="w-full min-h-[400px] resize-y whitespace-pre-wrap rounded-lg border bg-background p-4 font-sans text-sm leading-relaxed tracking-wide outline-none"
          placeholder="Введите текст песни..."
        />
        {text ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditMode(false)}>
            Готово — разместить аккорды
          </Button>
        ) : null}
      </div>
    )
  }

  const lines = text.split('\n')
  let globalPosition = 0

  return (
    <div className="space-y-2">
      {draggedChord ? (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-center text-sm">
          Кликните на любую букву, чтобы поставить аккорд <strong>{draggedChord.name}</strong>
        </div>
      ) : null}
      <div
        className={cn(
          'min-h-[400px] overflow-x-auto rounded-lg border bg-background p-4 font-sans',
          draggedChord && 'ring-2 ring-primary/50'
        )}
      >
        <div className="space-y-0">
          {lines.map((line, lineIndex) => {
            const lineStart = globalPosition
            globalPosition += line.length + 1
            const lineChords = chords.filter(
              (c) => c.position >= lineStart && c.position < lineStart + line.length
            )

            return (
              <div key={lineIndex} className="relative">
                <div className="relative h-6">
                  {lineChords.map((chordData) => {
                    const relativePos = chordData.position - lineStart
                    const chord = chordData.chord
                    return (
                      <div
                        key={chordData.id}
                        className="group absolute -top-1"
                        style={{ left: `${relativePos * 0.62}em` }}
                      >
                        <Badge
                          variant="secondary"
                          className="cursor-pointer text-xs transition-colors hover:bg-primary hover:text-primary-foreground"
                          onClick={() => onPlayChord(chordData.position)}
                        >
                          {chord?.name || '?'}
                          {isPlaying ? '' : ''}
                        </Badge>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveChord(chordData.position)
                          }}
                          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="flex whitespace-pre text-sm leading-relaxed tracking-wide">
                  {line.length === 0 ? (
                    <span
                      className={cn(
                        'block min-h-[1.5em] w-full',
                        draggedChord && 'cursor-crosshair hover:bg-primary/10'
                      )}
                      onClick={() => draggedChord && onDrop(lineStart)}
                    >
                      &nbsp;
                    </span>
                  ) : (
                    line.split('').map((char, charIndex) => {
                      const position = lineStart + charIndex
                      const hasChord = chords.some((c) => c.position === position)
                      const isHovered = hoveredPosition === position
                      return (
                        <span
                          key={charIndex}
                          className={cn(
                            'relative select-none',
                            draggedChord && 'cursor-crosshair hover:bg-primary/20',
                            isHovered && 'bg-primary/30',
                            hasChord && 'font-bold text-primary'
                          )}
                          onMouseEnter={() => draggedChord && onHoverPosition(position)}
                          onMouseLeave={() => draggedChord && onHoverPosition(null)}
                          onClick={() => draggedChord && onDrop(position)}
                        >
                          {char === ' ' ? '\u00A0' : char}
                        </span>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
        Редактировать текст
      </Button>
    </div>
  )
}
