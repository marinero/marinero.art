import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import type { Event } from '@/lib/types'
import { Calendar, MapPin, Ticket, Clock, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import Link from 'next/link'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  segments: ['Концерты'],
  description: 'Расписание концертов и выступлений группы MARINERO',
})

export default async function EventsPage() {
  const { user, isAdmin, displayName } = await getSessionUser()

  const upcomingEvents = await db.queryMany<Event>(
    `SELECT * FROM events
     WHERE is_published = true AND event_date >= NOW()
     ORDER BY event_date ASC`
  )

  const pastEvents = await db.queryMany<Event>(
    `SELECT * FROM events
     WHERE is_published = true AND event_date < NOW()
     ORDER BY event_date DESC
     LIMIT 10`
  )

  const allEventIds = [...upcomingEvents, ...pastEvents].map((e) => e.id)
  const commentCounts = new Map<string, number>()

  if (allEventIds.length > 0) {
    const counts = await db.queryMany<{ object_id: string }>(
      `SELECT object_id FROM comments
       WHERE type = 'event' AND object_id = ANY($1::uuid[])`,
      [allEventIds]
    )

    counts.forEach((c) => {
      commentCounts.set(c.object_id, (commentCounts.get(c.object_id) || 0) + 1)
    })
  }

  const addCommentCount = (events: Event[]) =>
    events.map((e) => ({
      ...e,
      comment_count: commentCounts.get(e.id) || 0,
    }))

  const upcomingWithCounts = addCommentCount(upcomingEvents)
  const pastWithCounts = addCommentCount(pastEvents)

  const demoUpcoming: Event[] = upcomingWithCounts.length ? upcomingWithCounts : [
    {
      id: '1',
      title: 'Рок-фестиваль "Волна"',
      slug: '2026-06-01-rok-festival-volna',
      description: 'Большой летний фестиваль под открытым небом. MARINERO выступает на главной сцене.',
      venue: 'Парк Горького',
      city: 'Москва',
      event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      ticket_url: '#',
      image_url: null,
      doors_time: null,
      venue_address: null,
      google_maps_url: null,
      how_to_get: null,
      entry_rules: null,
      contacts: null,
      is_published: true,
      created_at: '',
      updated_at: '',
      comment_count: 0,
    },
    {
      id: '2',
      title: 'Клубный концерт',
      slug: '2026-06-15-klubnyj-koncert',
      description: 'Акустическая программа в камерной обстановке',
      venue: 'Fish Fabrique',
      city: 'Санкт-Петербург',
      event_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      ticket_url: '#',
      image_url: null,
      doors_time: null,
      venue_address: null,
      google_maps_url: null,
      how_to_get: null,
      entry_rules: null,
      contacts: null,
      is_published: true,
      created_at: '',
      updated_at: '',
      comment_count: 0,
    },
    {
      id: '3',
      title: 'New Year Party',
      slug: '2026-12-31-new-year-party',
      description: 'Новогодний концерт с сюрпризами',
      venue: 'Ring Central',
      city: 'Валенсия',
      event_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      ticket_url: '#',
      image_url: null,
      doors_time: null,
      venue_address: null,
      google_maps_url: null,
      how_to_get: null,
      entry_rules: null,
      contacts: null,
      is_published: true,
      created_at: '',
      updated_at: '',
      comment_count: 0,
    },
  ]

  const demoPast: Event[] = pastWithCounts.length ? pastWithCounts : []

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} isAdmin={isAdmin} displayName={displayName} />
      
      <main className="flex-1">
        <section className="py-16 bg-card border-b border-border">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Концерты
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Расписание выступлений MARINERO. Приходите на наши концерты!
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-2xl font-bold mb-8 flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              Ближайшие концерты
            </h2>

            {demoUpcoming.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Пока нет запланированных концертов
              </div>
            ) : (
              <div className="space-y-6">
                {demoUpcoming.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </section>

        {demoPast.length > 0 && (
          <section className="py-16 bg-card">
            <div className="container mx-auto px-4">
              <h2 className="font-display text-2xl font-bold mb-8 text-muted-foreground">
                Прошедшие концерты
              </h2>

              <div className="space-y-4">
                {demoPast.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.slug}`}
                    className="block"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-lg bg-secondary/30 opacity-75 hover:opacity-100 hover:bg-secondary/50 transition-all">
                      <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-muted flex flex-col items-center justify-center text-muted-foreground">
                        <span className="text-lg font-bold">
                          {format(new Date(event.event_date), 'd', { locale: ru })}
                        </span>
                        <span className="text-xs uppercase">
                          {format(new Date(event.event_date), 'MMM', { locale: ru })}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-muted-foreground hover:text-foreground transition-colors">{event.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
                          <MapPin className="h-3 w-3" />
                          <span>{event.venue}, {event.city}</span>
                        </div>
                      </div>
                      {(event.comment_count ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground/70">
                          <MessageCircle className="h-4 w-4" />
                          <span>{event.comment_count}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      
      <Footer />
    </div>
  )
}

function EventCard({ event }: { event: Event }) {
  const eventDate = new Date(event.event_date)
  
  return (
    <Link href={`/events/${event.slug}`} className="block">
      <div className="flex flex-col md:flex-row md:items-center gap-6 p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors">
        <div className="flex-shrink-0">
          <div className="w-24 h-24 rounded-xl bg-primary/10 flex flex-col items-center justify-center text-primary">
            <span className="text-3xl font-bold">
              {format(eventDate, 'd', { locale: ru })}
            </span>
            <span className="text-sm uppercase font-medium">
              {format(eventDate, 'MMMM', { locale: ru })}
            </span>
            <span className="text-xs opacity-70">
              {format(eventDate, 'yyyy', { locale: ru })}
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold mb-2">{event.title}</h3>
          
          {event.description && (
            <p className="text-muted-foreground mb-4">{event.description}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              <span>{event.venue}, {event.city}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>{format(eventDate, 'HH:mm', { locale: ru })}</span>
            </div>
            {(event.comment_count ?? 0) > 0 && (
              <div className="flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4" />
                <span>{event.comment_count}</span>
              </div>
            )}
          </div>
        </div>

        {event.ticket_url && (
          <div className="flex items-center flex-shrink-0 md:pr-4">
            <Button size="lg" className="gap-2">
              <Ticket className="h-4 w-4" />
              Билеты
            </Button>
          </div>
        )}
      </div>
    </Link>
  )
}
