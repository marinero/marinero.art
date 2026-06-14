'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  Music, 
  ChevronRight,
  Video,
  Headphones,
  MessageSquare,
} from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import Link from 'next/link'
import { adminRehearsalUrl, rehearsalDateSlug } from '@/lib/rehearsal-url'

interface Rehearsal {
  id: string
  rehearsal_date: string
  created_at: string
  videos_count: number
  audio_files_count: number
  multitrack_groups_count: number
  comments_count: number
}

function RehearsalStat({
  icon: Icon,
  count,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  count: number
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{count}</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}

export default function RehearsalsPage() {
  const searchParams = useSearchParams()
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(searchParams.get('create') === 'true')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)

  useEffect(() => {
    loadRehearsals()
  }, [])

  async function loadRehearsals() {
    setLoading(true)

    const response = await fetch('/api/admin/rehearsals')
    if (!response.ok) {
      setLoading(false)
      return
    }

    const data = await response.json()
    setRehearsals(data.rehearsals || [])
    setLoading(false)
  }

  async function createRehearsal() {
    if (!selectedDate) return

    const response = await fetch('/api/admin/rehearsals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rehearsal_date: format(selectedDate, 'yyyy-MM-dd'),
      }),
    })

    if (!response.ok) {
      alert('Ошибка создания репетиции')
      return
    }

    setIsCreating(false)
    setSelectedDate(undefined)
    loadRehearsals()
  }

  async function deleteRehearsal(rehearsal: Rehearsal) {
    if (!confirm('Удалить репетицию и все связанные файлы?')) return

    const response = await fetch(
      `/api/admin/rehearsals/${encodeURIComponent(rehearsalDateSlug(rehearsal.rehearsal_date))}`,
      {
        method: 'DELETE',
      }
    )

    if (!response.ok) {
      alert('Ошибка удаления')
      return
    }

    loadRehearsals()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Репетиции</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">История репетиций и аудиозаписей</p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Добавить репетицию
        </Button>
      </div>

      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Новая репетиция</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Дата репетиции</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full md:w-[300px] justify-start text-left font-normal ${!selectedDate && 'text-muted-foreground'}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'd MMMM yyyy', { locale: ru }) : 'Выберите дату'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                    locale={ru}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex gap-2">
              <Button onClick={createRehearsal} disabled={!selectedDate}>
                Создать
              </Button>
              <Button variant="outline" onClick={() => { setIsCreating(false); setSelectedDate(undefined) }}>
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {rehearsals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Нет репетиций. Создайте первую!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rehearsals.map((rehearsal) => (
            <Card key={rehearsal.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold">
                          {format(new Date(rehearsal.rehearsal_date), 'd MMMM yyyy', { locale: ru })}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                          <RehearsalStat icon={Video} count={rehearsal.videos_count} label="видео" />
                          <RehearsalStat icon={Music} count={rehearsal.audio_files_count} label="аудио" />
                          <RehearsalStat icon={Headphones} count={rehearsal.multitrack_groups_count} label="мультитреков" />
                          <RehearsalStat icon={MessageSquare} count={rehearsal.comments_count} label="комментариев" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:ml-4 sm:flex-shrink-0">
                    <Link href={adminRehearsalUrl(rehearsal.rehearsal_date)} className="flex-1 sm:flex-initial">
                      <Button variant="outline" size="sm" className="gap-1 w-full sm:w-auto">
                        Открыть
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive flex-shrink-0"
                      onClick={() => deleteRehearsal(rehearsal)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
