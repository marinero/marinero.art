/** Matches @username or @"name with spaces" in comment text */
export const MENTION_REGEX = /@(?:"([^"]+)"|([^\s@]+))/g

export type MentionUser = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url?: string | null
}

export function getMentionLabel(user: MentionUser): string | null {
  return user.username?.trim() || user.display_name?.trim() || null
}

export function formatMentionToken(username: string): string {
  if (/[\s"]/.test(username)) {
    return `"${username.replace(/"/g, '')}"`
  }
  return username
}

export function commentMentionsUser(
  content: string,
  username: string | null,
  displayName: string | null
): boolean {
  const mentionTargets = [
    username?.trim().toLowerCase(),
    displayName?.trim().toLowerCase(),
  ].filter(Boolean) as string[]

  if (mentionTargets.length === 0) return false

  const mentions = extractMentionUsernames(content)
  return mentions.some((mention) => mentionTargets.includes(mention))
}

export function extractMentionUsernames(content: string): string[] {
  const matches = content.matchAll(MENTION_REGEX)
  const seen = new Set<string>()
  const usernames: string[] = []

  for (const match of matches) {
    const username = (match[1] || match[2])?.trim().toLowerCase()
    if (username && !seen.has(username)) {
      seen.add(username)
      usernames.push(username)
    }
  }

  return usernames
}

export function getActiveMentionQuery(
  value: string,
  cursorPosition: number
): { query: string; start: number } | null {
  const beforeCursor = value.slice(0, cursorPosition)
  const match = beforeCursor.match(/(^|\s)@([^\s@"]*)$/)

  if (!match) return null

  const atIndex = beforeCursor.lastIndexOf('@')
  if (atIndex === -1) return null

  return {
    query: match[2] ?? '',
    start: atIndex,
  }
}

export function insertMention(
  value: string,
  mentionStart: number,
  cursorPosition: number,
  username: string
): { value: string; cursorPosition: number } {
  const before = value.slice(0, mentionStart)
  const after = value.slice(cursorPosition)
  const mention = `@${formatMentionToken(username)} `
  const nextValue = `${before}${mention}${after}`

  return {
    value: nextValue,
    cursorPosition: before.length + mention.length,
  }
}
