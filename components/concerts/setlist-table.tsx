'use client'

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { GripVertical, Minus, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TechFileCell } from '@/components/concerts/tech-file-cell'
import {
  TECH_COLUMNS,
  OUTER_GROUPS,
  asTextValue,
  type InnerGroupId,
  type OuterGroupId,
  type SetlistSong,
  type TechColumn,
  type TechCellValue,
  type TechKey,
  type TechMeta,
} from '@/lib/song-tech'

const STORAGE_KEY = 'setlist-groups-v1'

const FROZEN_W = {
  grip: 28,
  num: 36,
  bpm: 56,
  title: 220,
} as const

function frozenOffsets(concert: boolean) {
  const grip = concert ? 0 : undefined
  const num = concert ? FROZEN_W.grip : 0
  const bpm = num + FROZEN_W.num
  const title = bpm + FROZEN_W.bpm
  return {
    grip,
    num,
    bpm,
    title,
    total: title + FROZEN_W.title,
  }
}

function frozenBox(left: number, width: number): CSSProperties {
  return { left, width, minWidth: width, maxWidth: width }
}

type ExpandedState = {
  outer: Record<OuterGroupId, boolean>
  inner: Record<InnerGroupId, boolean>
}

const DEFAULT_EXPANDED: ExpandedState = {
  outer: { score_presets: true, playback: true },
  inner: { score: true, presets: true, audio: true, midi: true },
}

function loadExpanded(): ExpandedState {
  if (typeof window === 'undefined') return DEFAULT_EXPANDED
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_EXPANDED
    const parsed = JSON.parse(raw) as ExpandedState
    return {
      outer: { ...DEFAULT_EXPANDED.outer, ...parsed.outer },
      inner: { ...DEFAULT_EXPANDED.inner, ...parsed.inner },
    }
  } catch {
    return DEFAULT_EXPANDED
  }
}

function cols(inner: InnerGroupId) {
  return TECH_COLUMNS.filter((c) => c.inner === inner)
}

export type SetlistTableProps = {
  songs: SetlistSong[]
  variant: 'concert' | 'song'
  songHref?: (song: SetlistSong) => string
  onPatchSong: (
    songId: string,
    payload: { bpm?: string | null; tech_meta?: TechMeta }
  ) => Promise<void>
  onReorder?: (from: number, to: number) => void
  onRemove?: (songId: string) => void
}

