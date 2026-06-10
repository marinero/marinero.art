import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
    newUser: '/auth/sign-up-success',
  },
  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60,
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id
        if (user.role) token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      if (!nextUrl.pathname.startsWith('/admin')) {
        return true
      }

      if (!auth?.user) {
        return false
      }

      if (auth.user.role !== 'admin') {
        return Response.redirect(new URL('/', nextUrl))
      }

      return true
    },
  },
} satisfies NextAuthConfig
