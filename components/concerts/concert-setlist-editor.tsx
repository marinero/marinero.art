'use client'

import { useMemo, useState } from 'react'
import { ListMusic, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SetlistTable } from '@/components/concerts/setlist-table'
import type { SetlistSong, TechMeta } from '@/lib/song-tech'
import { toast } from 'sonner'

type ConcertSetlistEditorProps = {
  allSongs: SetlistSong[]
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
  onCatalogChange?: (songs: SetlistSong[]) => void
}

export function ConcertSetlistEditor({
  allSongs,
  selectedIds,
  onSelectedIdsChange,
  onCatalogChange,
}: ConcertSetlistEditorProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const byId = useMemo(() => {
    const map = new Map(allSongs.map((song) => [song.id, song]))
    return map
  }, [allSongs])

  const selectedSongs = selectedIds
    .map((id) => byId.get(id))
    .filter((song): song is SetlistSong => Boolean(song))

  const available = allSongs.filter((song) => {
    if (selectedIds.includes(song.id)) return false
    if (!query.trim()) return true
    return song.title.toLowerCase().includes(query.trim().toLowerCase())
  })

  const patchCatalog = (id: string, patch: Partial<SetlistSong>) => {
    onCatalogChange?.(allSongs.map((song) => (song.id === id ? { ...song, ...patch } : song)))
  }

  async function patchSong(
    songId: string,
    payload: { bpm?: string | null; tech_meta?: TechMeta }
  ) {
    const response = await fetch(`/api/admin/songs/${songId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      toast.error('Не удалось сохранить ячейку')
      return
    }
    const current = byId.get(songId)
    if (!current) return
    patchCatalog(songId, {
      bpm: payload.bpm !== undefined ? payload.bpm : current.bpm,
      tech_meta: payload.tech_meta ?? current.tech_meta,
    })
  }

  function addSong(id: string) {
    onSelectedIdsChange([...selectedIds, id])
    setQuery('')
    setOpen(false)
  }

  function reorder(from: number, to: number) {
    if (from === to) return
    const next = [...selectedIds]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onSelectedIdsChange(next)
  }

  return (
    <div className="space-y-3 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <ListMusic className="h-4 w-4" />
            Плейлист
          </label>
          <p className="text-xs text-muted-foreground">
            Только для админов. Метаданные хранятся в песне и общие для всех концертов.
          </p>
        </div>
        <div className="relative">
          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setOpen((v) => !v)}>
            <Plus className="h-4 w-4" />
            Добавить песню
          </Button>
          {open ? (
            <div className="absolute right-0 z-40 mt-1 w-72 rounded-md border bg-popover p-2 shadow-md">
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск песни"
                  className="h-8 pl-7"
                  autoFocus
                />
              </div>
              <div className="max-h-56 overflow-y-auto">
                {available.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground">Нет доступных песен</p>
                ) : (
                  available.map((song) => (
                    <button
                      key={song.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() => addSong(song.id)}
                    >
                      <span className="truncate">{song.title}</span>
                      {song.bpm ? (
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">{song.bpm}</span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <SetlistTable
        variant="concert"
        songs={selectedSongs}
        songHref={(song) => `/admin/songs/${song.slug}`}
        onPatchSong={patchSong}
        onReorder={reorder}
        onRemove={(id) => onSelectedIdsChange(selectedIds.filter((item) => item !== id))}
      />
    </div>
  )
}
