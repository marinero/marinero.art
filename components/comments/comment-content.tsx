'use client'

import type { Chord, CommentChord } from '@/lib/types'
import { TextWithChordsDisplay } from '@/components/text-chords/text-with-chords-display'
import { MENTION_REGEX } from '@/lib/comment-mentions'

const TIMESTAMP_TOKEN_REGEX = /(\d{1,2}:\d{2}(?::\d{2})?)/
const URL_TOKEN_REGEX = /(https?:\/\/[^\s]+)/
// Punctuation that commonly trails a URL in prose but isn't part of it.
const URL_TRAILING_PUNCTUATION = /[.,;:!?)\]}'"»]+$/

function parseTimestamp(value: string): number | null {
  const parts = value.split(':').map(Number)
  if (parts.some((part) => Number.isNaN(part))) return null

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }

  return null
}

type ContentToken =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string }
  | { type: 'timestamp'; value: string }
  | { type: 'url'; value: string }

function tokenizeContent(content: string, includeTimestamps: boolean): ContentToken[] {
  // Order matters: URLs are matched before timestamps so a URL containing
  // digits and colons is not split apart.
  const parts = [MENTION_REGEX.source, URL_TOKEN_REGEX.source]
  if (includeTimestamps) parts.push(TIMESTAMP_TOKEN_REGEX.source)
  const regex = new RegExp(parts.join('|'), 'g')

  const tokens: ContentToken[] = []
  let lastIndex = 0

  for (const match of content.matchAll(regex)) {
    const index = match.index ?? 0
    const matchedText = match[0]

    if (index > lastIndex) {
      tokens.push({ type: 'text', value: content.slice(lastIndex, index) })
    }

    if (matchedText.startsWith('@')) {
      tokens.push({ type: 'mention', value: matchedText })
    } else if (/^https?:\/\//i.test(matchedText)) {
      const trailing = matchedText.match(URL_TRAILING_PUNCTUATION)?.[0] ?? ''
      const url = trailing ? matchedText.slice(0, -trailing.length) : matchedText
      tokens.push({ type: 'url', value: url })
      if (trailing) tokens.push({ type: 'text', value: trailing })
    } else {
      tokens.push({ type: 'timestamp', value: matchedText })
    }

    lastIndex = index + matchedText.length
  }

  if (lastIndex < content.length) {
    tokens.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return tokens
}

/** Renders a plain string with styled @mentions and clickable timestamps. */
export function CommentText({
  content,
  onTimestampClick,
}: {
  content: string
  onTimestampClick?: (seconds: number) => void
}) {
  const tokens = tokenizeContent(content, Boolean(onTimestampClick))

  return (
    <>
      {tokens.map((token, index) => {
        if (token.type === 'mention') {
          return (
            <span key={index} className="font-medium text-primary">
              {token.value}
            </span>
          )
        }

        if (token.type === 'url') {
          return (
            <a
              key={index}
              href={token.value}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2 hover:text-primary/80 break-all"
            >
              {token.value}
            </a>
          )
        }

        if (token.type === 'timestamp' && onTimestampClick) {
          const seconds = parseTimestamp(token.value)
          if (seconds !== null) {
            return (
              <button
                key={index}
                type="button"
                onClick={() => onTimestampClick(seconds)}
                className="font-medium text-primary hover:underline cursor-pointer"
              >
                {token.value}
              </button>
            )
          }
        }

        return <span key={index}>{token.value}</span>
      })}
    </>
  )
}

type CommentContentProps = {
  content: string
  chords?: CommentChord[] | null
  chordMap?: Map<string, Chord>
  onChordClick?: (chord: Chord) => void
  onTimestampClick?: (seconds: number) => void
  className?: string
}

export function CommentContent({
  content,
  chords,
  chordMap,
  onChordClick,
  onTimestampClick,
  className,
}: CommentContentProps) {
  if (chords && chords.length > 0 && chordMap) {
    return (
      <TextWithChordsDisplay
        text={content}
        chords={chords}
        chordMap={chordMap}
        onChordClick={onChordClick}
        className={className}
        renderText={(line) => (
          <CommentText content={line} onTimestampClick={onTimestampClick} />
        )}
      />
    )
  }

  return (
    <span className={className}>
      <CommentText content={content} onTimestampClick={onTimestampClick} />
    </span>
  )
}
