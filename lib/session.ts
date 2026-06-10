import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function getSessionUser() {
  const session = await auth()

  if (!session?.user?.id) {
    return { user: null, isAdmin: false, displayName: null as string | null }
  }

  const profile = await db.queryOne<{ role: string; display_name: string | null }>(
    'SELECT role, display_name FROM profiles WHERE id = $1',
    [session.user.id]
  )

  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? undefined,
    },
    isAdmin: profile?.role === 'admin' || session.user.role === 'admin',
    displayName: profile?.display_name ?? session.user.name ?? null,
  }
}
