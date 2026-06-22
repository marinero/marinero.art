'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ComponentProps,
} from 'react'
import { createPortal } from 'react-dom'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  getActiveMentionQuery,
  getMentionLabel,
  insertMention,
  type MentionUser,
} from '@/lib/comment-mentions'

type CommentInputProps = {
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void
} & Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'onKeyDown'> &
  Omit<ComponentProps<'textarea'>, 'value' | 'onChange' | 'onKeyDown'>

type DropdownPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
}

const DROPDOWN_GAP = 4
const DROPDOWN_MAX_HEIGHT = 240

export function CommentInput({
  value,
  onChange,
  multiline = false,
  className,
  disabled,
  onKeyDown,
  ...props
}: CommentInputProps) {
  const [mentionActive, setMentionActive] = useState(false)
  const [suggestions, setSuggestions] = useState<MentionUser[]>([])
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const closeSuggestions = useCallback(() => {
    setIsOpen(false)
    setMentionActive(false)
    setSuggestions([])
    setMentionStart(null)
    setActiveIndex(0)
    setDropdownPosition(null)
  }, [])

  const updateDropdownPosition = useCallback(() => {
    const input = inputRef.current
    if (!input) return

    const rect = input.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_GAP
    const spaceAbove = rect.top - DROPDOWN_GAP
    const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow
    const availableSpace = openUpward ? spaceAbove : spaceBelow
    const maxHeight = Math.min(
      DROPDOWN_MAX_HEIGHT,
      Math.max(availableSpace - 8, 96)
    )

    setDropdownPosition({
      left: rect.left,
      width: Math.max(rect.width, 220),
      maxHeight,
      top: openUpward
        ? Math.max(DROPDOWN_GAP, rect.top - DROPDOWN_GAP - maxHeight)
        : rect.bottom + DROPDOWN_GAP,
    })
  }, [])

  const searchUsers = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/users/search?q=${encodeURIComponent(query)}&limit=20`
      )
      if (!response.ok) {
        closeSuggestions()
        return
      }
      const data = await response.json()
      const users = (data.users ?? []) as MentionUser[]
      setSuggestions(users)
      setActiveIndex(0)
      setIsOpen(true)
    } catch {
      closeSuggestions()
    } finally {
      setLoading(false)
    }
  }, [closeSuggestions])

  const updateMentionSuggestions = useCallback(
    (nextValue: string, cursorPosition: number) => {
      const activeMention = getActiveMentionQuery(nextValue, cursorPosition)
      if (!activeMention) {
        closeSuggestions()
        return
      }

      setMentionStart(activeMention.start)
      setMentionActive(true)
      setIsOpen(true)
      void searchUsers(activeMention.query)
    },
    [closeSuggestions, searchUsers]
  )

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const nextValue = event.target.value
    onChange(nextValue)
    updateMentionSuggestions(nextValue, event.target.selectionStart ?? nextValue.length)
  }

  const selectSuggestion = useCallback(
    (user: MentionUser) => {
      const mentionLabel = getMentionLabel(user)
      if (!mentionLabel || mentionStart === null) return

      const input = inputRef.current
      const cursorPosition = input?.selectionStart ?? value.length
      const next = insertMention(value, mentionStart, cursorPosition, mentionLabel)

      onChange(next.value)
      closeSuggestions()

      requestAnimationFrame(() => {
        input?.focus()
        input?.setSelectionRange(next.cursorPosition, next.cursorPosition)
      })
    },
    [closeSuggestions, mentionStart, onChange, value]
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (isOpen && suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((index) => (index + 1) % suggestions.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        selectSuggestion(suggestions[activeIndex])
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        closeSuggestions()
        return
      }
    }

    onKeyDown?.(event)
  }

  useEffect(() => {
    if (!isOpen || !mentionActive) return

    updateDropdownPosition()

    const handleReposition = () => updateDropdownPosition()
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)

    return () => {
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [isOpen, mentionActive, suggestions.length, loading, updateDropdownPosition])

  useEffect(() => {
    if (!isOpen || suggestions.length === 0) return

    const activeItem = listRef.current?.children[activeIndex] as HTMLElement | undefined
    activeItem?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, isOpen, suggestions.length])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (containerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      closeSuggestions()
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [closeSuggestions])

  const sharedProps = {
    ref: inputRef as never,
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    disabled,
    className: cn(className),
    ...props,
  }

  const dropdown =
    isOpen && mentionActive && dropdownPosition && mounted
      ? createPortal(
          <div
            ref={(node) => {
              dropdownRef.current = node
              listRef.current = node
            }}
            className="fixed z-[200] overflow-y-auto overscroll-contain rounded-md border bg-popover text-popover-foreground shadow-md [scrollbar-gutter:stable]"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              maxHeight: dropdownPosition.maxHeight,
            }}
          >
            {loading && suggestions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Поиск...</div>
            ) : suggestions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Пользователи не найдены
              </div>
            ) : (
              suggestions.map((user, index) => (
                <button
                  key={user.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
                    index === activeIndex && 'bg-accent'
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    selectSuggestion(user)
                  }}
                >
                  <span className="font-medium">
                    {user.display_name || user.username}
                  </span>
                  {user.username && (
                    <span className="text-muted-foreground">@{user.username}</span>
                  )}
                </button>
              ))
            )}
          </div>,
          document.body
        )
      : null

  return (
    <>
      <div ref={containerRef} className="relative flex-1 min-w-0">
        {multiline ? (
          <Textarea {...sharedProps} />
        ) : (
          <Input {...sharedProps} />
        )}
      </div>
      {dropdown}
    </>
  )
}
