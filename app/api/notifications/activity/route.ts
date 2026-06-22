import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  getCommentActivityItems,
  getUnreadCommentActivityCount,
  markCommentActivitySeen,
} from '@/lib/comment-activity'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const countOnly = searchParams.get('count_only') === '1'

  if (countOnly) {
    const unread_count = await getUnreadCommentActivityCount(session.user.id)
    return NextResponse.json({ unread_count })
  }

  const items = await getCommentActivityItems(session.user.id)
  const unread_count = items.filter((item) => item.is_unread).length

  return NextResponse.json({ items, unread_count })
}

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await markCommentActivitySeen(session.user.id)

  return NextResponse.json({ ok: true, unread_count: 0 })
}
