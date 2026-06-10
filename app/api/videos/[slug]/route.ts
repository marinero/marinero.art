import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { Video } from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  let video = await db.queryOne<Video>(
    `SELECT * FROM videos
     WHERE slug = $1 AND is_published = true`,
    [slug]
  )

  if (!video) {
    video = await db.queryOne<Video>(
      `SELECT * FROM videos
       WHERE id = $1 AND is_published = true`,
      [slug]
    )
  }

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  return NextResponse.json({ video })
}
