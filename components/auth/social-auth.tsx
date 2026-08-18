'use client'

import { useEffect, useState } from 'react'
import { getProviders, signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { providerIcons } from '@/components/auth/provider-icons'
import { TelegramLoginButton } from '@/components/auth/telegram-login-button'

type Mode = 'login' | 'signup'

// Order defines how the buttons are rendered on the auth pages.
const OAUTH_PROVIDERS = [
  { id: 'google', name: 'Google' },
  { id: 'apple', name: 'Apple' },
  { id: 'vk', name: 'VK' },
  { id: 'yandex', name: 'Yandex' },
  { id: 'spotify', name: 'Spotify' },
  { id: 'facebook', name: 'Facebook' },
] as const

function label(mode: Mode, name: string) {
  return mode === 'login' ? `Войти через ${name}` : `Продолжить с ${name}`
}

export function SocialAuth({
  callbackUrl,
  mode,
  disabled,
  onError,
}: {
  callbackUrl: string
  mode: Mode
  disabled?: boolean
  onError?: (message: string | null) => void
}) {
  const [available, setAvailable] = useState<Set<string>>(new Set())
  const [telegramBotId, setTelegramBotId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getProviders().then((providers) => {
      setAvailable(new Set(Object.keys(providers ?? {})))
    })
    fetch('/api/auth/social-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTelegramBotId(data?.telegramBotId ?? null))
      .catch(() => setTelegramBotId(null))
  }, [])

  const enabledOAuth = OAUTH_PROVIDERS.filter((p) => available.has(p.id))
  const hasTelegram = available.has('telegram') && !!telegramBotId
  const hasAny = enabledOAuth.length > 0 || hasTelegram

  if (!hasAny) return null

  async function handleOAuth(providerId: string) {
    onError?.(null)
    setLoading(true)
    await signIn(providerId, { callbackUrl })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {enabledOAuth.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            variant="outline"
            className="w-full cursor-pointer"
            onClick={() => handleOAuth(provider.id)}
            disabled={disabled || loading}
          >
            {providerIcons[provider.id]}
            <span className="ml-2">{label(mode, provider.name)}</span>
          </Button>
        ))}

        {hasTelegram && (
          <TelegramLoginButton
            botId={telegramBotId!}
            callbackUrl={callbackUrl}
            label={label(mode, 'Telegram')}
            disabled={disabled || loading}
            onError={(message) => onError?.(message)}
          />
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">или по email</span>
        </div>
      </div>
    </div>
  )
}
