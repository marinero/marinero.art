'use client'

import { useCallback, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChordEditor } from '@/components/songs/chord-editor'
import { ChordLibrary, type ChordLibraryRef } from '@/components/songs/chord-library'
import { SongViewer, type SongViewerEditor } from '@/app/songs/[slug]/song-viewer'
import { SongTechForm } from '@/components/songs/song-tech-form'
import { SongListenEditor } from '@/components/songs/song-listen-editor'
import { normalizeTechMeta, type TechMeta } from '@/lib/song-tech'
import { toast } from 'sonner'
import type { Chord, SongLink, SongText, SongTextChord } from '@/lib/types'

export function SongAdminWorkspace({
  song: initialSong,
  chords: initialChords,
  links,
}: {
  song: SongText
  chords: SongTextChord[]
  links: SongLink[]
}) {
  const [song, setSong] = useState(initialSong)
  const [title, setTitle] = useState(initialSong.title)
  const [textContent, setTextContent] = useState(initialSong.text_content || '')
  const [bpm, setBpm] = useState(initialSong.bpm ?? '')
  const [techMeta, setTechMeta] = useState<TechMeta>(normalizeTechMeta(initialSong.tech_meta))
  const [chords, setChords] = useState(initialChords)
  const [saving, setSaving] = useState(false)
  const [draggedChord, setDraggedChord] = useState<Chord | null>(null)
  const [hoveredPosition, setHoveredPosition] = useState<number | null>(null)
  const chordLibraryRef = useRef<ChordLibraryRef>(null)
  const [chordEditorOpen, setChordEditorOpen] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/songs/${song.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          text_content: textContent,
          bpm: bpm.trim() || null,
          tech_meta: techMeta,
          chords: chords.map((c) => ({
            chord_id: c.chord_id,
            position: c.position,
          })),
        }),
      })
      if (!response.ok) throw new Error('Failed to save')
      setSong((current) => ({
        ...current,
        title: title.trim(),
        text_content: textContent,
        bpm: bpm.trim() || null,
      }))
      toast.success('Сохранено')
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleDropOnPosition = useCallback(
    (position: number) => {
      if (!draggedChord) return
      const existing = chords.find((c) => c.position === position)
      if (existing) {
        setChords((prev) =>
          prev.map((c) =>
            c.position === position
              ? { ...c, chord_id: draggedChord.id, chord: draggedChord }
              : c
          )
        )
      } else {
        setChords((prev) =>
          [
            ...prev,
            {
              id: `temp-${Date.now()}`,
              song_text_id: song.id,
              chord_id: draggedChord.id,
              position,
              created_at: new Date().toISOString(),
              chord: draggedChord,
            },
          ].sort((a, b) => a.position - b.position)
        )
      }
      setDraggedChord(null)
      setHoveredPosition(null)
    },
    [draggedChord, chords, song.id]
  )

  const handleTextChange = (
    newText: string,
    cursorPosition?: number,
    changeType?: 'insert' | 'delete',
    changeLength?: number
  ) => {
    const oldText = textContent
    setTextContent(newText)
    if (cursorPosition !== undefined && changeType && changeLength !== undefined) {
      setChords((prev) => {
        if (changeType === 'insert') {
          return prev.map((c) => ({
            ...c,
            position: c.position >= cursorPosition ? c.position + changeLength : c.position,
          }))
        }
        const deleteEnd = cursorPosition + changeLength
        return prev
          .filter((c) => c.position < cursorPosition || c.position >= deleteEnd)
          .map((c) => ({
            ...c,
            position: c.position >= deleteEnd ? c.position - changeLength : c.position,
          }))
      })
    } else if (newText.length < oldText.length) {
      setChords((prev) => prev.filter((c) => c.position < newText.length))
    }
  }

  const editor: SongViewerEditor = {
    title,
    onTitleChange: setTitle,
    onSave: handleSave,
    saving,
    draggedChord,
    hoveredPosition,
    onHoverPosition: setHoveredPosition,
    onDrop: handleDropOnPosition,
    onRemoveChord: (position) => setChords((prev) => prev.filter((c) => c.position !== position)),
    onTextChange: handleTextChange,
    tools: (
      <>
        <Card className="h-[400px]">
          <CardHeader className="pb-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Библиотека аккордов</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Кликните на аккорд, затем на букву в тексте
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1"
                onClick={() => setChordEditorOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Новый аккорд
              </Button>
            </div>
          </CardHeader>
          <ChordLibrary
            ref={chordLibraryRef}
            className="h-[calc(100%-80px)]"
            onSelectChord={setDraggedChord}
          />
        </Card>
        {draggedChord ? (
          <p className="text-sm text-muted-foreground">
            Выбран аккорд {draggedChord.name} — кликните по тексту, чтобы поставить.
            {' '}
            <button type="button" className="underline" onClick={() => setDraggedChord(null)}>
              Отмена
            </button>
          </p>
        ) : null}
        <Dialog open={chordEditorOpen} onOpenChange={setChordEditorOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Генератор аккордов</DialogTitle>
              <DialogDescription>
                Соберите аппликатуру на грифе и сохраните аккорд в библиотеку.
              </DialogDescription>
            </DialogHeader>
            <ChordEditor
              onSave={(newChord) => {
                chordLibraryRef.current?.refresh()
                toast.success(`Аккорд ${newChord.name} сохранен в библиотеку`)
                setChordEditorOpen(false)
              }}
              onCancel={() => setChordEditorOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </>
    ),
  }

  return (
    <SongViewer
      song={{ ...song, title, text_content: textContent, bpm: bpm.trim() || null }}
      chords={chords}
      editor={editor}
    >
      <div className="space-y-4">
        <SongListenEditor
          songId={song.id}
          title={title}
          audioUrl={song.audio_url}
          audioFilename={song.audio_filename}
          links={links}
        />
        <SongTechForm
          songId={song.id}
          bpm={bpm.trim() || null}
          techMeta={techMeta}
          onPatch={async (payload) => {
            const nextBpm = payload.bpm !== undefined ? payload.bpm : bpm.trim() || null
            const nextMeta = payload.tech_meta ?? techMeta
            const res = await fetch(`/api/admin/songs/${song.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bpm: nextBpm, tech_meta: nextMeta }),
            })
            if (!res.ok) {
              toast.error('Не удалось сохранить метаданные')
              return
            }
            if (payload.bpm !== undefined) setBpm(payload.bpm ?? '')
            if (payload.tech_meta) setTechMeta(payload.tech_meta)
          }}
        />
      </div>
    </SongViewer>
  )
}
