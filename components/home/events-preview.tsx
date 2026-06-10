import { db } from '@/lib/db'
import type { Event } from '@/lib/types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Calendar, MapPin, Ticket, ArrowRight, MessageCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export async function EventsPreview() {
  const events = await db.queryMany<Event>(
    `SELECT * FROM events
     WHERE is_published = true AND event_date >= NOW()
     ORDER BY event_date
     LIMIT 3`
  )

  const eventIds = events.map((e) => e.id)
  const commentCounts = new Map<string, number>()

  if (eventIds.length > 0) {
    const counts = await db.queryMany<{ object_id: string }>(
      `SELECT object_id FROM comments
       WHERE type = 'event' AND object_id = ANY($1::uuid[])`,
      [eventIds]
    )

    counts.forEach((c) => {
      commentCounts.set(c.object_id, (commentCounts.get(c.object_id) || 0) + 1)
    })
  }

  const upcomingEvents: Event[] = events.map((e) => ({
    ...e,
    comment_count: commentCounts.get(e.id) || 0,
  }))

  if (upcomingEvents.length === 0) {
    return null
  }

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">
              Ближайшие концерты
            </h2>
            <p className="text-muted-foreground">
              Приходите на наши выступления
            </p>
          </div>
          <Link href="/events" className="hidden md:block">
            <Button variant="outline" className="gap-2">
              Все концерты
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-6">
          {upcomingEvents.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.slug}`}
              className="flex flex-col md:flex-row items-start md:items-center gap-6 p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
            >
              {/* Date */}
              <div className="flex-shrink-0 w-20 h-20 rounded-xl bg-primary/10 flex flex-col items-center justify-center text-primary">
                <span className="text-2xl font-bold">
                  {format(new Date(event.event_date), 'd', { locale: ru })}
                </span>
                <span className="text-sm uppercase">
                  {format(new Date(event.event_date), 'MMM', { locale: ru })}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">{event.title}</h3>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    <span>{event.venue}, {event.city}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(event.event_date), 'HH:mm', { locale: ru })}
                    </span>
                  </div>
                  {(event.comment_count ?? 0) > 0 && (
                    <div className="flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4" />
                      <span>{event.comment_count}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action */}
              {event.ticket_url && (
                <div className="flex-shrink-0 md:pr-4">
                  <Button className="gap-2">
                    <Ticket className="h-4 w-4" />
                    Билеты
                  </Button>
                </div>
              )}
            </Link>
          ))}
        </div>

        <div className="mt-8 md:hidden text-center">
          <Link href="/events">
            <Button variant="outline" className="gap-2">
              Все концерты
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
