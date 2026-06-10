import { type NextRequest, NextResponse } from 'next/server'
import { getObjectStream, headObject } from '@/lib/storage'

function getKey(request: NextRequest): string | null {
  const key =
    request.nextUrl.searchParams.get('key') ??
    request.nextUrl.searchParams.get('pathname')
  return key ? decodeURIComponent(key) : null
}

export async function GET(request: NextRequest) {
  try {
    const key = getKey(request)
    if (!key) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 })
    }

    const ifNoneMatch = request.headers.get('if-none-match')
    const meta = await headObject(key)

    if (ifNoneMatch && meta.etag && ifNoneMatch === meta.etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: meta.etag,
          'Cache-Control': 'private, no-cache',
        },
      })
    }

    const range = request.headers.get('range') ?? undefined
    const result = await getObjectStream(key, range)

    if (!result.stream) {
      return new NextResponse('Not found', { status: 404 })
    }

    const headers: Record<string, string> = {
      'Content-Type': result.contentType,
      ETag: result.etag,
      'Cache-Control': 'private, no-cache',
      'Accept-Ranges': 'bytes',
    }

    if (result.contentLength != null) {
      headers['Content-Length'] = String(result.contentLength)
    }
    if (result.contentRange) {
      headers['Content-Range'] = result.contentRange
    }

    const body = result.stream.transformToWebStream()

    return new NextResponse(body, {
      status: result.statusCode,
      headers,
    })
  } catch (error) {
    console.error('Error serving file:', error)
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}
