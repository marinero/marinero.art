'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChordDiagram } from '@/components/songs/chord-diagram'
import { ChordLibrary, type ChordLibraryRef } from '@/components/songs/chord-library'
import { ChordEditor } from '@/components/songs/chord-editor'
import { SongDocumentsManager } from './song-documents-manager'
import { useGuitarAudio } from '@/hooks/use-guitar-audio'
import { ArrowLeft, Save, Eye, Music, Trash2, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { SongText, Chord, SongTextChord } from '@/lib/types'

export default function SongEditorPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  
  const [song, setSong] = useState<SongText | null>(null)
  const [title, setTitle] = useState('')
  const [textContent, setTextContent] = useState('')
  const [bpm, setBpm] = useState('')
  const [chords, setChords] = useState<SongTextChord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draggedChord, setDraggedChord] = useState<Chord | null>(null)
  const [hoveredPosition, setHoveredPosition] = useState<number | null>(null)
  
  const chordLibraryRef = useRef<ChordLibraryRef>(null)
  const { playArpeggio, isPlaying } = useGuitarAudio()
  useEffect(() => {
    fetchSong()
  }, [slug])

  async function fetchSong() {
    setLoading(true)

    const response = await fetch(`/api/admin/songs/${encodeURIComponent(slug)}`)
    if (!response.ok) {
      toast.error('Песня не найдена')
      router.push('/admin/songs')
      return
    }

    const data = await response.json()
    const songData = data.song

    setSong(songData)
    setTitle(songData.title)
    setTextContent(songData.text_content || '')
    setBpm(songData.bpm?.toString() || '')
    setChords((data.chords || []) as SongTextChord[])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!song) return
    
    setSaving(true)
    
    try {
      const response = await fetch(`/api/admin/songs/${song.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          text_content: textContent,
          bpm: bpm ? parseInt(bpm) : null,
          chords: chords.map((c) => ({
            chord_id: c.chord_id,
            position: c.position,
          })),
        }),
      })

      if (!response.ok) throw new Error('Failed to save')

      toast.success('Сохранено')
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleDragStart = (chord: Chord) => {
    setDraggedChord(chord)
  }

  const handleDragEnd = () => {
    setDraggedChord(null)
    setHoveredPosition(null)
  }

  const handleDropOnPosition = useCallback((position: number) => {
    if (!draggedChord || !song) return

    // Check if chord already exists at this position
    const existing = chords.find(c => c.position === position)
    
    if (existing) {
      // Replace existing chord
      setChords(prev => prev.map(c => 
        c.position === position 
          ? { ...c, chord_id: draggedChord.id, chord: draggedChord }
          : c
      ))
    } else {
      // Add new chord
      const newChord: SongTextChord = {
        id: `temp-${Date.now()}`,
        song_text_id: song.id,
        chord_id: draggedChord.id,
        position,
        created_at: new Date().toISOString(),
        chord: draggedChord
      }
      setChords(prev => [...prev, newChord].sort((a, b) => a.position - b.position))
    }

    setDraggedChord(null)
    setHoveredPosition(null)
  }, [draggedChord, song, chords])

  const removeChordAtPosition = (position: number) => {
    setChords(prev => prev.filter(c => c.position !== position))
  }

  const handleTextChange = (newText: string, cursorPosition?: number, changeType?: 'insert' | 'delete', changeLength?: number) => {
    const oldText = textContent
    setTextContent(newText)

    // If we have cursor info, use precise repositioning
    if (cursorPosition !== undefined && changeType && changeLength !== undefined) {
      setChords(prev => {
        if (changeType === 'insert') {
          // Text was inserted - shift all chords at or after cursor position
          return prev.map(c => ({
            ...c,
            position: c.position >= cursorPosition ? c.position + changeLength : c.position
          }))
        } else {
          // Text was deleted
          const deleteStart = cursorPosition
          const deleteEnd = cursorPosition + changeLength
          
          return prev
            // Remove chords that were in the deleted range
            .filter(c => c.position < deleteStart || c.position >= deleteEnd)
            // Shift chords that were after the deleted range
            .map(c => ({
              ...c,
              position: c.position >= deleteEnd ? c.position - changeLength : c.position
            }))
        }
      })
    } else {
      // Fallback: just remove out-of-bounds chords
      if (newText.length < oldText.length) {
        setChords(prev => prev.filter(c => c.position < newText.length))
      }
    }
  }

  const playChordAtPosition = (position: number) => {
    const chordData = chords.find(c => c.position === position)?.chord
    if (chordData) {
      playArpeggio(chordData.fret_positions as number[])
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>
  }

  if (!song) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/songs">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-bold h-auto py-1 px-2 border-transparent hover:border-input focus:border-input"
              placeholder="Название песни"
            />
            <p className="text-muted-foreground text-sm mt-1">Редактор текста и аккордов</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/songs/${song.slug}`} target="_blank">
            <Button variant="outline" className="gap-2">
              <Eye className="h-4 w-4" />
              Просмотр
            </Button>
          </Link>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Text Editor - Left Column (1/3) */}
        <div className="lg:col-span-1 space-y-4">
          {/* BPM */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">BPM:</label>
            <Input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              className="w-24"
              min={40}
              max={300}
              placeholder="120"
            />
          </div>

          {/* Text with chords visualization */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Music className="h-5 w-5" />
                Текст песни
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Instructions */}
              <p className="text-sm text-muted-foreground">
                Введите текст песни и перетащите аккорды из библиотеки справа на нужные позиции. 
                Кликните на аккорд, чтобы воспроизвести или удалить его.
              </p>

              {/* Editable text with chords */}
              <TextWithChords
                text={textContent}
                chords={chords}
                draggedChord={draggedChord}
                hoveredPosition={hoveredPosition}
                onHoverPosition={setHoveredPosition}
                onDrop={handleDropOnPosition}
                onRemoveChord={removeChordAtPosition}
                onPlayChord={playChordAtPosition}
                onTextChange={handleTextChange}
                isPlaying={isPlaying}
              />
            </CardContent>
          </Card>

          {/* Documents: sheet music & tabs */}
          <SongDocumentsManager songId={song.id} />
        </div>

        {/* Right Column - Chord Editor & Library (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Chord Editor with Fretboard */}
          <ChordEditor 
            onSave={(newChord) => {
              // Refresh the chord library to show the new chord
              chordLibraryRef.current?.refresh()
              toast.success(`Аккорд ${newChord.name} сохранен в библиотеку`)
            }}
          />

          <Card className="h-[400px]">
            <CardHeader className="pb-0">
              <CardTitle className="text-lg">Библиотека аккордов</CardTitle>
              <p className="text-sm text-muted-foreground">
                Кликните на аккорд, затем кликните на букву в тексте слева
              </p>
            </CardHeader>
            <ChordLibrary
              ref={chordLibraryRef}
              className="h-[calc(100%-80px)]"
              onSelectChord={(chord) => setDraggedChord(chord)}
            />
          </Card>
          
          {/* Dragging indicator */}
          {draggedChord && (
            <div className="fixed bottom-4 right-4 z-50">
              <Card className="shadow-lg border-primary bg-primary/10">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <ChordDiagram
                      name={draggedChord.name}
                      fretPositions={draggedChord.fret_positions as number[]}
                      size="sm"
                    />
                    <div className="text-sm">
                      <p className="font-medium">Аккорд выбран</p>
                      <p className="text-muted-foreground">Кликните на букву в тексте</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleDragEnd}
                    >
                      Отмена
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Component to render text with chords above
interface TextWithChordsProps {
  text: string
  chords: SongTextChord[]
  draggedChord: Chord | null
  hoveredPosition: number | null
  onHoverPosition: (pos: number | null) => void
  onDrop: (position: number) => void
  onRemoveChord: (position: number) => void
  onPlayChord: (position: number) => void
  onTextChange: (newText: string, cursorPosition?: number, changeType?: 'insert' | 'delete', changeLength?: number) => void
  isPlaying: boolean
}

function TextWithChords({
  text,
  chords,
  draggedChord,
  hoveredPosition,
  onHoverPosition,
  onDrop,
  onRemoveChord,
  onPlayChord,
  onTextChange,
  isPlaying
}: TextWithChordsProps) {
  const [isEditMode, setIsEditMode] = useState(!text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevTextRef = useRef(text)

  // Focus textarea when switching to edit mode
  useEffect(() => {
    if (isEditMode && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditMode])

  // Track text changes with cursor position
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    const oldText = prevTextRef.current
    const cursorPos = e.target.selectionStart
    
    const lengthDiff = newText.length - oldText.length
    
    if (lengthDiff > 0) {
      // Text was inserted
      const insertPos = cursorPos - lengthDiff
      onTextChange(newText, insertPos, 'insert', lengthDiff)
    } else if (lengthDiff < 0) {
      // Text was deleted
      const deleteLength = Math.abs(lengthDiff)
      onTextChange(newText, cursorPos, 'delete', deleteLength)
    } else {
      // Same length - replacement
      onTextChange(newText)
    }
    
    prevTextRef.current = newText
  }

  // Keep prevTextRef in sync when text prop changes externally
  useEffect(() => {
    prevTextRef.current = text
  }, [text])

  // Edit mode - simple textarea
  if (isEditMode) {
    return (
      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInputChange}
          onBlur={() => text && setIsEditMode(false)}
          className="w-full min-h-[400px] outline-none border rounded-lg p-4 bg-background tracking-wide leading-relaxed whitespace-pre-wrap resize-y text-sm font-sans"
          placeholder="Введите текст песни..."
        />
        {text && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsEditMode(false)}
          >
            Готово - разместить аккорды
          </Button>
        )}
      </div>
    )
  }

  // View/chord placement mode
  const lines = text.split('\n')
  let globalPosition = 0

  return (
    <div className="space-y-2">
      {draggedChord && (
        <div className="p-2 bg-primary/10 border border-primary/30 rounded-lg text-sm text-center">
          Кликните на любую букву в тексте, чтобы разместить аккорд <strong>{draggedChord.name}</strong>
        </div>
      )}
      <div 
        className={cn(
          "min-h-[400px] border rounded-lg p-4 bg-background overflow-x-auto font-sans",
          draggedChord && "ring-2 ring-primary/50"
        )}
      >
        <div className="space-y-0">
          {lines.map((line, lineIndex) => {
            const lineStart = globalPosition
            globalPosition += line.length + 1 // +1 for newline

            // Find chords for this line
            const lineChords = chords.filter(
              c => c.position >= lineStart && c.position < lineStart + line.length
            )

            return (
              <div key={lineIndex} className="relative">
                {/* Chord line */}
                <div className="h-6 relative">
                  {lineChords.map((chordData) => {
                    const relativePos = chordData.position - lineStart
                    const chord = chordData.chord
                    
                    return (
                      <div
                        key={chordData.id}
                        className="absolute -top-1 group"
                        style={{ left: `${relativePos * 0.62}em` }}
                      >
                        <Badge 
                          variant="secondary"
                          className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs"
                          onClick={() => onPlayChord(chordData.position)}
                        >
                          {chord?.name || '?'}
                        </Badge>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveChord(chordData.position)
                          }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Text line with drop targets */}
                <div className="flex whitespace-pre text-sm leading-relaxed tracking-wide">
                  {line.length === 0 ? (
                    <span 
                      className={cn(
                        "w-full min-h-[1.5em] block",
                        draggedChord && "cursor-crosshair hover:bg-primary/10"
                      )}
                      onClick={() => draggedChord && onDrop(lineStart)}
                    >
                      &nbsp;
                    </span>
                  ) : (
                    line.split('').map((char, charIndex) => {
                      const position = lineStart + charIndex
                      const hasChord = chords.some(c => c.position === position)
                      const isHovered = hoveredPosition === position

                      return (
                        <span
                          key={charIndex}
                          className={cn(
                            "relative select-none",
                            draggedChord && "cursor-crosshair hover:bg-primary/20",
                            isHovered && "bg-primary/30",
                            hasChord && "text-primary font-bold"
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
      
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setIsEditMode(true)}
      >
        Редактировать текст
      </Button>
    </div>
  )
}
