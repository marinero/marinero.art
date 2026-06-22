'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ProfileNav } from '@/components/profile/profile-nav'
import { User, Mail, LogOut, Save, Loader2 } from 'lucide-react'
import type { Profile } from '@/lib/types'

export default function ProfilePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status !== 'authenticated') return

    async function fetchProfile() {
      const response = await fetch('/api/profile')
      if (!response.ok) {
        router.push('/auth/login')
        return
      }

      const data = await response.json()
      setProfile(data.profile)
      setFormData({
        display_name: data.profile.display_name || '',
        username: data.profile.username || '',
      })
      setLoading(false)
    }

    fetchProfile()
  }, [status, router])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user) return

    setSaving(true)

    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: formData.display_name,
        username: formData.username || null,
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      alert(data.error || 'Ошибка сохранения')
    } else {
      const data = await response.json()
      setProfile(data.profile)
    }

    setSaving(false)
  }

  async function handleSignOut() {
    await signOut({ callbackUrl: '/' })
  }

  const user = session?.user
    ? { id: session.user.id, email: session.user.email ?? undefined }
    : null

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} isAdmin={profile?.role === 'admin'} displayName={profile?.display_name} />

      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Профиль</h1>
            <p className="text-muted-foreground">Управление вашим аккаунтом</p>
          </div>

          <ProfileNav />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Личные данные
              </CardTitle>
              <CardDescription>
                Обновите информацию о себе
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </label>
                  <Input
                    value={user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email нельзя изменить
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Отображаемое имя</label>
                  <Input
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="Как вас называть?"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Имя пользователя</label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="username"
                  />
                  <p className="text-xs text-muted-foreground">
                    Уникальное имя для вашего профиля
                  </p>
                </div>

                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Сохранить
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Статус аккаунта</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Роль</p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.role === 'admin' ? 'Администратор' : 'Фанат'}
                  </p>
                </div>
                {profile?.role === 'admin' && (
                  <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded">
                    Admin
                  </span>
                )}
              </div>

              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={handleSignOut}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Выйти из аккаунта
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}
