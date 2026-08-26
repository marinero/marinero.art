'use client'

import { useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { PlatformIcon } from '@/components/platform-icon'
import { resolveAudioUrl } from '@/lib/storage-keys'
import { cn } from '@/lib/utils'
import type { SongLink } from '@/lib/types'

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function SongListenPlayer({
  title,
  audioUrl,
  links,
  className,
}: {
  title: string
  audioUrl?: string | null
  links?: SongLink[] | null
  className?: string
}) {
  const src = resolveAudioUrl(audioUrl)
  const platformLinks = (links ?? []).filter((link) => link.url.trim())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  if (!src && platformLinks.length === 0) return null

  async function togglePlay() {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }

    setLoadError(null)
    try {
      await audioRef.current.play()
      setIsPlaying(true)
    } catch (error) {
      console.error('Audio playback failed:', error)
      setLoadError('Не удалось воспроизвести файл')
      setIsPlaying(false)
    }
  }

  async function seekTo(time: number) {
    if (!audioRef.current) return
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="space-y-4 p-5">
        {src ? (
          <>
            <audio
              ref={audioRef}
              src={src}
              preload="metadata"
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
              onLoadedMetadata={() => {
                const next = audioRef.current?.duration
                if (next && isFinite(next) && next > 0) setDuration(next)
              }}
              onEnded={() => setIsPlaying(false)}
              onError={() => {
                setLoadError('Не удалось загрузить аудио')
                setIsPlaying(false)
              }}
            />

            {loadError ? (
              <p className="text-sm text-destructive">{loadError}</p>
            ) : null}

            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="icon"
                className="h-12 w-12 shrink-0 rounded-full"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Пауза' : `Слушать MARINERO — ${title}`}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="ml-0.5 h-5 w-5" />
                )}
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  MARINERO — {title}
                </p>
                <div className="mt-2">
                  <Slider
                    value={[currentTime]}
                    max={duration && isFinite(duration) ? duration : 100}
                    step={0.25}
                    onValueChange={(value) => seekTo(value[0])}
                    className="cursor-pointer"
                    aria-label="Позиция воспроизведения"
                  />
                  <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                    <span>{formatTime(currentTime)}</span>
                    <span>
                      {duration > 0 && isFinite(duration) ? formatTime(duration) : '--:--'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {platformLinks.length > 0 ? (
          <div className={cn(src && 'border-t border-border pt-4')}>
            <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              На площадках
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {platformLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Слушать на ${link.platform}`}
                  aria-label={`Слушать «${title}» на ${link.platform}`}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <PlatformIcon platform={link.platform} className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
