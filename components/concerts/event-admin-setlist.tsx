'use client'

import { useCallback, useEffect, useState } from 'react'
import { ConcertSetlistEditor } from '@/components/concerts/concert-setlist-editor'
import type { SetlistSong } from '@/lib/song-tech'
import { toast } from 'sonner'

export function EventAdminSetlist({ eventId }: { eventId: string }) {
  const [allSongs, setAllSongs] = useState<SetlistSong[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/events/${eventId}`)
    if (!response.ok) {
      setLoading(false)
      return
    }
    const data = await response.json()
    setAllSongs(data.songs ?? [])
    setSelectedIds(data.songIds ?? (data.setlist ?? []).map((s: SetlistSong) => s.id))
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  async function persistIds(ids: string[]) {
    setSelectedIds(ids)
    const response = await fetch(`/api/admin/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songIds: ids }),
    })
    if (!response.ok) {
      toast.error('Не удалось сохранить плейлист')
      load()
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Загрузка плейлиста…</p>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-6">
      <ConcertSetlistEditor
        allSongs={allSongs}
        selectedIds={selectedIds}
        onSelectedIdsChange={persistIds}
        onCatalogChange={setAllSongs}
      />
    </section>
  )
}
