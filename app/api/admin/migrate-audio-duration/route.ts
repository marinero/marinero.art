import { parseBuffer } from 'music-metadata'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { extractStorageKey } from '@/lib/storage-keys'
import { getObjectStream } from '@/lib/storage'

export async function POST() {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const audioFiles = await db.queryMany<{ id: string; file_url: string; filename: string }>(
    `SELECT id, file_url, filename FROM audio_files WHERE duration_seconds IS NULL`
  )

  if (audioFiles.length === 0) {
    return NextResponse.json({ message: 'No audio files to migrate', updated: 0 })
  }

  const results: { id: string; filename: string; duration: number | null; error?: string }[] = []

  for (const audio of audioFiles) {
    try {
      const key = extractStorageKey(audio.file_url)
      if (!key) {
        results.push({
          id: audio.id,
          filename: audio.filename,
          duration: null,
          error: 'Could not extract storage key from file_url',
        })
        continue
      }

      const result = await getObjectStream(key)
      if (!result.stream) {
        results.push({
          id: audio.id,
          filename: audio.filename,
          duration: null,
          error: 'File not found in storage',
        })
        continue
      }

      const bytes = await result.stream.transformToByteArray()
      const buffer = Buffer.from(bytes)
      const metadata = await parseBuffer(buffer)
      const duration = metadata.format.duration

      if (duration && isFinite(duration)) {
        await db.query(
          'UPDATE audio_files SET duration_seconds = $2 WHERE id = $1',
          [audio.id, Math.round(duration)]
        )
        results.push({ id: audio.id, filename: audio.filename, duration: Math.round(duration) })
      } else {
        results.push({
          id: audio.id,
          filename: audio.filename,
          duration: null,
          error: 'Could not extract duration',
        })
      }
    } catch (err) {
      results.push({
        id: audio.id,
        filename: audio.filename,
        duration: null,
        error: String(err),
      })
    }
  }

  const updated = results.filter((r) => r.duration !== null && !r.error).length
  const failed = results.filter((r) => r.error).length
  const errors = results.filter((r) => r.error).map((r) => `${r.filename}: ${r.error}`)

  return NextResponse.json({
    message: 'Migration complete',
    total: audioFiles.length,
    updated,
    failed,
    errors,
  })
}
