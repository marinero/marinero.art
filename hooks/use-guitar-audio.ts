'use client'

import { useCallback, useRef, useEffect, useState } from 'react'
import * as Tone from 'tone'
import { getFullNotesFromFretPositions } from '@/lib/guitar-utils'

interface UseGuitarAudioOptions {
  arpeggioDelay?: number // ms between notes in arpeggio
  noteDuration?: string // Tone.js duration format
  volume?: number // dB
}

export function useGuitarAudio(options: UseGuitarAudioOptions = {}) {
  const {
    arpeggioDelay = 50,
    noteDuration = '2n',
    volume = -6
  } = options

  const synthRef = useRef<Tone.PolySynth | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // Initialize synth
  useEffect(() => {
    // Create a guitar-like synth
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'triangle'
      },
      envelope: {
        attack: 0.005,
        decay: 0.3,
        sustain: 0.2,
        release: 1.5
      }
    }).toDestination()

    synthRef.current.volume.value = volume
    setIsReady(true)

    return () => {
      if (synthRef.current) {
        synthRef.current.dispose()
        synthRef.current = null
      }
    }
  }, [volume])

  // Start audio context on user interaction
  const ensureAudioContext = useCallback(async () => {
    if (Tone.getContext().state !== 'running') {
      await Tone.start()
    }
  }, [])

  // Play a single note
  const playNote = useCallback(async (note: string) => {
    await ensureAudioContext()
    if (!synthRef.current) return

    synthRef.current.triggerAttackRelease(note, noteDuration)
  }, [ensureAudioContext, noteDuration])

  // Play chord as arpeggio (strum)
  const playArpeggio = useCallback(async (fretPositions: number[]) => {
    await ensureAudioContext()
    if (!synthRef.current || isPlaying) return

    setIsPlaying(true)
    const notes = getFullNotesFromFretPositions(fretPositions)
    
    if (notes.length === 0) {
      setIsPlaying(false)
      return
    }

    const now = Tone.now()
    
    // Play notes in sequence (low to high, like strumming down)
    notes.forEach((note, index) => {
      synthRef.current!.triggerAttackRelease(
        note,
        noteDuration,
        now + (index * arpeggioDelay) / 1000
      )
    })

    // Reset playing state after all notes played
    setTimeout(() => {
      setIsPlaying(false)
    }, notes.length * arpeggioDelay + 1000)
  }, [ensureAudioContext, arpeggioDelay, noteDuration, isPlaying])

  // Play chord simultaneously
  const playChord = useCallback(async (fretPositions: number[]) => {
    await ensureAudioContext()
    if (!synthRef.current || isPlaying) return

    setIsPlaying(true)
    const notes = getFullNotesFromFretPositions(fretPositions)
    
    if (notes.length === 0) {
      setIsPlaying(false)
      return
    }

    synthRef.current.triggerAttackRelease(notes, noteDuration)

    setTimeout(() => {
      setIsPlaying(false)
    }, 1000)
  }, [ensureAudioContext, noteDuration, isPlaying])

  // Play strum up (high to low)
  const playStrumUp = useCallback(async (fretPositions: number[]) => {
    await ensureAudioContext()
    if (!synthRef.current || isPlaying) return

    setIsPlaying(true)
    const notes = getFullNotesFromFretPositions(fretPositions).reverse()
    
    if (notes.length === 0) {
      setIsPlaying(false)
      return
    }

    const now = Tone.now()
    
    notes.forEach((note, index) => {
      synthRef.current!.triggerAttackRelease(
        note,
        noteDuration,
        now + (index * arpeggioDelay) / 1000
      )
    })

    setTimeout(() => {
      setIsPlaying(false)
    }, notes.length * arpeggioDelay + 1000)
  }, [ensureAudioContext, arpeggioDelay, noteDuration, isPlaying])

  return {
    isReady,
    isPlaying,
    playNote,
    playArpeggio,
    playChord,
    playStrumUp
  }
}
