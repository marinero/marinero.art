'use client'

import { useState } from 'react'
import { SongTechForm } from '@/components/songs/song-tech-form'
import type { SetlistSong, TechMeta } from '@/lib/song-tech'
import { toast } from 'sonner'

export function SongAdminTech({ song }: { song: SetlistSong }) {
  const [row, setRow] = useState(song)

  async function onPatch(payload: { bpm?: string | null; tech_meta?: TechMeta }) {
    const response = await fetch(`/api/admin/songs/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      toast.error('Не удалось сохранить метаданные')
      return
    }
    setRow((current) => ({
      ...current,
      bpm: payload.bpm !== undefined ? payload.bpm : current.bpm,
      tech_meta: payload.tech_meta ?? current.tech_meta,
    }))
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-6">
      <h2 className="text-lg font-semibold">Техническая метаинформация</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Только для админов. Те же поля, что в плейлисте концерта.
      </p>
      <SongTechForm songId={row.id} bpm={row.bpm} techMeta={row.tech_meta} onPatch={onPatch} />
    </section>
  )
}
