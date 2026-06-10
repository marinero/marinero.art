'use client'

import { useMemo } from 'react'
import type { BandMember } from '@/lib/types'
import {
  BAND_ROLES,
  getRoleColor,
  getRoleLabel,
  ALBUM_MARKER_COLOR,
  ALBUM_MARKER_LABEL,
} from '@/lib/band'

interface BandTimelineProps {
  members: BandMember[]
  albumYears: number[]
}

const BAR_HEIGHT = 12
const BAR_GAP = 4
const ROW_PADDING = 7
const LABEL_WIDTH = 180

function rowHeight(lanes: number): number {
  const count = Math.max(lanes, 1)
  return count * BAR_HEIGHT + (count - 1) * BAR_GAP + ROW_PADDING * 2
}

export function BandTimeline({ members, albumYears }: BandTimelineProps) {
  const currentYear = new Date().getFullYear()

  const rows = useMemo(
    () => members.filter((m) => (m.segments?.length ?? 0) > 0),
    [members]
  )

  const { minYear, maxYear, span } = useMemo(() => {
    const years: number[] = [...albumYears]
    for (const m of rows) {
      for (const s of m.segments ?? []) {
        years.push(s.start_year)
        years.push(s.end_year ?? currentYear)
      }
    }
    if (years.length === 0) {
      return { minYear: currentYear, maxYear: currentYear, span: 1 }
    }
    const lo = Math.min(...years)
    const hi = Math.max(...years)
    return { minYear: lo, maxYear: hi, span: hi - lo + 1 }
  }, [rows, albumYears, currentYear])

  if (rows.length === 0) {
    return null
  }

  const pctLeft = (year: number) => ((year - minYear) / span) * 100
  const pctWidth = (start: number, end: number) =>
    ((end - start + 1) / span) * 100

  // Метки годов на оси (каждые 2 года, чтобы не было тесно)
  const axisYears: number[] = []
  for (let y = minYear; y <= maxYear; y += 1) {
    if ((y - minYear) % 2 === 0) axisYears.push(y)
  }

  const usedRoleKeys = new Set<string>()
  rows.forEach((m) => m.segments?.forEach((s) => usedRoleKeys.add(s.role)))
  const legendRoles = BAND_ROLES.filter((r) => usedRoleKeys.has(r.key))

  return (
    <div className="w-full">
      <div className="overflow-x-auto pb-2">
        <div style={{ minWidth: 720 }}>
          {/* Chart body */}
          <div className="relative">
            {rows.map((member) => {
              const segments = member.segments ?? []
              const lanes = segments.length
              return (
                <div
                  key={member.id}
                  className="relative flex items-stretch border-b border-border/40"
                  style={{ height: rowHeight(lanes) }}
                >
                  {/* Name */}
                  <div
                    className="flex items-center pr-3 text-sm text-foreground/90 truncate"
                    style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }}
                    title={member.name}
                  >
                    {member.name}
                  </div>

                  {/* Track */}
                  <div className="relative flex-1">
                    {/* vertical album markers */}
                    {albumYears.map((y, i) => (
                      <div
                        key={`mk-${i}`}
                        className="absolute top-0 bottom-0"
                        style={{
                          left: `${pctLeft(y + 0.5)}%`,
                          width: 1,
                          backgroundColor: ALBUM_MARKER_COLOR,
                          opacity: 0.35,
                        }}
                      />
                    ))}

                    {/* segment bars */}
                    {segments.map((s, i) => {
                      const end = s.end_year ?? currentYear
                      return (
                        <div
                          key={s.id}
                          className="absolute rounded-sm"
                          style={{
                            left: `${pctLeft(s.start_year)}%`,
                            width: `${pctWidth(s.start_year, end)}%`,
                            top: ROW_PADDING + i * (BAR_HEIGHT + BAR_GAP),
                            height: BAR_HEIGHT,
                            backgroundColor: getRoleColor(s.role),
                          }}
                          title={`${getRoleLabel(s.role)}: ${s.start_year}–${
                            s.end_year ?? 'наст.'
                          }`}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* X axis */}
            <div className="relative flex" style={{ height: 22 }}>
              <div style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }} />
              <div className="relative flex-1">
                {axisYears.map((y) => (
                  <div
                    key={y}
                    className="absolute top-1 text-[10px] text-muted-foreground -translate-x-1/2"
                    style={{ left: `${pctLeft(y + 0.5)}%` }}
                  >
                    {y}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
        {legendRoles.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-4 rounded-sm"
              style={{ backgroundColor: r.color }}
            />
            <span className="text-xs text-muted-foreground">{r.label}</span>
          </div>
        ))}
        {albumYears.length > 0 && (
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-[2px]"
              style={{ backgroundColor: ALBUM_MARKER_COLOR }}
            />
            <span className="text-xs text-muted-foreground">
              {ALBUM_MARKER_LABEL}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
