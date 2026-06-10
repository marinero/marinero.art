import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { uploadFile } from '@/lib/storage'
import {
  guessContentType,
  resolveBucket,
  storageUrlForKey,
} from '@/lib/storage-keys'

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

export async function POST(request: Request) {
  try {
    await requireUploadAdmin()

    const formData = await request.formData()
    const file = formData.get('file')
    const pathname = formData.get('pathname') as string | null
    const access = (formData.get('access') as string | null) ?? 'auto'

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!pathname) {
      return NextResponse.json({ error: 'pathname is required' }, { status: 400 })
    }

    const key = pathname.replace(/^\/+/, '')
    const buffer = Buffer.from(await file.arrayBuffer())
    const contentType = file.type || guessContentType(key)
    const bucket =
      access === 'public'
        ? 'public'
        : access === 'private'
          ? 'private'
          : resolveBucket(key)

    await uploadFile(key, buffer, contentType, bucket)

    return NextResponse.json({
      pathname: key,
      url: storageUrlForKey(key),
      bucket,
    })
  } catch (error) {
    const message = (error as Error).message
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
