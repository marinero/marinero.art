'use client'

import { useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'

type TelegramUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void
  }
}

export function TelegramLoginButton({
  botUsername,
  callbackUrl,
  disabled,
  onError,
}: {
  botUsername: string
  callbackUrl: string
  disabled?: boolean
  onError?: (message: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.onTelegramAuth = async (user: TelegramUser) => {
      const result = await signIn('telegram', {
        ...user,
        redirect: false,
      })

      if (result?.error) {
        onError?.('Не удалось войти через Telegram. Попробуйте ещё раз.')
        return
      }

      window.location.href = callbackUrl
    }

    const container = containerRef.current
    if (!container) return

    container.innerHTML = ''
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-userpic', 'false')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    container.appendChild(script)

    return () => {
      container.innerHTML = ''
      delete window.onTelegramAuth
    }
  }, [botUsername, callbackUrl, onError])

  return (
    <div
      ref={containerRef}
      className="flex justify-center [color-scheme:light]"
      aria-disabled={disabled}
      style={disabled ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
    />
  )
}
