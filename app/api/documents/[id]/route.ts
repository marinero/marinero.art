import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { getObjectStream } from '@/lib/storage'
import { extractStorageKey, guessContentType } from '@/lib/storage-keys'

export const runtime = 'nodejs'

/** Заменяет небезопасные для имени файла символы. */
function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || 'file'
}

/** Формирует Content-Disposition с ASCII-fallback и UTF-8 (RFC 5987). */
function contentDisposition(filename: string, download: boolean): string {
  const safe = sanitizeFilename(filename)
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_')
  const encoded = encodeURIComponent(safe)
  const type = download ? 'attachment' : 'inline'
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const doc = await db.queryOne<{
      file_url: string
      filename: string
      content_type: string | null
      is_published: boolean
    }>(
      `SELECT file_url, filename, content_type, is_published
       FROM song_documents WHERE id = $1`,
      [id]
    )

    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Неопубликованные документы доступны только администраторам.
    if (!doc.is_published) {
      const { isAdmin } = await getSessionUser()
      if (!isAdmin) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
    }

    const key = extractStorageKey(doc.file_url)
    if (!key) {
      return NextResponse.json({ error: 'Invalid file reference' }, { status: 400 })
    }

    const download = request.nextUrl.searchParams.get('download') === '1'
    const range = request.headers.get('range') ?? undefined
    const result = await getObjectStream(key, range)

    if (!result.stream) {
      return new NextResponse('Not found', { status: 404 })
    }

    const headers: Record<string, string> = {
      'Content-Type': doc.content_type || result.contentType || guessContentType(key),
      'Content-Disposition': contentDisposition(doc.filename, download),
      'Cache-Control': 'private, no-cache',
      'Accept-Ranges': 'bytes',
    }
    if (result.contentLength != null) {
      headers['Content-Length'] = String(result.contentLength)
    }
    if (result.contentRange) {
      headers['Content-Range'] = result.contentRange
    }

    return new NextResponse(result.stream.transformToWebStream(), {
      status: result.statusCode,
      headers,
    })
  } catch (error) {
    console.error('Error serving document:', error)
    return NextResponse.json({ error: 'Failed to serve document' }, { status: 500 })
  }
}
