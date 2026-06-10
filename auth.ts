import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { authConfig } from '@/auth.config'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

async function loadUserRole(userId: string): Promise<string> {
  const profile = await db.queryOne<{ role: string }>(
    'SELECT role FROM profiles WHERE id = $1',
    [userId]
  )
  return profile?.role ?? 'fan'
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
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider !== 'google' || !user.email) {
        return true
      }

      const email = user.email.trim().toLowerCase()

      const existing = await db.queryOne<{ id: string }>(
        'SELECT id FROM users WHERE lower(email) = $1',
        [email]
      )

      if (existing) {
        user.id = existing.id
        return true
      }

      const created = await db.queryOne<{ id: string }>(
        `INSERT INTO users (email, email_verified)
         VALUES ($1, true)
         RETURNING id`,
        [email]
      )

      if (!created) return false

      await db.query(
        `INSERT INTO profiles (id, display_name, role)
         VALUES ($1, $2, 'fan')`,
        [created.id, user.name ?? email]
      )

      user.id = created.id
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
