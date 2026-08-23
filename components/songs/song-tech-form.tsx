'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { TechFileControl } from '@/components/concerts/tech-file-cell'
import { cn } from '@/lib/utils'
import {
  INNER_GROUPS,
  TECH_COLUMNS,
  asTextValue,
  type InnerGroupId,
  type TechCellValue,
  type TechColumn,
  type TechMeta,
} from '@/lib/song-tech'

function fileKind(col: TechColumn): 'pdf' | 'media' | 'midi' {
  if (col.type === 'pdf_file') return 'pdf'
  if (col.type === 'midi_file') return 'midi'
  return 'media'
}

export function SongTechForm({
  songId,
  bpm,
  techMeta,
  onPatch,
}: {
  songId: string
  bpm: string | null
  techMeta: TechMeta
  onPatch: (payload: { bpm?: string | null; tech_meta?: TechMeta }) => Promise<void>
}) {
  async function patchKey(key: TechColumn['key'], value: TechCellValue) {
    await onPatch({ tech_meta: { ...techMeta, [key]: value } })
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <span className="font-medium">BPM</span>
        <BpmField value={bpm ?? ''} onCommit={(next) => onPatch({ bpm: next || null })} />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <Section id="score" className="bg-violet-50/50 dark:bg-violet-950/25">
          <div className="grid grid-cols-3 gap-2">
            {cols('score').map((col) => (
              <FileField
                key={col.key}
                songId={songId}
                col={col}
                value={techMeta[col.key]}
                onSave={(next) => patchKey(col.key, next)}
              />
            ))}
          </div>
        </Section>

        <Section id="presets" className="bg-violet-50/50 dark:bg-violet-950/25">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {cols('presets').map((col) => (
                <tr key={col.key}>
                  <th className="w-[1%] whitespace-nowrap py-1 pr-3 text-left font-normal text-muted-foreground">
                    {col.label}
                  </th>
                  <td className="py-1">
                    <TextField
                      value={asTextValue(techMeta[col.key])}
                      onCommit={(next) => patchKey(col.key, next)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section id="audio" className="md:col-span-2 bg-amber-50/50 dark:bg-amber-950/25">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {cols('audio').map((col) => (
              <FileField
                key={col.key}
                songId={songId}
                col={col}
                value={techMeta[col.key]}
                onSave={(next) => patchKey(col.key, next)}
              />
            ))}
          </div>
        </Section>

        <Section id="midi" className="md:col-span-2 bg-amber-50/50 dark:bg-amber-950/25">
          <div className="grid grid-cols-3 gap-2">
            {cols('midi').map((col) => (
              <FileField
                key={col.key}
                songId={songId}
                col={col}
                value={techMeta[col.key]}
                onSave={(next) => patchKey(col.key, next)}
              />
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}

function cols(inner: InnerGroupId) {
  return TECH_COLUMNS.filter((col) => col.inner === inner)
}

function Section({
  id,
  className,
  children,
}: {
  id: InnerGroupId
  className?: string
  children: ReactNode
}) {
  const group = INNER_GROUPS.find((item) => item.id === id)
  return (
    <section className={cn('rounded-lg border border-border p-3', className)}>
      <h3 className="mb-2 text-sm font-semibold">{group?.label}</h3>
      {children}
    </section>
  )
}

function FileField({
  songId,
  col,
  value,
  onSave,
}: {
  songId: string
  col: TechColumn
  value: TechCellValue
  onSave: (next: TechCellValue) => Promise<void>
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 truncate text-xs font-medium text-muted-foreground">{col.label}</div>
      <TechFileControl
        songId={songId}
        fieldKey={col.key}
        value={value}
        kind={fileKind(col)}
        onSave={onSave}
        className="h-8 w-full min-w-0 rounded-md border border-border"
      />
    </div>
  )
}

function TextField({
  value,
  onCommit,
}: {
  value: string
  onCommit: (next: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = draft.trim()
        if (next !== value) onCommit(next)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      className="h-8"
    />
  )
}

function BpmField({
  value,
  onCommit,
}: {
  value: string
  onCommit: (next: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = draft.trim()
        if (next !== value) onCommit(next)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      placeholder="115/120"
      className="h-8 w-28"
    />
  )
}
