'use client'

import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  UserCircle, 
  Mail, 
  Calendar, 
  Clock, 
  MessageSquare,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'

interface UserDetails {
  id: string
  username: string | null
  display_name: string | null
  role: string
  email: string | null
  email_confirmed: boolean
  created_at: string
  last_sign_in_at: string | null
  comment_count: number
}

interface AdminUserHoverCardProps {
  userId: string
  userName: string
  userRole?: string
  isAdmin: boolean
  children: React.ReactNode
}

export function AdminUserHoverCard({ 
  userId, 
  userName, 
  userRole, 
  isAdmin, 
  children 
}: AdminUserHoverCardProps) {
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUserDetails = useCallback(async () => {
    if (!isAdmin || userDetails || loading) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/admin/users/${userId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch user details')
      }
      const data = await response.json()
      setUserDetails(data.user)
    } catch (err) {
      setError('Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }, [userId, isAdmin, userDetails, loading])

  // If not admin, just render the children without hover functionality
  if (!isAdmin) {
    return <>{children}</>
  }

  return (
    <HoverCard openDelay={300} closeDelay={100} onOpenChange={(open) => {
      if (open) {
        fetchUserDetails()
      }
    }}>
      <HoverCardTrigger asChild>
        <span className="cursor-pointer hover:underline">
          {children}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {error && (
          <div className="text-sm text-destructive py-2">{error}</div>
        )}
        
        {userDetails && !loading && (
          <div className="space-y-3">
            {/* Header with name and role */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">
                  {userDetails.display_name || 'Без имени'}
                </p>
                {userDetails.username && (
                  <p className="text-xs text-muted-foreground">
                    @{userDetails.username}
                  </p>
                )}
              </div>
              {userDetails.role === 'admin' ? (
                <Badge variant="default" className="gap-1 text-xs">
                  <Shield className="h-3 w-3" />
                  Админ
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <UserCircle className="h-3 w-3" />
                  Участник
                </Badge>
              )}
            </div>

            {/* Email */}
            {userDetails.email && (
              <div className="flex items-start gap-2 text-xs">
                <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground break-all">
                  {userDetails.email}
                </span>
              </div>
            )}

            {/* Confirmation status */}
            <div className="flex items-center gap-2 text-xs">
              {userDetails.email_confirmed ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  <span className="text-green-500">Подтвержден</span>
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                  <span className="text-amber-500">Не подтвержден</span>
                </>
              )}
            </div>

            {/* Registration date */}
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">
                Регистрация: {format(new Date(userDetails.created_at), 'd MMM yyyy', { locale: ru })}
              </span>
            </div>

            {/* Last sign in */}
            <div className="flex items-center gap-2 text-xs">
              <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">
                Последний вход: {userDetails.last_sign_in_at 
                  ? format(new Date(userDetails.last_sign_in_at), 'd MMM yyyy, HH:mm', { locale: ru })
                  : 'Никогда'
                }
              </span>
            </div>

            {/* Comment count */}
            <div className="flex items-center gap-2 text-xs">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">
                Комментариев: {userDetails.comment_count}
              </span>
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
