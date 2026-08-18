import { NextResponse } from 'next/server'

// Runtime config for social buttons that need client-side values.
// Reading env here (instead of NEXT_PUBLIC_*) keeps it correct in Docker,
// where the client bundle is built without runtime secrets available.
export const dynamic = 'force-dynamic'

export function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  // bot_id is the public numeric prefix of the token; safe to expose to the client.
  const telegramBotId = token ? token.split(':')[0] : null

  return NextResponse.json({
    telegramBotId,
    telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? null,
  })
}