export function SetlistTable({
  songs,
  variant,
  songHref,
  onPatchSong,
  onReorder,
  onRemove,
}: SetlistTableProps) {
  const [expanded, setExpanded] = useState<ExpandedState>(DEFAULT_EXPANDED)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [editing, setEditing] = useState<{ songId: string; field: 'bpm' | TechKey } | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setExpanded(loadExpanded())
  }, [])

  const persistExpanded = useCallback((next: ExpandedState) => {
    setExpanded(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* ignore quota */
    }
  }, [])

  const toggleOuter = (id: OuterGroupId) => {
    persistExpanded({
      ...expanded,
      outer: { ...expanded.outer, [id]: !expanded.outer[id] },
    })
  }

  const toggleInner = (id: InnerGroupId) => {
    persistExpanded({
      ...expanded,
      inner: { ...expanded.inner, [id]: !expanded.inner[id] },
    })
  }

  const outerSpan = (id: OuterGroupId) => {
    if (!expanded.outer[id]) return 1
    if (id === 'score_presets') {
      return (expanded.inner.score ? 3 : 1) + (expanded.inner.presets ? 4 : 1)
    }
    return (expanded.inner.audio ? 5 : 1) + (expanded.inner.midi ? 3 : 1)
  }

  const innerSpan = (id: InnerGroupId) =>
    expanded.inner[id] ? cols(id).length : 1

  const frozen = variant === 'concert' ? 4 : 3
  const extra = variant === 'concert' && onRemove ? 1 : 0
  const concert = variant === 'concert'
  const lefts = frozenOffsets(concert)

  return (
    <div className="relative isolate max-h-[70vh] overflow-auto rounded-md border border-border">
      <table className="min-w-max border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 z-30">
          <tr>
            <th
              colSpan={frozen}
              className="sticky left-0 z-40 border border-border bg-sky-100 dark:bg-sky-950"
              style={{ minWidth: lefts.total, width: lefts.total }}
            />
            {OUTER_GROUPS.map((group) => (
              <th
                key={group.id}
                colSpan={outerSpan(group.id)}
                className={cn(
                  'border border-border px-1 py-0.5 font-semibold',
                  group.id === 'score_presets'
                    ? 'bg-violet-200 dark:bg-violet-900/80'
                    : 'bg-amber-200 dark:bg-amber-900/70'
                )}
              >
                <OutlineButton
                  expanded={expanded.outer[group.id]}
                  label={group.label}
                  onClick={() => toggleOuter(group.id)}
                />
              </th>
            ))}
            {extra ? <th rowSpan={3} className="w-8 border border-border bg-muted" /> : null}
          </tr>
          <tr>
            {concert ? (
              <FrozenHead rowSpan={2} left={lefts.grip!} width={FROZEN_W.grip} />
            ) : null}
            <FrozenHead rowSpan={2} left={lefts.num} width={FROZEN_W.num}>
              #
            </FrozenHead>
            <FrozenHead rowSpan={2} left={lefts.bpm} width={FROZEN_W.bpm}>
              BPM
            </FrozenHead>
            <FrozenHead
              rowSpan={2}
              left={lefts.title}
              width={FROZEN_W.title}
              last
            >
              Canción
            </FrozenHead>
            {expanded.outer.score_presets ? (
              <>
                <GroupHead
                  label="Score"
                  expanded={expanded.inner.score}
                  span={innerSpan('score')}
                  onClick={() => toggleInner('score')}
                  tone="violet"
                />
                <GroupHead
                  label="Presets"
                  expanded={expanded.inner.presets}
                  span={innerSpan('presets')}
                  onClick={() => toggleInner('presets')}
                  tone="violet"
                />
              </>
            ) : (
              <th rowSpan={2} className="border border-border bg-violet-100 dark:bg-violet-950/50" />
            )}
            {expanded.outer.playback ? (
              <>
                <GroupHead
                  label="Ableton"
                  expanded={expanded.inner.audio}
                  span={innerSpan('audio')}
                  onClick={() => toggleInner('audio')}
                  tone="amber"
                />
                <GroupHead
                  label="MIDI"
                  expanded={expanded.inner.midi}
                  span={innerSpan('midi')}
                  onClick={() => toggleInner('midi')}
                  tone="amber"
                />
              </>
            ) : (
              <th rowSpan={2} className="border border-border bg-amber-100 dark:bg-amber-950/50" />
            )}
          </tr>
          <tr>
            {expanded.outer.score_presets &&
              (expanded.inner.score
                ? cols('score').map((col) => <ColHead key={col.key} col={col} tone="violet" />)
                : <StubHead tone="violet" />)}
            {expanded.outer.score_presets &&
              (expanded.inner.presets
                ? cols('presets').map((col) => <ColHead key={col.key} col={col} tone="violet" />)
                : <StubHead tone="violet" />)}
            {expanded.outer.playback &&
              (expanded.inner.audio
                ? cols('audio').map((col) => <ColHead key={col.key} col={col} tone="amber" />)
                : <StubHead tone="amber" />)}
            {expanded.outer.playback &&
              (expanded.inner.midi
                ? cols('midi').map((col) => <ColHead key={col.key} col={col} tone="amber" />)
                : <StubHead tone="amber" />)}
          </tr>
        </thead>
        <tbody>
          {songs.length === 0 ? (
            <tr>
              <td
                colSpan={frozen + 2 + extra}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                Плейлист пуст — добавьте песни
              </td>
            </tr>
          ) : (
            songs.map((song, index) => (
              <tr
                key={song.id}
                className={cn(dragIndex === index && 'opacity-50')}
                onDragOver={(event) => {
                  if (onReorder) event.preventDefault()
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (dragIndex == null || !onReorder) return
                  onReorder(dragIndex, index)
                  setDragIndex(null)
                }}
              >
                {concert ? (
                  <td
                    className="sticky left-0 z-20 border border-border bg-background text-muted-foreground"
                    style={frozenBox(lefts.grip!, FROZEN_W.grip)}
                    draggable={Boolean(onReorder)}
                    onDragStart={() => setDragIndex(index)}
                    onDragEnd={() => setDragIndex(null)}
                  >
                    {onReorder ? (
                      <GripVertical className="mx-auto h-3.5 w-3.5 cursor-grab" />
                    ) : null}
                  </td>
                ) : null}
                <td
                  className="sticky z-20 border border-border bg-sky-50 px-1.5 text-center text-muted-foreground dark:bg-sky-950"
                  style={frozenBox(lefts.num, FROZEN_W.num)}
                >
                  {index + 1}
                </td>
                <TextCell
                  sticky
                  stickyLeft={lefts.bpm}
                  stickyWidth={FROZEN_W.bpm}
                  value={song.bpm ?? ''}
                  editing={editing?.songId === song.id && editing.field === 'bpm'}
                  draft={draft}
                  placeholder="—"
                  className="font-medium"
                  onStart={() => {
                    setEditing({ songId: song.id, field: 'bpm' })
                    setDraft(song.bpm ?? '')
                  }}
                  onDraft={setDraft}
                  onCommit={async () => {
                    const next = draft.trim() || null
                    setEditing(null)
                    if (next !== (song.bpm ?? null)) {
                      await onPatchSong(song.id, { bpm: next })
                    }
                  }}
                />
                <td
                  className="sticky z-20 overflow-hidden border border-border bg-sky-50 px-2 py-1 font-medium shadow-[4px_0_8px_-2px_rgba(0,0,0,0.18)] dark:bg-sky-950"
                  style={frozenBox(lefts.title, FROZEN_W.title)}
                >
                  {songHref ? (
                    <Link href={songHref(song)} className="block truncate hover:underline" title={song.title}>
                      {song.title}
                    </Link>
                  ) : (
                    <span className="block truncate" title={song.title}>
                      {song.title}
                    </span>
                  )}
                </td>
                {renderTechCells({
                  song,
                  expanded,
                  editing,
                  draft,
                  setDraft,
                  setEditing,
                  onPatchSong,
                })}
                {variant === 'concert' && onRemove ? (
                  <td className="border border-border px-0.5 text-center">
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onRemove(song.id)}
                      aria-label="Убрать из плейлиста"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function FrozenHead({
  children,
  className,
  rowSpan,
  left,
  width,
  last,
}: {
  children?: ReactNode
  className?: string
  rowSpan?: number
  left: number
  width: number
  last?: boolean
}) {
  return (
    <th
      rowSpan={rowSpan}
      style={frozenBox(left, width)}
      className={cn(
        'sticky z-40 border border-border bg-sky-100 px-1.5 py-1 text-left font-semibold dark:bg-sky-950',
        last && 'shadow-[4px_0_8px_-2px_rgba(0,0,0,0.18)]',
        className
      )}
    >
      {children}
    </th>
  )
}

function GroupHead({
  label,
  expanded,
  span,
  onClick,
  tone,
}: {
  label: string
  expanded: boolean
  span: number
  onClick: () => void
  tone: 'violet' | 'amber'
}) {
  return (
    <th
      colSpan={span}
      className={cn(
        'border border-border px-1 py-0.5 font-semibold',
        tone === 'violet'
          ? 'bg-violet-100 dark:bg-violet-950/50'
          : 'bg-amber-100 dark:bg-amber-950/50'
      )}
    >
      <OutlineButton expanded={expanded} label={label} onClick={onClick} />
    </th>
  )
}

function ColHead({ col, tone }: { col: TechColumn; tone: 'violet' | 'amber' }) {
  return (
    <th
      className={cn(
        'whitespace-nowrap border border-border px-1 py-1 font-medium',
        tone === 'violet'
          ? 'bg-violet-50 dark:bg-violet-950/30'
          : 'bg-amber-50 dark:bg-amber-950/30',
        col.type === 'text' ||
          col.type === 'pdf_file' ||
          col.type === 'media_file' ||
          col.type === 'midi_file'
          ? 'min-w-[5.5rem]'
          : 'min-w-[3.5rem]'
      )}
    >
      {col.label}
    </th>
  )
}

function StubHead({ tone }: { tone: 'violet' | 'amber' }) {
  return (
    <th
      className={cn(
        'w-8 border border-border',
        tone === 'violet'
          ? 'bg-violet-50 dark:bg-violet-950/30'
          : 'bg-amber-50 dark:bg-amber-950/30'
      )}
    />
  )
}

function OutlineButton({
  expanded,
  label,
  onClick,
}: {
  expanded: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded px-1 hover:bg-black/5 dark:hover:bg-white/10"
      title={expanded ? 'Свернуть группу' : 'Развернуть группу'}
    >
      <span className="inline-flex size-3.5 items-center justify-center border border-foreground/40 bg-background text-[9px] leading-none">
        {expanded ? <Minus className="size-2.5" /> : <Plus className="size-2.5" />}
      </span>
      <span>{label}</span>
    </button>
  )
}

function TextCell({
  value,
  editing,
  draft,
  onStart,
  onDraft,
  onCommit,
  placeholder,
  className,
  sticky,
  stickyLeft,
  stickyWidth,
}: {
  value: string
  editing: boolean
  draft: string
  onStart: () => void
  onDraft: (value: string) => void
  onCommit: () => void
  placeholder?: string
  className?: string
  sticky?: boolean
  stickyLeft?: number
  stickyWidth?: number
}) {
  const stickyStyle =
    sticky && stickyLeft != null && stickyWidth != null
      ? frozenBox(stickyLeft, stickyWidth)
      : undefined

  if (editing) {
    return (
      <td
        className={cn(
          'border border-border p-0',
          sticky && 'sticky z-20 bg-background',
          className
        )}
        style={stickyStyle}
      >
        <input
          autoFocus
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          onBlur={onCommit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') {
              onDraft(value)
              event.currentTarget.blur()
            }
          }}
          className="h-7 w-full bg-background px-1.5 outline-none ring-1 ring-primary"
        />
      </td>
    )
  }

  return (
    <td
      className={cn(
        'cursor-text border border-border px-1.5 py-1',
        sticky && 'sticky z-20 bg-sky-50 dark:bg-sky-950',
        className
      )}
      style={stickyStyle}
      onClick={onStart}
    >
      {value || <span className="text-muted-foreground">{placeholder ?? ''}</span>}
    </td>
  )
}

function renderTechCells({
  song,
  expanded,
  editing,
  draft,
  setDraft,
  setEditing,
  onPatchSong,
}: {
  song: SetlistSong
  expanded: ExpandedState
  editing: { songId: string; field: 'bpm' | TechKey } | null
  draft: string
  setDraft: (value: string) => void
  setEditing: (value: { songId: string; field: 'bpm' | TechKey } | null) => void
  onPatchSong: SetlistTableProps['onPatchSong']
}) {
  const patchKey = async (key: TechKey, value: TechCellValue) => {
    await onPatchSong(song.id, {
      tech_meta: { ...song.tech_meta, [key]: value },
    })
  }

  const nodes: ReactNode[] = []

  const pushGroup = (inner: InnerGroupId | null, outer: OuterGroupId, keys: TechKey[]) => {
    if (!expanded.outer[outer]) return
    if (inner && !expanded.inner[inner]) {
      nodes.push(
        <td
          key={`${outer}-${inner}-stub`}
          className={cn(
            'w-8 border border-border',
            outer === 'score_presets'
              ? 'bg-violet-50/40 dark:bg-violet-950/20'
              : 'bg-amber-50/40 dark:bg-amber-950/20'
          )}
        />
      )
      return
    }
    for (const key of keys) {
      const col = TECH_COLUMNS.find((item) => item.key === key)!
      const value = song.tech_meta[key] ?? ''
      if (col.type === 'pdf_file' || col.type === 'media_file' || col.type === 'midi_file') {
        nodes.push(
          <TechFileCell
            key={key}
            songId={song.id}
            fieldKey={key}
            value={value}
            kind={col.type === 'pdf_file' ? 'pdf' : col.type === 'midi_file' ? 'midi' : 'media'}
            onSave={(next) => patchKey(key, next)}
          />
        )
      } else {
        const text = asTextValue(value)
        nodes.push(
          <TextCell
            key={key}
            value={text}
            editing={editing?.songId === song.id && editing.field === key}
            draft={draft}
            className="max-w-[12rem] min-w-[7rem] truncate"
            onStart={() => {
              setEditing({ songId: song.id, field: key })
              setDraft(text)
            }}
            onDraft={setDraft}
            onCommit={async () => {
              const next = draft.trim()
              setEditing(null)
              if (next !== text) await patchKey(key, next)
            }}
          />
        )
      }
    }
  }

  if (!expanded.outer.score_presets) {
    nodes.push(
      <td
        key="score_presets-stub"
        className="w-8 border border-border bg-violet-50/40 dark:bg-violet-950/20"
      />
    )
  } else {
    pushGroup('score', 'score_presets', ['score_synth', 'score_bvox', 'score_bass'])
    pushGroup('presets', 'score_presets', [
      'preset_qc',
      'preset_gp200',
      'preset_vl_rack',
      'preset_xv5080',
    ])
  }

  if (!expanded.outer.playback) {
    nodes.push(
      <td
        key="playback-stub"
        className="w-8 border border-border bg-amber-50/40 dark:bg-amber-950/20"
      />
    )
  } else {
    pushGroup('audio', 'playback', [
      'audio_click',
      'audio_guide',
      'audio_synth',
      'audio_bvox1',
      'audio_bvox2',
    ])
    pushGroup('midi', 'playback', ['midi_qc', 'midi_gp200', 'midi_vlive'])
  }

  return nodes
}
