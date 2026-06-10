'use client'

import { cn } from '@/lib/utils'
import { calculateBaseFret } from '@/lib/guitar-utils'

interface ChordDiagramProps {
  name: string
  fretPositions: number[] // [E, A, D, G, B, e] -1 = muted, 0 = open
  fingerPositions?: number[] | null
  baseFret?: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
  onClick?: () => void
  isSelected?: boolean
  className?: string
}

const SIZES = {
  xs: { width: 65, height: 80, fretHeight: 12, stringGap: 8, dotSize: 6, fontSize: 8 },
  sm: { width: 65, height: 80, fretHeight: 12, stringGap: 8, dotSize: 6, fontSize: 8 },
  md: { width: 100, height: 120, fretHeight: 18, stringGap: 12, dotSize: 10, fontSize: 10 },
  lg: { width: 130, height: 160, fretHeight: 24, stringGap: 16, dotSize: 14, fontSize: 12 }
}

export function ChordDiagram({
  name,
  fretPositions,
  fingerPositions,
  baseFret: propBaseFret,
  size = 'md',
  onClick,
  isSelected = false,
  className
}: ChordDiagramProps) {
  const dimensions = SIZES[size]
  const baseFret = propBaseFret ?? calculateBaseFret(fretPositions)
  
  // Calculate optimal display frets based on positions
  const maxFretUsed = Math.max(...fretPositions.filter(f => f > 0).map(f => f - baseFret + 1), 0)
  const displayFrets = maxFretUsed <= 3 ? 4 : 5
  
  // Normalize fret positions relative to base fret for display
  const normalizedPositions = fretPositions.map(fret => {
    if (fret <= 0) return fret // Keep muted (-1) and open (0)
    return fret - baseFret + 1
  })

  const nutWidth = dimensions.stringGap * 5 // 6 strings, 5 gaps
  const startX = size === 'xs' || size === 'sm' ? 18 : 25
  const startY = size === 'xs' || size === 'sm' ? 16 : 25

  return (
    <div
      onClick={onClick}
      className={cn(
        "inline-flex flex-col items-center cursor-pointer transition-all",
        onClick && "hover:scale-105",
        isSelected && "ring-2 ring-primary rounded-lg",
        className
      )}
    >
      <svg
        width={dimensions.width}
        height={startY + displayFrets * dimensions.fretHeight + 10}
        viewBox={`0 0 ${dimensions.width} ${startY + displayFrets * dimensions.fretHeight + 10}`}
        className="overflow-visible"
      >
        {/* Chord name */}
        <text
          x={dimensions.width / 2}
          y={12}
          textAnchor="middle"
          className="fill-foreground font-semibold"
          fontSize={size === 'xs' ? 8 : size === 'sm' ? 10 : size === 'md' ? 12 : 14}
        >
          {name}
        </text>

        {/* Base fret indicator - closer to fretboard */}
        {baseFret > 1 && (
          <text
            x={startX - 3}
            y={startY + dimensions.fretHeight / 2 + 4}
            textAnchor="end"
            className="fill-foreground font-medium"
            fontSize={dimensions.fontSize}
          >
            {baseFret}fr
          </text>
        )}

        {/* Nut (only if starting from fret 1) */}
        {baseFret === 1 && (
          <rect
            x={startX}
            y={startY - 3}
            width={nutWidth}
            height={4}
            className="fill-foreground"
            rx={1}
          />
        )}

        {/* Fret board background */}
        <rect
          x={startX}
          y={startY}
          width={nutWidth}
          height={displayFrets * dimensions.fretHeight}
          className="fill-amber-100 dark:fill-amber-950/30"
          rx={0}
        />

        {/* Frets - horizontal lines */}
        {Array.from({ length: displayFrets + 1 }).map((_, fretIdx) => (
          <line
            key={`fret-${fretIdx}`}
            x1={startX}
            y1={startY + fretIdx * dimensions.fretHeight}
            x2={startX + nutWidth}
            y2={startY + fretIdx * dimensions.fretHeight}
            className="stroke-stone-400 dark:stroke-stone-600"
            strokeWidth={fretIdx === 0 ? 2 : 1}
          />
        ))}

        {/* Left edge of fretboard */}
        <line
          x1={startX}
          y1={startY}
          x2={startX}
          y2={startY + displayFrets * dimensions.fretHeight}
          className="stroke-stone-500 dark:stroke-stone-500"
          strokeWidth={2}
        />

        {/* Right edge of fretboard */}
        <line
          x1={startX + nutWidth}
          y1={startY}
          x2={startX + nutWidth}
          y2={startY + displayFrets * dimensions.fretHeight}
          className="stroke-stone-500 dark:stroke-stone-500"
          strokeWidth={2}
        />

        {/* Strings - vertical lines */}
        {Array.from({ length: 6 }).map((_, stringIdx) => (
          <line
            key={`string-${stringIdx}`}
            x1={startX + stringIdx * dimensions.stringGap}
            y1={startY}
            x2={startX + stringIdx * dimensions.stringGap}
            y2={startY + displayFrets * dimensions.fretHeight}
            strokeWidth={1 + (5 - stringIdx) * 0.2}
            className="stroke-zinc-400 dark:stroke-zinc-500"
          />
        ))}

        {/* String indicators (muted/open) above nut */}
        {normalizedPositions.map((fret, stringIdx) => {
          const x = startX + stringIdx * dimensions.stringGap
          
          if (fret === -1) {
            // Muted string - X above
            return (
              <text
                key={`mute-${stringIdx}`}
                x={x}
                y={startY - 6}
                textAnchor="middle"
                className="fill-muted-foreground font-medium"
                fontSize={dimensions.fontSize}
              >
                ×
              </text>
            )
          }
          
          if (fret === 0) {
            // Open string - O above
            return (
              <circle
                key={`open-${stringIdx}`}
                cx={x}
                cy={startY - 8}
                r={dimensions.dotSize / 2 - 1}
                className="stroke-muted-foreground fill-none"
                strokeWidth={1.5}
              />
            )
          }
          
          return null
        })}

        {/* Finger positions on frets */}
        {normalizedPositions.map((fret, stringIdx) => {
          if (fret <= 0) return null
          
          const x = startX + stringIdx * dimensions.stringGap
          const y = startY + (fret - 0.5) * dimensions.fretHeight
          
          return (
            <g key={`fret-${stringIdx}`}>
              <circle
                cx={x}
                cy={y}
                r={dimensions.dotSize / 2}
                className="fill-foreground"
              />
              {fingerPositions && fingerPositions[stringIdx] > 0 && (
                <text
                  x={x}
                  y={y + (dimensions.dotSize / 6)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-background font-bold"
                  fontSize={size === 'xs' ? 4 : size === 'sm' ? 5 : size === 'md' ? 7 : 9}
                >
                  {fingerPositions[stringIdx] === 5 ? 'T' : fingerPositions[stringIdx]}
                </text>
              )}
            </g>
          )
        })}

        {/* Barre indicator */}
        {(() => {
          const barre = detectBarre(normalizedPositions)
          if (!barre) return null
          
          const startStringX = startX + barre.startString * dimensions.stringGap
          const endStringX = startX + barre.endString * dimensions.stringGap
          const y = startY + (barre.fret - 0.5) * dimensions.fretHeight
          
          return (
            <rect
              x={startStringX - dimensions.dotSize / 2}
              y={y - dimensions.dotSize / 2}
              width={endStringX - startStringX + dimensions.dotSize}
              height={dimensions.dotSize}
              rx={dimensions.dotSize / 2}
              className="fill-foreground"
            />
          )
        })()}
      </svg>
    </div>
  )
}

// Simple barre detection
function detectBarre(positions: number[]): { fret: number; startString: number; endString: number } | null {
  const frettedPositions = positions.map((p, i) => ({ fret: p, string: i })).filter(p => p.fret > 0)
  if (frettedPositions.length < 2) return null
  
  const minFret = Math.min(...frettedPositions.map(p => p.fret))
  const sameFretPositions = frettedPositions.filter(p => p.fret === minFret)
  
  if (sameFretPositions.length >= 2) {
    const strings = sameFretPositions.map(p => p.string)
    const minString = Math.min(...strings)
    const maxString = Math.max(...strings)
    
    // Check if it's a true barre (consecutive strings or all strings between are either same fret or higher)
    let isBarre = true
    for (let s = minString; s <= maxString; s++) {
      if (positions[s] !== -1 && positions[s] < minFret) {
        isBarre = false
        break
      }
    }
    
    if (isBarre && maxString - minString >= 1) {
      return { fret: minFret, startString: minString, endString: maxString }
    }
  }
  
  return null
}
