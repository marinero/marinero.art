import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { uploadFile, deletePrefix } from '@/lib/storage'
import { guessContentType } from '@/lib/storage-keys'

async function requireUploadAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const profile = await db.queryOne<{ role: string }>(
    'SELECT role FROM profiles WHERE id = $1',
    [session.user.id]
  )

  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { session }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const authResult = await requireUploadAdmin()
    if ('error' in authResult && authResult.error) return authResult.error

    const url = new URL(request.url)
    const uploadId = url.searchParams.get('uploadId')
    const chunkIndex = parseInt(url.searchParams.get('chunkIndex') || '0')
    const totalChunks = parseInt(url.searchParams.get('totalChunks') || '1')
    const filename = url.searchParams.get('filename')

    if (!uploadId || !filename) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const contentType = request.headers.get('content-type') || 'audio/mpeg'
    const chunk = Buffer.from(await request.arrayBuffer())
    const chunkPath = `temp-chunks/${uploadId}/chunk-${chunkIndex.toString().padStart(5, '0')}`

    await uploadFile(chunkPath, chunk, contentType, 'private')

    if (chunkIndex === totalChunks - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300))

      const chunks: Buffer[] = []
      for (let i = 0; i < totalChunks; i++) {
        const path = `temp-chunks/${uploadId}/chunk-${i.toString().padStart(5, '0')}`
        const { getObjectStream } = await import('@/lib/storage')
        const result = await getObjectStream(path)
        if (!result.stream) throw new Error(`Missing chunk ${i}`)
        const bytes = await result.stream.transformToByteArray()
        chunks.push(Buffer.from(bytes))
      }

      const combined = Buffer.concat(chunks)
      const key = filename.replace(/^\/+/, '')
      await uploadFile(key, combined, contentType, 'private')
      await deletePrefix(`temp-chunks/${uploadId}/`, 'private')

      return NextResponse.json({ pathname: key, complete: true })
    }

    return NextResponse.json({
      received: chunkIndex + 1,
      total: totalChunks,
      complete: false,
    })
  } catch (error) {
    console.error('Chunk upload error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
