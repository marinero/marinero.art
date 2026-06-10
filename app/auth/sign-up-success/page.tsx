import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mail } from 'lucide-react'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({ segments: ['Регистрация', 'Проверьте почту'] })

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <Link href="/" className="flex justify-center mb-4">
            <Image
              src="/images/marinero/marinero_logo.png"
              alt="MARINERO"
              width={60}
              height={60}
              className="rounded-xl"
            />
          </Link>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-display">Проверьте почту</CardTitle>
          <CardDescription className="text-base">
            Мы отправили вам письмо с ссылкой для подтверждения аккаунта
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            После подтверждения вы сможете комментировать фото и участвовать в жизни сообщества MARINERO
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/">
            <Button variant="outline">
              Вернуться на главную
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
