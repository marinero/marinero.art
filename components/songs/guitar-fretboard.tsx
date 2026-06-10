'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { getNoteAtPosition } from '@/lib/guitar-utils'

interface GuitarFretboardProps {
  fretPositions: number[]
  fingerPositions?: number[] // 0 = no finger, 1-4 = finger number, T = thumb (5)
  onFretPositionsChange: (positions: number[]) => void
  onFingerPositionsChange?: (positions: number[]) => void
  totalFrets?: number
  showNotes?: boolean
  showFingers?: boolean
  className?: string
}

// Correct order: low E at top, high e at bottom (as you look at guitar from player's view)
const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E']
const FRET_MARKERS = [3, 5, 7, 9, 12]

export function GuitarFretboard({
  fretPositions,
  fingerPositions = [0, 0, 0, 0, 0, 0],
  onFretPositionsChange,
  onFingerPositionsChange,
  totalFrets = 14,
  showNotes = true,
  showFingers = true,
  className
}: GuitarFretboardProps) {
  const [hoveredPosition, setHoveredPosition] = useState<{ string: number; fret: number } | null>(null)
  const [fingerSelectOpen, setFingerSelectOpen] = useState<{ string: number; fret: number } | null>(null)

  // Convert display index to actual string index (reversed)
  const toActualIndex = (displayIdx: number) => 5 - displayIdx
  const toDisplayIndex = (actualIdx: number) => 5 - actualIdx

  const handleFretClick = useCallback((displayStringIdx: number, fret: number) => {
    const actualIdx = toActualIndex(displayStringIdx)
    const newPositions = [...fretPositions]
    
    // If clicking on already selected fret, open finger selector
    if (newPositions[actualIdx] === fret && fret > 0 && showFingers && onFingerPositionsChange) {
      setFingerSelectOpen({ string: displayStringIdx, fret })
      return
    }
    
    // If clicking on already selected fret without finger support, toggle to muted
    if (newPositions[actualIdx] === fret) {
      newPositions[actualIdx] = -1
      // Reset finger position
      if (onFingerPositionsChange) {
        const newFingers = [...fingerPositions]
        newFingers[actualIdx] = 0
        onFingerPositionsChange(newFingers)
      }
    } else {
      newPositions[actualIdx] = fret
    }
    
    onFretPositionsChange(newPositions)
    setFingerSelectOpen(null)
  }, [fretPositions, fingerPositions, onFretPositionsChange, onFingerPositionsChange, showFingers])

  const handleFingerSelect = useCallback((displayStringIdx: number, finger: number) => {
    if (!onFingerPositionsChange) return
    const actualIdx = toActualIndex(displayStringIdx)
    const newFingers = [...fingerPositions]
    newFingers[actualIdx] = finger
    onFingerPositionsChange(newFingers)
    setFingerSelectOpen(null)
  }, [fingerPositions, onFingerPositionsChange])

  const toggleMuted = useCallback((displayStringIdx: number) => {
    const actualIdx = toActualIndex(displayStringIdx)
    const newPositions = [...fretPositions]
    if (newPositions[actualIdx] === -1) {
      newPositions[actualIdx] = 0 // Open string
    } else {
      newPositions[actualIdx] = -1 // Muted
    }
    onFretPositionsChange(newPositions)
  }, [fretPositions, onFretPositionsChange])

  return (
    <div className={cn("select-none w-full", className)}>
      {/* Fretboard container */}
      <div className="relative">
        {/* Fret numbers on top */}
        <div className="flex h-6 mb-1">
          <div className="w-8 flex-shrink-0" /> {/* Spacer for string names */}
          <div className="w-10 flex-shrink-0" /> {/* Spacer for nut */}
          {Array.from({ length: totalFrets }).map((_, fretIdx) => (
            <div 
              key={fretIdx} 
              className="flex-1 text-center text-xs text-muted-foreground"
            >
              {fretIdx + 1}
            </div>
          ))}
        </div>

        {/* Main fretboard */}
        <div className="flex">
          {/* String names column */}
          <div className="w-8 flex-shrink-0 flex flex-col">
            {STRING_NAMES.map((name, displayIdx) => {
              const actualIdx = toActualIndex(displayIdx)
              const isMuted = fretPositions[actualIdx] === -1
              return (
                <div key={displayIdx} className="h-8 flex items-center justify-center">
                  <button
                    onClick={() => toggleMuted(displayIdx)}
                    className={cn(
                      "w-6 h-6 rounded text-xs font-mono font-medium transition-colors",
                      isMuted 
                        ? "text-destructive" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title={isMuted ? "Нажмите чтобы включить" : "Нажмите чтобы заглушить"}
                  >
                    {isMuted ? 'X' : name}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Nut (open strings area) */}
          <div className="w-10 flex-shrink-0 bg-amber-50 dark:bg-amber-950/30 border-r-4 border-zinc-400 dark:border-zinc-500 rounded-l">
            {STRING_NAMES.map((_, displayIdx) => {
              const actualIdx = toActualIndex(displayIdx)
              const isSelected = fretPositions[actualIdx] === 0
              const isMuted = fretPositions[actualIdx] === -1
              const isHovered = hoveredPosition?.string === displayIdx && hoveredPosition?.fret === 0
              const noteInfo = getNoteAtPosition(actualIdx, 0)
              
              return (
                <div
                  key={displayIdx}
                  className="relative h-8 flex items-center justify-center"
                >
                  {/* String line */}
                  <div 
                    className={cn(
                      "absolute inset-x-0 top-1/2 -translate-y-1/2 bg-gradient-to-b from-zinc-300 to-zinc-400 dark:from-zinc-400 dark:to-zinc-500",
                      isMuted ? "opacity-30" : "opacity-100"
                    )}
                    style={{
                      height: `${1 + displayIdx * 0.4}px`
                    }}
                  />
                  
                  {/* Clickable area for open string */}
                  <button
                    onClick={() => handleFretClick(displayIdx, 0)}
                    onMouseEnter={() => setHoveredPosition({ string: displayIdx, fret: 0 })}
                    onMouseLeave={() => setHoveredPosition(null)}
                    className={cn(
                      "relative z-10 w-6 h-6 rounded-full transition-all flex items-center justify-center",
                      isSelected 
                        ? "bg-primary text-primary-foreground shadow-md scale-110" 
                        : isHovered 
                          ? "bg-primary/30" 
                          : "hover:bg-primary/20"
                    )}
                  >
                    {(isSelected || isHovered) && showNotes && (
                      <span className="text-[10px] font-medium">
                        {noteInfo.note}
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Frets */}
          <div className="flex flex-1 bg-amber-900/80 dark:bg-amber-950/50 rounded-r">
            {Array.from({ length: totalFrets }).map((_, fretIdx) => {
              const fret = fretIdx + 1
              const hasMarker = FRET_MARKERS.includes(fret)
              const isDoubleMarker = fret === 12
              
              return (
                <div 
                  key={fret} 
                  className="relative flex-1 border-r-2 border-zinc-400 dark:border-zinc-500"
                >
                  {/* Strings and clickable areas */}
                  {STRING_NAMES.map((_, displayIdx) => {
                    const actualIdx = toActualIndex(displayIdx)
                    const isSelected = fretPositions[actualIdx] === fret
                    const isMuted = fretPositions[actualIdx] === -1
                    const isHovered = hoveredPosition?.string === displayIdx && hoveredPosition?.fret === fret
                    const noteInfo = getNoteAtPosition(actualIdx, fret)
                    const fingerNum = fingerPositions[actualIdx]
                    const isFingerSelectOpen = fingerSelectOpen?.string === displayIdx && fingerSelectOpen?.fret === fret
                    
                    return (
                      <div
                        key={displayIdx}
                        className="relative h-8 flex items-center justify-center"
                      >
                        {/* String line */}
                        <div 
                          className={cn(
                            "absolute inset-x-0 top-1/2 -translate-y-1/2 bg-gradient-to-b from-zinc-300 to-zinc-400 dark:from-zinc-400 dark:to-zinc-500",
                            isMuted ? "opacity-30" : "opacity-100"
                          )}
                          style={{
                            height: `${1 + displayIdx * 0.4}px`
                          }}
                        />
                        
                        {/* Clickable area */}
                        <button
                          onClick={() => handleFretClick(displayIdx, fret)}
                          onMouseEnter={() => setHoveredPosition({ string: displayIdx, fret })}
                          onMouseLeave={() => setHoveredPosition(null)}
                          className={cn(
                            "relative z-10 w-6 h-6 rounded-full transition-all flex items-center justify-center",
                            isSelected 
                              ? "bg-primary text-primary-foreground shadow-md scale-110" 
                              : isHovered 
                                ? "bg-primary/30" 
                                : "hover:bg-primary/20"
                          )}
                        >
                          {(isSelected || isHovered) && showNotes && (
                            <span className="text-[10px] font-medium">
                              {noteInfo.note}
                            </span>
                          )}
                        </button>

                        {/* Finger selector popup */}
                        {isFingerSelectOpen && (
                          <div className="absolute left-8 z-50 flex gap-1 bg-popover border rounded-lg shadow-lg p-1">
                            {[1, 2, 3, 4, 5].map((f) => (
                              <button
                                key={f}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleFingerSelect(displayIdx, f)
                                }}
                                className={cn(
                                  "w-6 h-6 rounded text-xs font-bold transition-colors",
                                  fingerNum === f 
                                    ? "bg-primary text-primary-foreground" 
                                    : "hover:bg-muted"
                                )}
                                title={f === 5 ? "Большой палец" : `Палец ${f}`}
                              >
                                {f === 5 ? 'T' : f}
                              </button>
                            ))}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleFingerSelect(displayIdx, 0)
                              }}
                              className="w-6 h-6 rounded text-xs hover:bg-muted text-muted-foreground"
                              title="Убрать палец"
                            >
                              -
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Fret marker dots - positioned between strings */}
                  {hasMarker && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {isDoubleMarker ? (
                        <div className="flex flex-col gap-12">
                          <div className="w-2.5 h-2.5 rounded-full bg-zinc-300/60 dark:bg-zinc-500/40" />
                          <div className="w-2.5 h-2.5 rounded-full bg-zinc-300/60 dark:bg-zinc-500/40" />
                        </div>
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-300/60 dark:bg-zinc-500/40" />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-primary" />
          <span>Выбрано</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 flex items-center justify-center text-destructive font-mono font-bold">X</span>
          <span>Не звучит</span>
        </div>
        {showFingers && onFingerPositionsChange && (
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">1</div>
            <span>Кликните повторно для выбора пальца</span>
          </div>
        )}
      </div>
    </div>
  )
}
