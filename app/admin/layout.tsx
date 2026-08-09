import { auth } from '@/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/sidebar'
import { EnvironmentIndicator } from '@/components/admin/environment-indicator'
import { AccessDenied } from '@/components/layout/access-denied'
import { getSystemInfo } from '@/lib/system-info'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  segments: ['Админ'],
  description: 'Управление контентом портала MARINERO',
})

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/auth/login?redirect=/admin')
  }

  const profile = await db.queryOne<{ role: string; display_name: string | null }>(
    'SELECT role, display_name FROM profiles WHERE id = $1',
    [session.user.id]
  )

  if (profile?.role !== 'admin') {
    return (
      <AccessDenied
        user={{ id: session.user.id, email: session.user.email ?? undefined }}
        displayName={profile?.display_name ?? session.user.name ?? null}
      />
    )
  }

  const systemInfo = await getSystemInfo()

  return (
    <div className="min-h-screen flex">
      <AdminSidebar userName={profile?.display_name || session.user.email || 'Admin'} />
      <main className="relative flex-1 pt-16 px-4 pb-6 lg:pt-8 lg:px-8 lg:pb-8 bg-background ml-0 lg:ml-64">
        <EnvironmentIndicator info={systemInfo} />
        {children}
      </main>
    </div>
  )
}
