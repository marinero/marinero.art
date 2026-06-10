'use client'

import { useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChordDiagram } from './chord-diagram'
import { useGuitarAudio } from '@/hooks/use-guitar-audio'
import { Search, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Chord } from '@/lib/types'

interface ChordLibraryProps {
  onSelectChord?: (chord: Chord) => void
  selectedChordId?: string | null
  className?: string
}

export interface ChordLibraryRef {
  refresh: () => Promise<void>
}

const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const ChordLibrary = forwardRef<ChordLibraryRef, ChordLibraryProps>(function ChordLibrary({ 
  onSelectChord, 
  selectedChordId,
  className 
}, ref) {
  const [chords, setChords] = useState<Chord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRoot, setFilterRoot] = useState<string | null>(null)
  const { playArpeggio, isPlaying } = useGuitarAudio()

  useEffect(() => {
    loadChords()
  }, [])

  useImperativeHandle(ref, () => ({
    refresh: loadChords
  }), [])

  async function loadChords() {
    setLoading(true)
    const res = await fetch('/api/chords')
    if (res.ok) {
      const { chords: data } = await res.json()
      setChords(data as Chord[])
    }
    setLoading(false)
  }

  const filteredChords = useMemo(() => {
    return chords.filter(chord => {
      const matchesSearch = !searchQuery || 
        chord.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesRoot = !filterRoot || chord.root_note === filterRoot
      return matchesSearch && matchesRoot
    })
  }, [chords, searchQuery, filterRoot])

  const handlePlay = (e: React.MouseEvent, chord: Chord) => {
    e.stopPropagation()
    playArpeggio(chord.fret_positions as number[])
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Root note filter */}
      <div className="p-2 border-b overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          <Button
            variant={filterRoot === null ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilterRoot(null)}
            className="h-7 px-2 text-xs"
          >
            All
          </Button>
          {ROOT_NOTES.map(note => (
            <Button
              key={note}
              variant={filterRoot === note ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterRoot(filterRoot === note ? null : note)}
              className="h-7 px-2 text-xs"
            >
              {note}
            </Button>
          ))}
        </div>
      </div>

      {/* Chord list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">
              Loading chords...
            </div>
          ) : filteredChords.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No chords found
            </div>
          ) : (
            <div className="flex flex-wrap gap-1 justify-start">
              {filteredChords.map(chord => (
                <div
                  key={chord.id}
                  className={cn(
                    "relative group p-1 rounded hover:bg-accent/50 cursor-pointer transition-colors",
                    selectedChordId === chord.id && "ring-2 ring-primary bg-accent/30"
                  )}
                  onClick={() => onSelectChord?.(chord)}
                >
                  <ChordDiagram
                    name={chord.name}
                    fretPositions={chord.fret_positions as number[]}
                    fingerPositions={chord.finger_positions as number[] | null}
                    baseFret={chord.base_fret}
                    size="sm"
                  />
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handlePlay(e, chord)}
                    disabled={isPlaying}
                  >
                    <Volume2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Info */}
      <div className="p-2 border-t text-xs text-muted-foreground text-center">
        {filteredChords.length} chord{filteredChords.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
})
