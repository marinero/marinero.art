import type { CommentChord } from '@/lib/types'

export type CommentRow = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id: string | null
  timestamp_seconds?: number | null
  object_id?: string | null
  chords?: CommentChord[] | null
  display_name: string | null
  username?: string | null
  role?: string | null
}

export type ThreadedComment = CommentRow & {
  user: { display_name: string; username?: string | null; role?: string | null } | null
  replies: ThreadedComment[]
}

export function buildCommentThreads(
  rows: CommentRow[]
): ThreadedComment[] {
  const topLevel: ThreadedComment[] = []
  const repliesMap = new Map<string, ThreadedComment[]>()

  for (const row of rows) {
    const comment: ThreadedComment = {
      ...row,
      user: row.display_name || row.username
        ? {
            display_name: row.display_name ?? row.username ?? '',
            username: row.username ?? null,
            role: row.role ?? null,
          }
        : null,
      replies: [],
    }

    if (!row.parent_id) {
      topLevel.push(comment)
    } else {
      const existing = repliesMap.get(row.parent_id) || []
      existing.push(comment)
      repliesMap.set(row.parent_id, existing)
    }
  }

  for (const comment of topLevel) {
    comment.replies = repliesMap.get(comment.id) || []
  }

  return topLevel
}

export function groupAudioCommentsByFile(
  rows: CommentRow[]
): Record<string, ThreadedComment[]> {
  const topLevelByFile: Record<string, ThreadedComment[]> = {}
  const repliesByParent = new Map<string, ThreadedComment[]>()

  for (const row of rows) {
    const comment: ThreadedComment = {
      ...row,
      user: row.display_name || row.username
        ? {
            display_name: row.display_name ?? row.username ?? '',
            username: row.username ?? null,
            role: row.role ?? null,
          }
        : null,
      replies: [],
    }

    if (!row.parent_id) {
      const fileId = row.object_id || ''
      if (!topLevelByFile[fileId]) topLevelByFile[fileId] = []
      topLevelByFile[fileId].push(comment)
    } else {
      const existing = repliesByParent.get(row.parent_id) || []
      existing.push(comment)
      repliesByParent.set(row.parent_id, existing)
    }
  }

  for (const fileId of Object.keys(topLevelByFile)) {
    for (const comment of topLevelByFile[fileId]) {
      comment.replies = repliesByParent.get(comment.id) || []
    }
  }

  return topLevelByFile
}
