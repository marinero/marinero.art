import { type NextRequest, NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import archiver from 'archiver'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { getObjectStream } from '@/lib/storage'
import { extractStorageKey, guessContentType } from '@/lib/storage-keys'

export const runtime = 'nodejs'

/** Заменяет небезопасные для имени файла символы. */
function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || 'file'
}

/** Формирует заголовок Content-Disposition с ASCII-fallback и UTF-8 (RFC 5987). */
function contentDisposition(filename: string): string {
  const safe = sanitizeFilename(filename)
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_')
  const encoded = encodeURIComponent(safe)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

async function downloadSingleAudio(audioId: string) {
  const audio = await db.queryOne<{ filename: string; file_url: string }>(
    'SELECT filename, file_url FROM audio_files WHERE id = $1',
    [audioId]
  )

  if (!audio) {
    return NextResponse.json({ error: 'Audio file not found' }, { status: 404 })
  }

  const key = extractStorageKey(audio.file_url)
  if (!key) {
    return NextResponse.json({ error: 'Invalid file reference' }, { status: 400 })
  }

  const result = await getObjectStream(key)
  if (!result.stream) {
    return new NextResponse('Not found', { status: 404 })
  }

  const headers: Record<string, string> = {
    'Content-Type': result.contentType || guessContentType(key),
    'Content-Disposition': contentDisposition(audio.filename),
    'Cache-Control': 'private, no-store',
  }
  if (result.contentLength != null) {
    headers['Content-Length'] = String(result.contentLength)
  }

  return new NextResponse(result.stream.transformToWebStream(), { status: 200, headers })
}

async function downloadMultitrackZip(groupId: string) {
  const group = await db.queryOne<{ name: string }>(
    'SELECT name FROM multitrack_groups WHERE id = $1',
    [groupId]
  )

  if (!group) {
    return NextResponse.json({ error: 'Multitrack group not found' }, { status: 404 })
  }

  const files = await db.queryMany<{ filename: string; file_url: string }>(
    `SELECT filename, file_url FROM multitrack_files
     WHERE multitrack_group_id = $1
     ORDER BY order_index ASC`,
    [groupId]
  )

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files in this group' }, { status: 404 })
  }

  const archive = archiver('zip', { store: true })

  // Если поток отвалится, помечаем архив прерванным.
  archive.on('error', (err) => {
    console.error('Archive error:', err)
    archive.destroy(err)
  })

  const usedNames = new Set<string>()

  for (const file of files) {
    const key = extractStorageKey(file.file_url)
    if (!key) continue

    let name = sanitizeFilename(file.filename)
    // Гарантируем уникальность имён внутри архива.
    if (usedNames.has(name)) {
      const dot = name.lastIndexOf('.')
      const base = dot > 0 ? name.slice(0, dot) : name
      const ext = dot > 0 ? name.slice(dot) : ''
      let i = 2
      while (usedNames.has(`${base} (${i})${ext}`)) i++
      name = `${base} (${i})${ext}`
    }
    usedNames.add(name)

    const result = await getObjectStream(key)
    if (!result.stream) continue
    archive.append(result.stream as unknown as Readable, { name })
  }

  // finalize запускает потоковую сборку архива.
  archive.finalize()

  const webStream = Readable.toWeb(archive) as ReadableStream<Uint8Array>

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': contentDisposition(`${group.name}.zip`),
      'Cache-Control': 'private, no-store',
    },
  })
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin()
  if ('error' in authResult && authResult.error) return authResult.error

  const audioId = request.nextUrl.searchParams.get('audio')
  const groupId = request.nextUrl.searchParams.get('multitrack')

  try {
    if (audioId) {
      return await downloadSingleAudio(audioId)
    }
    if (groupId) {
      return await downloadMultitrackZip(groupId)
    }
    return NextResponse.json(
      { error: 'Provide either "audio" or "multitrack" parameter' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: 'Failed to prepare download' }, { status: 500 })
  }
}
