import crypto from 'crypto'

export type TelegramAuthData = Record<string, string>

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60

/**
 * Verifies the payload returned by the Telegram Login Widget.
 * See https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramAuth(data: TelegramAuthData, botToken: string): boolean {
  const { hash, ...fields } = data
  if (!hash || !botToken) return false

  const dataCheckString = Object.keys(fields)
    .filter((key) => fields[key] !== undefined && fields[key] !== '')
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const expected = Buffer.from(computedHash, 'hex')
  const received = Buffer.from(hash, 'hex')
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return false
  }

  const authDate = Number(fields.auth_date)
  if (!Number.isFinite(authDate)) return false
  if (Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) return false

  return true
}
