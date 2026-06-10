import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'

// Increase body size limit for large audio files (default is 4MB)
export const maxDuration = 60 // 60 seconds timeout

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Get auth token from header (set by client after checking admin status)
    // Use first 32 chars of BLOB token as shared secret
    const authToken = request.headers.get('x-admin-token')
    const expectedToken = process.env.BLOB_READ_WRITE_TOKEN?.slice(0, 32)
    
    if (!authToken || authToken !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get filename from URL params
    const url = new URL(request.url)
    const filename = url.searchParams.get('filename')
    
    if (!filename) {
      return NextResponse.json({ error: 'Filename required' }, { status: 400 })
    }

    // Check content type
    const contentType = request.headers.get('content-type') || 'audio/mpeg'
    
    // Read the body as array buffer and upload to Vercel Blob
    const body = await request.arrayBuffer()
    const blob = await put(filename, body, {
      access: 'public',
      contentType,
    })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
