'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getProviders, signIn } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

export default function SignUpPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [hasGoogle, setHasGoogle] = useState(false)
  const router = useRouter()

  useEffect(() => {
    getProviders().then((providers) => {
      setHasGoogle(!!providers?.google)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        displayName: displayName.trim(),
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      setError(data.error || 'Ошибка регистрации')
      setLoading(false)
      return
    }

    const signInResult = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    })

    if (signInResult?.error) {
      router.push('/auth/sign-up-success')
      return
    }

    router.push('/')
    router.refresh()
  }

  async function handleGoogleSignUp() {
    setError(null)
    setOauthLoading(true)

    const providers = await getProviders()
    if (!providers?.google) {
      setError('Google OAuth не настроен. Добавьте GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET в .env.local и перезапустите сервер.')
      setOauthLoading(false)
      return
    }

    await signIn('google', { callbackUrl: '/' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="flex justify-center mb-4">
            <Image
              src="/images/marinero/marinero_logo.png"
              alt="MARINERO"
              width={60}
              height={60}
              className="rounded-xl"
            />
          </Link>
          <CardTitle className="text-2xl font-[family-name:var(--font-logo)] tracking-wide">Регистрация</CardTitle>
          <CardDescription>
            Присоединяйтесь к фанатам MARINERO
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {hasGoogle && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full cursor-pointer"
                onClick={handleGoogleSignUp}
                disabled={loading || oauthLoading}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="ml-2">Продолжить с Google</span>
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    или по email
                  </span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Имя</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Как вас зовут?"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="Минимум 6 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full cursor-pointer" disabled={loading || oauthLoading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Зарегистрироваться
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground text-center">
            Уже есть аккаунт?{' '}
            <Link href="/auth/login" className="text-primary hover:underline">
              Войти
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
