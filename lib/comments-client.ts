import type { ThreadedComment } from '@/lib/comment-threads'
import type { CommentChord } from '@/lib/types'

export type NormalizedComment = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id: string | null
  timestamp_seconds?: number | null
  object_id?: string | null
  chords?: CommentChord[] | null
  profiles: {
    display_name: string | null
    username: string | null
    role: string
  }
}

function flattenCommentThreads(threads: ThreadedComment[]): ThreadedComment[] {
  const flat: ThreadedComment[] = []

  for (const comment of threads) {
    flat.push(comment)
    if (comment.replies.length > 0) {
      flat.push(...flattenCommentThreads(comment.replies))
    }
  }

  return flat
}

function normalizeComment(comment: ThreadedComment): NormalizedComment {
  return {
    id: comment.id,
    content: comment.content,
    created_at: comment.created_at,
    user_id: comment.user_id,
    parent_id: comment.parent_id,
    timestamp_seconds: comment.timestamp_seconds,
    object_id: comment.object_id,
    chords: comment.chords ?? null,
    profiles: {
      display_name: comment.user?.display_name ?? comment.display_name ?? null,
      username: comment.user?.username ?? null,
      role: comment.user?.role ?? 'fan',
    },
  }
}

export async function fetchNormalizedComments(
  type: string,
  objectId: string
): Promise<NormalizedComment[]> {
  const res = await fetch(
    `/api/comments?type=${encodeURIComponent(type)}&object_id=${encodeURIComponent(objectId)}`,
    { credentials: 'include' }
  )

  if (!res.ok) {
    return []
  }

  const data = (await res.json()) as { comments?: ThreadedComment[] }
  const threads = data.comments ?? []
  return flattenCommentThreads(threads).map(normalizeComment)
}

export function buildCommentTree<
  T extends { id: string; parent_id: string | null; replies?: T[] }
>(comments: T[]): T[] {
  const enriched = comments.map((comment) => ({
    ...comment,
    replies: [] as T[],
  }))

  const topLevel: T[] = []
  const repliesMap = new Map<string, T[]>()

  enriched.forEach((comment) => {
    if (!comment.parent_id) {
      topLevel.push(comment)
    } else {
      const existing = repliesMap.get(comment.parent_id) || []
      existing.push(comment)
      repliesMap.set(comment.parent_id, existing)
    }
  })

  topLevel.forEach((comment) => {
    comment.replies = repliesMap.get(comment.id) || []
  })

  return topLevel
}
