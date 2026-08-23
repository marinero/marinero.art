import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Music, FileText, EyeOff } from 'lucide-react'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/metadata'

export const metadata: Metadata = pageMetadata({
  segments: ['Тексты песен'],
  description: 'Тексты песен группы MARINERO с аккордами',
})

export default async function SongsPage() {
  const { user, isAdmin, displayName } = await getSessionUser()

  const songs = await db.queryMany<{
    id: string
    title: string
    slug: string
    bpm: string | null
    is_published: boolean
    created_at: string
  }>(
    `SELECT id, title, slug, bpm, is_published, created_at
     FROM song_texts
     ${isAdmin ? '' : 'WHERE is_published = true'}
     ORDER BY title ASC`
  )

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} isAdmin={isAdmin} displayName={displayName} />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Тексты песен</h1>
            <p className="text-muted-foreground">
              Тексты с аккордами для гитары
            </p>
          </div>

          {songs.length > 0 ? (
            <div className="grid gap-3">
              {songs.map((song) => (
                <Link key={song.id} href={`/songs/${song.slug}`}>
                  <Card
                    className={`hover:bg-accent/50 transition-colors ${
                      !song.is_published ? 'border-dashed border-amber-500/50 bg-amber-500/5' : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Music className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="font-semibold text-lg truncate">
                              {song.title}
                            </h2>
                            {!song.is_published && (
                              <Badge
                                variant="outline"
                                className="shrink-0 gap-1 border-amber-500/60 text-amber-600 dark:text-amber-500"
                              >
                                <EyeOff className="h-3 w-3" />
                                Черновик
                              </Badge>
                            )}
                          </div>
                          {song.bpm && (
                            <p className="text-sm text-muted-foreground">
                              {song.bpm} BPM
                            </p>
                          )}
                        </div>
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Песни пока не добавлены</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
