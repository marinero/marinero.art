import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({ segments: ['Ошибка авторизации'] })

const ERROR_MESSAGES: Record<string, string> = {
  OAuthNoEmail:
    'Провайдер не передал email, поэтому мы не смогли создать аккаунт. Разрешите доступ к email или войдите другим способом.',
  OAuthAccountNotLinked:
    'Этот email уже привязан к другому способу входа. Войдите тем способом, который использовали раньше.',
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const message =
    (error && ERROR_MESSAGES[error]) ||
    'Произошла ошибка при попытке входа. Возможно, ссылка устарела или недействительна.'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle>Ошибка авторизации</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{message}</p>
          <div className="flex flex-col gap-2">
            <Link href="/auth/login">
              <Button className="w-full">Попробовать снова</Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="w-full">На главную</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
