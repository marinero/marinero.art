import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import Apple from 'next-auth/providers/apple'
import Facebook from 'next-auth/providers/facebook'
import Spotify from 'next-auth/providers/spotify'
import VK from 'next-auth/providers/vk'
import Yandex from 'next-auth/providers/yandex'
import type { Provider } from 'next-auth/providers'
import { authConfig } from '@/auth.config'
import { db } from '@/lib/db'
import { verifyTelegramAuth, type TelegramAuthData } from '@/lib/telegram-auth'
import bcrypt from 'bcryptjs'

async function loadUserRole(userId: string): Promise<string> {
  const profile = await db.queryOne<{ role: string }>(
    'SELECT role FROM profiles WHERE id = $1',
    [userId]
  )
  return profile?.role ?? 'fan'
}

/**
 * Finds a user by email or creates a new fan account + profile.
 * Shared by OAuth sign-in and the Telegram provider.
 */
async function findOrCreateUser(email: string, displayName: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase()

  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM users WHERE lower(email) = $1',
    [normalizedEmail]
  )
  if (existing) return existing.id

  const created = await db.queryOne<{ id: string }>(
    `INSERT INTO users (email, email_verified)
     VALUES ($1, true)
     RETURNING id`,
    [normalizedEmail]
  )
  if (!created) return null

  await db.query(
    `INSERT INTO profiles (id, display_name, role)
     VALUES ($1, $2, 'fan')`,
    [created.id, displayName || normalizedEmail]
  )

  return created.id
}

/**
 * OAuth providers are only registered when their credentials are present in the
 * environment, so the app keeps working before each provider is configured.
 */
function buildOAuthProviders(): Provider[] {
  const providers: Provider[] = []

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    )
  }

  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
    providers.push(
      Apple({
        clientId: process.env.APPLE_CLIENT_ID,
        clientSecret: process.env.APPLE_CLIENT_SECRET,
      })
    )
  }

  if (process.env.VK_CLIENT_ID && process.env.VK_CLIENT_SECRET) {
    providers.push(
      VK({
        clientId: process.env.VK_CLIENT_ID,
        clientSecret: process.env.VK_CLIENT_SECRET,
      })
    )
  }

  if (process.env.YANDEX_CLIENT_ID && process.env.YANDEX_CLIENT_SECRET) {
    providers.push(
      Yandex({
        clientId: process.env.YANDEX_CLIENT_ID,
        clientSecret: process.env.YANDEX_CLIENT_SECRET,
      })
    )
  }

  if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    providers.push(
      Spotify({
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      })
    )
  }

  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    providers.push(
      Facebook({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      })
    )
  }

  return providers
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = String(credentials.email).trim().toLowerCase()

        const user = await db.queryOne<{
          id: string
          email: string
          password_hash: string | null
          email_verified: boolean
        }>(
          'SELECT id, email, password_hash, email_verified FROM users WHERE lower(email) = $1',
          [email]
        )

        if (!user || !user.password_hash) return null
        if (!user.email_verified) return null

        const valid = await bcrypt.compare(String(credentials.password), user.password_hash)
        if (!valid) return null

        const profile = await db.queryOne<{ role: string; display_name: string | null }>(
          'SELECT role, display_name FROM profiles WHERE id = $1',
          [user.id]
        )

        return {
          id: user.id,
          email: user.email,
          name: profile?.display_name ?? user.email,
          role: profile?.role ?? 'fan',
        }
      },
    }),
    ...(process.env.TELEGRAM_BOT_TOKEN
      ? [
          Credentials({
            id: 'telegram',
            name: 'Telegram',
            credentials: {
              id: {},
              first_name: {},
              last_name: {},
              username: {},
              photo_url: {},
              auth_date: {},
              hash: {},
            },
            async authorize(raw) {
              // Only keep fields signed by Telegram — the POST body also carries
              // NextAuth extras (csrfToken, callbackUrl) that would break the hash.
              const source = raw as Record<string, unknown>
              const data: TelegramAuthData = {}
              for (const key of ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash']) {
                const value = source[key]
                if (typeof value === 'string' && value !== '') data[key] = value
              }

              if (!verifyTelegramAuth(data, process.env.TELEGRAM_BOT_TOKEN!)) return null
              if (!data.id) return null

              // Telegram never provides an email, so we derive a stable synthetic one.
              const email = `tg${data.id}@telegram.marinero.art`
              const displayName =
                [data.first_name, data.last_name].filter(Boolean).join(' ').trim() ||
                data.username ||
                `Telegram ${data.id}`

              const userId = await findOrCreateUser(email, displayName)
              if (!userId) return null

              return {
                id: userId,
                email,
                name: displayName,
                role: await loadUserRole(userId),
              }
            },
          }),
        ]
      : []),
    ...buildOAuthProviders(),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // Credentials-based flows (email/password, Telegram) already resolved the user.
      if (!account || account.type === 'credentials') {
        return true
      }

      // Every OAuth provider we support returns a verified email; block otherwise
      // so we never create an account we can't link back to a user.
      if (!user.email) {
        return '/auth/error?error=OAuthNoEmail'
      }

      const userId = await findOrCreateUser(user.email, user.name ?? user.email)
      if (!userId) return false

      user.id = userId
      return true
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id
        token.role = user.role ?? (await loadUserRole(user.id))
      }
      return token
    },
  },
})
