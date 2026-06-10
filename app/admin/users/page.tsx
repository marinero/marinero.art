'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Users, 
  Search, 
  Shield, 
  ShieldOff, 
  Mail,
  MailWarning,
  Send,
  Calendar,
  UserCircle,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface UserWithProfile {
  id: string
  email: string
  email_confirmed_at: string | null
  display_name: string | null
  avatar_url: string | null
  role: 'fan' | 'admin'
  created_at: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all')
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      const response = await fetch('/api/admin/users')
      const data = await response.json()
      
      if (data.users) {
        // Sort by created_at descending
        const sorted = data.users.sort((a: UserWithProfile, b: UserWithProfile) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        setUsers(sorted)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
    setLoading(false)
  }

  async function resendConfirmation(email: string) {
    setSendingEmail(email)
    try {
      const response = await fetch('/api/admin/users/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      
      if (response.ok) {
        alert('Письмо с подтверждением отправлено')
      } else {
        const data = await response.json()
        alert(`Ошибка: ${data.error}`)
      }
    } catch (error) {
      console.error('Error resending confirmation:', error)
      alert('Ошибка отправки письма')
    }
    setSendingEmail(null)
  }

  async function toggleRole(user: UserWithProfile) {
    const newRole = user.role === 'admin' ? 'fan' : 'admin'

    if (user.role === 'admin' && !confirm(`Снять права администратора с ${user.display_name || user.email}?`)) {
      return
    }

    if (user.role !== 'admin' && !confirm(`Назначить ${user.display_name || user.email} администратором?`)) {
      return
    }

    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })

    if (!response.ok) {
      console.error('Error updating role')
      alert('Ошибка обновления роли')
      return
    }

    fetchUsers()
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.display_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    
    const matchesRole = roleFilter === 'all' || 
      (roleFilter === 'admin' ? user.role === 'admin' : user.role !== 'admin')
    
    return matchesSearch && matchesRole
  })

  const adminCount = users.filter(u => u.role === 'admin').length
  const userCount = users.filter(u => u.role !== 'admin').length

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Пользователи</h1>
        <p className="text-muted-foreground">Управление пользователями и ролями</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{users.length}</p>
              <p className="text-sm text-muted-foreground">Всего пользователей</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-amber-500/10">
              <Shield className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{adminCount}</p>
              <p className="text-sm text-muted-foreground">Администраторов</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-500/10">
              <UserCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{userCount}</p>
              <p className="text-sm text-muted-foreground">Обычных пользователей</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени или email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={roleFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('all')}
          >
            Все
          </Button>
          <Button
            variant={roleFilter === 'admin' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('admin')}
            className="gap-1"
          >
            <Shield className="h-4 w-4" />
            Админы
          </Button>
          <Button
            variant={roleFilter === 'user' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter('user')}
            className="gap-1"
          >
            <UserCircle className="h-4 w-4" />
            Пользователи
          </Button>
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {searchQuery || roleFilter !== 'all' 
                ? 'Пользователи не найдены' 
                : 'Нет зарегистрированных пользователей'}
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {user.avatar_url ? (
                        <img 
                          src={user.avatar_url} 
                          alt={user.display_name || 'User'} 
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <UserCircle className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm sm:text-base">
                          {user.display_name || 'Без имени'}
                        </span>
                        {user.role === 'admin' && (
                          <span className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-full">
                            <Shield className="h-2.5 w-2.5" />
                            Админ
                          </span>
                        )}
                        {user.email_confirmed_at ? (
                          <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded-full">
                            <CheckCircle className="h-2.5 w-2.5" />
                            <span className="hidden sm:inline">Подтверждён</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-full">
                            <MailWarning className="h-2.5 w-2.5" />
                            <span className="hidden sm:inline">Не подтверждён</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          {format(new Date(user.created_at), 'd MMM yyyy', { locale: ru })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {!user.email_confirmed_at && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resendConfirmation(user.email)}
                        disabled={sendingEmail === user.email}
                        className="gap-1 text-xs sm:text-sm flex-1 sm:flex-initial"
                      >
                        {sendingEmail === user.email ? (
                          <>
                            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                            <span className="hidden sm:inline">Отправка...</span>
                          </>
                        ) : (
                          <>
                            <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="sm:hidden">Письмо</span>
                            <span className="hidden sm:inline">Отправить подтверждение</span>
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleRole(user)}
                      className="gap-1 text-xs sm:text-sm flex-1 sm:flex-initial"
                    >
                      {user.role === 'admin' ? (
                        <>
                          <ShieldOff className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="sm:hidden">Снять</span>
                          <span className="hidden sm:inline">Снять админа</span>
                        </>
                      ) : (
                        <>
                          <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="sm:hidden">Админ</span>
                          <span className="hidden sm:inline">Сделать админом</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
