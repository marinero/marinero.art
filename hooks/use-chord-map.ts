'use client'

import { useEffect, useState } from 'react'
import { buildChordMap } from '@/lib/text-chords'
import type { Chord } from '@/lib/types'

let cache: Promise<Chord[]> | null = null

function loadChords(): Promise<Chord[]> {
  if (!cache) {
    cache = fetch('/api/chords')
      .then((res) => (res.ok ? res.json() : { chords: [] }))
      .then((data) => (data.chords ?? []) as Chord[])
      .catch(() => {
        cache = null
        return [] as Chord[]
      })
  }
  return cache
}

/**
 * Returns a cached lookup from chord id to full chord, shared across all
 * consumers so the chord library is fetched at most once per page.
 */
export function useChordMap(): Map<string, Chord> {
  const [chordMap, setChordMap] = useState<Map<string, Chord>>(new Map())

  useEffect(() => {
    let cancelled = false
    loadChords().then((chords) => {
      if (!cancelled) setChordMap(buildChordMap(chords))
    })
    return () => {
      cancelled = true
    }
  }, [])

  return chordMap
}
