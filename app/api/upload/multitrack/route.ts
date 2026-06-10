import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

async function requireUploadAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const profile = await db.queryOne<{ role: string }>(
    'SELECT role FROM profiles WHERE id = $1',
    [session.user.id]
  )

  if (profile?.role !== 'admin') {
    throw new Error('Forbidden')
  }

  return session.user
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const user = await requireUploadAdmin()

        return {
          maximumSizeInBytes: 200 * 1024 * 1024,
          allowedContentTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/flac'],
          tokenPayload: JSON.stringify({
            userId: user.id,
          }),
        }
      },
      onUploadCompleted: async () => {},
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}
