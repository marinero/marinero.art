'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GuitarFretboard } from './guitar-fretboard'
import { ChordDiagram } from './chord-diagram'
import { useGuitarAudio } from '@/hooks/use-guitar-audio'
import { detectChordFromNotes, getNotesFromFretPositions, calculateBaseFret } from '@/lib/guitar-utils'
import { Volume2, Save, RotateCcw, Music } from 'lucide-react'
import { toast } from 'sonner'
import type { Chord } from '@/lib/types'

interface ChordEditorProps {
  chord?: Chord | null
  onSave?: (chord: Chord) => void
  onCancel?: () => void
}

const INITIAL_POSITIONS = [-1, -1, -1, -1, -1, -1]

export function ChordEditor({ chord, onSave, onCancel }: ChordEditorProps) {
  const [fretPositions, setFretPositions] = useState<number[]>(
    chord?.fret_positions as number[] || [...INITIAL_POSITIONS]
  )
  const [fingerPositions, setFingerPositions] = useState<number[]>(
    chord?.finger_positions as number[] || [0, 0, 0, 0, 0, 0]
  )
  const [name, setName] = useState(chord?.name || '')
  const [isAutoName, setIsAutoName] = useState(!chord)
  const [isSaving, setIsSaving] = useState(false)
  
  const { playArpeggio, playChord, isPlaying } = useGuitarAudio()

  // Auto-detect chord name
  useEffect(() => {
    if (!isAutoName) return
    
    const notes = getNotesFromFretPositions(fretPositions)
    if (notes.length >= 2) {
      const detected = detectChordFromNotes(notes)
      if (detected) {
        setName(detected.name)
      } else {
        setName('')
      }
    } else {
      setName('')
    }
  }, [fretPositions, isAutoName])

  const handleNameChange = (value: string) => {
    setName(value)
    setIsAutoName(false)
  }

  const handleReset = () => {
    setFretPositions([...INITIAL_POSITIONS])
    setFingerPositions([0, 0, 0, 0, 0, 0])
    setName('')
    setIsAutoName(true)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a chord name')
      return
    }

    const notes = getNotesFromFretPositions(fretPositions)
    if (notes.length < 2) {
      toast.error('Please select at least 2 notes')
      return
    }

    setIsSaving(true)

    const detected = detectChordFromNotes(notes)
    const baseFret = calculateBaseFret(fretPositions)

    const chordData = {
      name: name.trim(),
      root_note: detected?.root || notes[0],
      chord_type: detected?.type || 'unknown',
      fret_positions: fretPositions,
      finger_positions: fingerPositions,
      base_fret: baseFret
    }

    try {
      if (chord?.id) {
        const res = await fetch(`/api/chords/${chord.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chordData),
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || 'Failed to update')
        }

        const { chord: data } = await res.json()
        toast.success('Chord updated')
        onSave?.(data as Chord)
      } else {
        const res = await fetch('/api/chords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chordData),
        })

        if (res.status === 409) {
          toast.error('This chord already exists in the library')
          return
        }

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || 'Failed to save')
        }

        const { chord: data } = await res.json()
        toast.success('Chord saved to library')
        onSave?.(data as Chord)
        handleReset()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save chord')
    } finally {
      setIsSaving(false)
    }
  }

  const detectedNotes = getNotesFromFretPositions(fretPositions)
  const baseFret = calculateBaseFret(fretPositions)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Fretboard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Music className="h-5 w-5" />
            Guitar Fretboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="pt-6">
            <GuitarFretboard
              fretPositions={fretPositions}
              fingerPositions={fingerPositions}
              onFretPositionsChange={setFretPositions}
              onFingerPositionsChange={setFingerPositions}
              totalFrets={14}
              showNotes
              showFingers
            />
          </div>
          
          {/* Detected notes */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Notes:</span>
            {detectedNotes.length > 0 ? (
              detectedNotes.map((note, i) => (
                <span 
                  key={i}
                  className="px-2 py-0.5 bg-primary/10 text-primary text-sm rounded"
                >
                  {note}
                </span>
              ))
            ) : (
              <span className="text-sm text-muted-foreground italic">
                Select notes on the fretboard
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview & Save */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Chord Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name input */}
          <div className="space-y-2">
            <Label htmlFor="chordName">Chord Name</Label>
            <div className="flex gap-2">
              <Input
                id="chordName"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Am, G7, Cmaj7"
              />
              {!isAutoName && (
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setIsAutoName(true)}
                  title="Auto-detect name"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
            {isAutoName && name && (
              <p className="text-xs text-muted-foreground">
                Auto-detected chord name
              </p>
            )}
          </div>

          {/* Chord diagram preview */}
          <div className="flex justify-center py-4 border rounded-lg bg-muted/30">
            {name || detectedNotes.length >= 2 ? (
              <ChordDiagram
                name={name || '?'}
                fretPositions={fretPositions}
                fingerPositions={fingerPositions}
                baseFret={baseFret}
                size="lg"
              />
            ) : (
              <div className="text-muted-foreground text-sm py-8">
                Select at least 2 notes to preview
              </div>
            )}
          </div>

          {/* Audio controls */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => playArpeggio(fretPositions)}
              disabled={isPlaying || detectedNotes.length < 2}
              className="flex-1"
            >
              <Volume2 className="h-4 w-4 mr-2" />
              Strum Down
            </Button>
            <Button
              variant="outline"
              onClick={() => playChord(fretPositions)}
              disabled={isPlaying || detectedNotes.length < 2}
              className="flex-1"
            >
              <Volume2 className="h-4 w-4 mr-2" />
              Play Chord
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !name.trim() || detectedNotes.length < 2}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              {chord ? 'Update' : 'Save to Library'}
            </Button>
          </div>
          
          {onCancel && (
            <Button
              variant="ghost"
              onClick={onCancel}
              className="w-full"
            >
              Cancel
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
