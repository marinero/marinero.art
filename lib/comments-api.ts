import { db } from '@/lib/db'
import type { Profile } from '@/lib/types'

export interface CommentRow {
  id: string
  type: string
  object_id: string
  user_id: string
  content: string
  created_at: string
  parent_id: string | null
  timestamp_seconds: number | null
  display_name: string | null
  username: string | null
  role: string
}

export async function fetchCommentsWithProfiles(type: string, objectId: string) {
  return db.queryMany<CommentRow>(
    `SELECT c.id, c.type, c.object_id, c.user_id, c.content, c.created_at,
            c.parent_id, c.timestamp_seconds,
            p.display_name, p.username, p.role
     FROM comments c
     INNER JOIN profiles p ON p.id = c.user_id
     WHERE c.type = $1 AND c.object_id = $2
     ORDER BY c.created_at ASC`,
    [type, objectId]
  )
}

export function toProfilePick(row: CommentRow): Pick<Profile, 'display_name' | 'username' | 'role'> {
  return {
    display_name: row.display_name,
    username: row.username,
    role: row.role as Profile['role'],
  }
}
