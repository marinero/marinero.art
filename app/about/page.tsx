import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { BandTimeline } from '@/components/about/band-timeline'
import type {
  AboutContent,
  DiscographyItem,
  DiscographyLink,
  BandMember,
  MemberTimelineSegment,
} from '@/lib/types'
import { Disc3, Users, Clock } from 'lucide-react'
import { PlatformIcon } from '@/components/platform-icon'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  segments: ['О нас'],
  description: 'История группы MARINERO: дискография, участники и временная шкала состава',
})

const RELEASE_TYPE_LABEL: Record<string, string> = {
  album: 'Альбом',
  ep: 'EP',
  single: 'Сингл',
  live: 'Концертный',
  compilation: 'Сборник',
}

export default async function AboutPage() {
  const { user, isAdmin, displayName } = await getSessionUser()

  const about = await db.queryOne<AboutContent>(
    'SELECT * FROM about_content WHERE id = 1'
  )

  const discography = await db.queryMany<DiscographyItem>(
    `SELECT * FROM discography
     WHERE is_published = true
     ORDER BY order_index ASC, year DESC NULLS LAST`
  )

  if (discography.length) {
    const discIds = discography.map((d) => d.id)
    const discLinks = await db.queryMany<DiscographyLink>(
      `SELECT * FROM discography_links
       WHERE discography_id = ANY($1)
       ORDER BY order_index ASC, created_at ASC`,
      [discIds]
    )
    const linksByItem = new Map<string, DiscographyLink[]>()
    for (const link of discLinks) {
      const arr = linksByItem.get(link.discography_id) ?? []
      arr.push(link)
      linksByItem.set(link.discography_id, arr)
    }
    for (const item of discography) {
      item.links = linksByItem.get(item.id) ?? []
    }
  }

  const members = await db.queryMany<BandMember>(
    `SELECT * FROM band_members
     ORDER BY is_current DESC, order_index ASC, name ASC`
  )

  const segments = await db.queryMany<MemberTimelineSegment>(
    `SELECT * FROM member_timeline
     ORDER BY order_index ASC, start_year ASC`
  )

  const segmentsByMember = new Map<string, MemberTimelineSegment[]>()
  for (const s of segments) {
    const arr = segmentsByMember.get(s.member_id) ?? []
    arr.push(s)
    segmentsByMember.set(s.member_id, arr)
  }

  const membersWithSegments: BandMember[] = members.map((m) => ({
    ...m,
    segments: segmentsByMember.get(m.id) ?? [],
  }))

  const currentMembers = membersWithSegments.filter((m) => m.is_current)
  const formerMembers = membersWithSegments.filter((m) => !m.is_current)

  const albumYears = Array.from(
    new Set(
      discography
        .filter((d) => d.release_type === 'album' && d.year)
        .map((d) => d.year as number)
    )
  ).sort((a, b) => a - b)

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} isAdmin={isAdmin} displayName={displayName} />

      <main className="flex-1">
        {/* Hero / intro */}
        <section className="py-16 bg-card border-b border-border">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-6">
              {about?.title || 'О нас'}
            </h1>
            {about?.body ? (
              <div className="text-muted-foreground text-lg leading-relaxed whitespace-pre-line text-left md:text-center">
                {about.body}
              </div>
            ) : (
              <p className="text-muted-foreground text-lg">
                Описание группы появится здесь.
              </p>
            )}
          </div>
        </section>

        {/* Discography */}
        {discography.length > 0 && (
          <section className="py-16">
            <div className="container mx-auto px-4">
              <h2 className="font-display text-2xl font-bold mb-8 flex items-center gap-2">
                <Disc3 className="h-6 w-6 text-primary" />
                Дискография
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {discography.map((item) => (
                  <div key={item.id} className="group">
                    <div className="aspect-square rounded-xl overflow-hidden bg-secondary border border-border">
                      {item.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.cover_image_url}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Disc3 className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="mt-3">
                      <h3 className="font-semibold text-sm truncate" title={item.title}>
                        {item.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {[RELEASE_TYPE_LABEL[item.release_type], item.year]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {item.links && item.links.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.links.map((link) => (
                            <a
                              key={link.id}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Слушать на ${link.platform}`}
                              aria-label={`Слушать «${item.title}» на ${link.platform}`}
                              className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <PlatformIcon platform={link.platform} className="h-4 w-4" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Members */}
        {membersWithSegments.length > 0 && (
          <section className="py-16 bg-card border-y border-border">
            <div className="container mx-auto px-4">
              <h2 className="font-display text-2xl font-bold mb-8 flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                Участники
              </h2>

              {currentMembers.length > 0 && (
                <>
                  <h3 className="text-lg font-semibold mb-4 text-muted-foreground">
                    Текущий состав
                  </h3>
                  <MemberGrid members={currentMembers} />
                </>
              )}

              {formerMembers.length > 0 && (
                <>
                  <h3 className="text-lg font-semibold mb-4 mt-10 text-muted-foreground">
                    Бывшие участники
                  </h3>
                  <MemberGrid members={formerMembers} />
                </>
              )}
            </div>
          </section>
        )}

        {/* Timeline */}
        {membersWithSegments.some((m) => (m.segments?.length ?? 0) > 0) && (
          <section className="py-16">
            <div className="container mx-auto px-4">
              <h2 className="font-display text-2xl font-bold mb-8 flex items-center gap-2">
                <Clock className="h-6 w-6 text-primary" />
                Временная шкала
              </h2>
              <BandTimeline members={membersWithSegments} albumYears={albumYears} />
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  )
}

function MemberGrid({ members }: { members: BandMember[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex gap-4 p-4 rounded-xl bg-background border border-border"
        >
          <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-secondary">
            {member.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.photo_url}
                alt={member.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Users className="h-7 w-7" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold">{member.name}</h4>
            {member.instruments && (
              <p className="text-sm text-primary mb-1">{member.instruments}</p>
            )}
            {member.bio && (
              <p className="text-sm text-muted-foreground line-clamp-3">
                {member.bio}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
