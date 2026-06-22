import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sendCommentMentionNotifications } from '@/lib/comment-notifications'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { content, contextType, contextId, contextUrl } = await request.json()

    if (!content || !contextType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await sendCommentMentionNotifications({
      authorId: session.user.id,
      content,
      contextType,
      contextId,
      contextUrl,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Error in comment mention notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
