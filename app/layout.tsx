import type { Metadata, Viewport } from 'next'
import { Inter, Bebas_Neue } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthSessionProvider } from '@/components/providers/session-provider'
import { SITE_TITLE } from '@/lib/metadata'
import './globals.css'

const inter = Inter({ 
  subsets: ["latin", "cyrillic"],
  variable: '--font-sans'
});

const bebasNeue = Bebas_Neue({ 
  weight: '400',
  subsets: ["latin"],
  variable: '--font-logo'
});

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: `${SITE_TITLE} - %s`,
  },
  description: 'Официальный сайт рок-группы MARINERO. Концерты, фото, музыка.',
  keywords: ['MARINERO', 'rock band', 'рок группа', 'концерты', 'музыка'],
  authors: [{ name: 'MARINERO' }],
  openGraph: {
    title: SITE_TITLE,
    description: 'Официальный сайт рок-группы MARINERO',
    type: 'website',
    locale: 'ru_RU',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a1a2e',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className="dark">
      <body className={`${inter.variable} ${bebasNeue.variable} font-sans antialiased bg-background text-foreground`}>
        <AuthSessionProvider>
          {children}
        </AuthSessionProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
