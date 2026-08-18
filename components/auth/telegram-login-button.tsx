'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { providerIcons } from '@/components/auth/provider-icons'

const WIDGET_SRC = 'https://telegram.org/js/telegram-widget.js?22'

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
    Telegram?: {
      Login?: {
        auth: (
          options: { bot_id: string; request_access?: string; lang?: string },
          callback: (user: TelegramUser | false) => void
        ) => void
      }
    }
  }
}

// Uses Telegram's JS auth popup (Telegram.Login.auth) instead of the embedded
// iframe widget, so the button matches the design of the other OAuth buttons.
export function TelegramLoginButton({
  botId,
  callbackUrl,
  label,
  disabled,
  onError,
}: {
  botId: string
  callbackUrl: string
  label: string
  disabled?: boolean
  onError?: (message: string | null) => void
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (window.Telegram?.Login) {
      setReady(true)
      return
    }

    let script = document.querySelector<HTMLScriptElement>(`script[src="${WIDGET_SRC}"]`)
    const onLoad = () => setReady(true)

    if (!script) {
      script = document.createElement('script')
      script.src = WIDGET_SRC
      script.async = true
      document.body.appendChild(script)
    }
    script.addEventListener('load', onLoad)
    if (window.Telegram?.Login) setReady(true)

    return () => script?.removeEventListener('load', onLoad)
  }, [])

  function handleClick() {
    if (!window.Telegram?.Login) {
      onError?.('Telegram ещё загружается, попробуйте ещё раз.')
      return
    }
    onError?.(null)

    window.Telegram.Login.auth({ bot_id: botId }, async (user) => {
      if (!user) {
        onError?.('Вход через Telegram отменён.')
        return
      }

      const result = await signIn('telegram', { ...user, redirect: false })
      if (result?.error) {
        onError?.('Не удалось войти через Telegram. Попробуйте ещё раз.')
        return
      }

      window.location.href = callbackUrl
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full cursor-pointer"
      onClick={handleClick}
      disabled={disabled || !ready}
    >
      {providerIcons.telegram}
      <span className="ml-2">{label}</span>
    </Button>
  )
}
