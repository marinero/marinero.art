import { NextResponse } from 'next/server'

// Runtime config for social buttons that need client-side values.
// Reading env here (instead of NEXT_PUBLIC_*) keeps it correct in Docker,
// where the client bundle is built without runtime secrets available.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({
    telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? null,
  })
}
