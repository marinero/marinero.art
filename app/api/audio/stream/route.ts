import { NextRequest, NextResponse } from 'next/server'
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

    const meta = await headObject(key)
    const range = request.headers.get('range') ?? undefined
    const result = await getObjectStream(key, range)

    if (!result.stream) {
      return new NextResponse('Not found', { status: 404 })
    }

    const headers: Record<string, string> = {
      'Content-Type': meta.contentType || 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=31536000',
    }

    if (result.contentLength != null) {
      headers['Content-Length'] = String(result.contentLength)
    }
    if (result.contentRange) {
      headers['Content-Range'] = result.contentRange
    } else if (!range) {
      headers['Content-Length'] = String(meta.size)
    }

    const body = result.stream.transformToWebStream()

    return new NextResponse(body, {
      status: result.statusCode,
      headers,
    })
  } catch (error) {
    console.error('Error streaming audio:', error)
    return NextResponse.json({ error: 'Failed to stream audio' }, { status: 500 })
  }
}
