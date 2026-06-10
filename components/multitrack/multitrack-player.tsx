'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  Clock,
  Send,
  X,
  Trash2,
  Headphones,
  RefreshCw,
  Download
} from 'lucide-react'
import type { MultitrackGroup, MultitrackFile, MultitrackComment, Profile } from '@/lib/types'
import { AdminUserHoverCard } from '@/components/admin/user-hover-card'
import { cn } from '@/lib/utils'

interface MultitrackPlayerProps {
  group: MultitrackGroup
  currentUserId: string | null
  isAdmin: boolean
  onDelete?: (groupId: string) => void
}

interface TrackState {
  muted: boolean
  solo: boolean
  volume: number
}

interface CommentWithProfile extends MultitrackComment {
  profile?: Profile
}

export function MultitrackPlayer({ group, currentUserId, isAdmin, onDelete }: MultitrackPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [trackStates, setTrackStates] = useState<Record<string, TrackState>>({})
  const [comments, setComments] = useState<CommentWithProfile[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentTimestamp, setCommentTimestamp] = useState<number | null>(null)
  const [selectedTrackId, setSelectedTrackId] = useState<string>('all')
  const [loadingComments, setLoadingComments] = useState(true)
  const [regeneratingWaveforms, setRegeneratingWaveforms] = useState(false)
  const [localFiles, setLocalFiles] = useState(group.files || [])
  
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})
  const waveformCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({})
  const animationFrameRef = useRef<number | null>(null)

  // Initialize track states
  useEffect(() => {
    if (localFiles) {
      const initialStates: Record<string, TrackState> = {}
      localFiles.forEach(file => {
        initialStates[file.id] = {
          muted: false,
          solo: false,
          volume: file.volume || 100
        }
      })
      setTrackStates(initialStates)
    }
  }, [localFiles])

  // Calculate max duration
  useEffect(() => {
    if (localFiles && localFiles.length > 0) {
      const maxDuration = Math.max(...localFiles.map(f => f.duration_seconds || 0))
      setDuration(maxDuration)
    }
  }, [localFiles])

  // Load comments
  useEffect(() => {
    loadComments()
  }, [group.id])

  async function loadComments() {
    setLoadingComments(true)
    try {
      const response = await fetch(`/api/multitrack/comments?group_id=${group.id}`)
      if (response.ok) {
        const data = await response.json()
        setComments(data)
      }
    } catch (error) {
      console.error('Failed to load comments:', error)
    } finally {
      setLoadingComments(false)
    }
  }

  // Draw waveforms when component mounts
  useEffect(() => {
    localFiles?.forEach(file => {
      if (file.waveform_data && waveformCanvasRefs.current[file.id]) {
        drawWaveform(file.id, file.waveform_data)
      }
    })
  }, [group.files, trackStates])

  function drawWaveform(fileId: string, waveformData: number[]) {
    const canvas = waveformCanvasRefs.current[fileId]
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    const trackState = trackStates[fileId]
    const isMuted = trackState?.muted || false
    const hasSolo = Object.values(trackStates).some(s => s.solo)
    const isActive = !isMuted && (!hasSolo || trackState?.solo)

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw waveform with thinner, more frequent bars
    const barWidth = Math.max(1, width / waveformData.length)
    const barGap = barWidth * 0.25 // 25% gap between bars
    const actualBarWidth = barWidth - barGap
    const midY = height / 2

    ctx.fillStyle = isActive ? 'rgb(99, 102, 241)' : 'rgb(156, 163, 175)' // indigo-500 or gray-400
    
    waveformData.forEach((amplitude, index) => {
      const barHeight = amplitude * height * 0.85
      const x = index * barWidth
      ctx.fillRect(x, midY - barHeight / 2, Math.max(1, actualBarWidth), barHeight)
    })

    // Draw playhead position
    if (duration > 0) {
      const playheadX = (currentTime / duration) * width
      ctx.fillStyle = 'rgb(239, 68, 68)' // red-500
      ctx.fillRect(playheadX - 1, 0, 2, height)
    }
  }

  // Redraw waveforms on time update
  useEffect(() => {
    localFiles?.forEach(file => {
      if (file.waveform_data && waveformCanvasRefs.current[file.id]) {
        drawWaveform(file.id, file.waveform_data)
      }
    })
  }, [currentTime, duration, trackStates, localFiles])

  // Animation loop for syncing playback
  const updateTime = useCallback(() => {
    const firstAudio = Object.values(audioRefs.current)[0]
    if (firstAudio) {
      setCurrentTime(firstAudio.currentTime)
    }
    animationFrameRef.current = requestAnimationFrame(updateTime)
  }, [])

  // Sync all tracks based on solo/mute state
  useEffect(() => {
    const hasSolo = Object.values(trackStates).some(s => s.solo)
    
    Object.entries(audioRefs.current).forEach(([id, audio]) => {
      const state = trackStates[id]
      if (!state) return

      if (hasSolo) {
        // If any track is solo, mute all non-solo tracks
        audio.muted = !state.solo
      } else {
        // Otherwise respect individual mute states
        audio.muted = state.muted
      }
      audio.volume = state.volume / 100
    })
  }, [trackStates])

  function startPlayback(time?: number) {
    const seekTime = time ?? currentTime
    const playPromises = Object.values(audioRefs.current).map(audio => {
      audio.currentTime = seekTime
      return audio.play()
    })
    Promise.all(playPromises).catch(console.error)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    animationFrameRef.current = requestAnimationFrame(updateTime)
    setIsPlaying(true)
  }

  function togglePlay() {
    if (isPlaying) {
      // Pause all tracks
      Object.values(audioRefs.current).forEach(audio => audio.pause())
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      setIsPlaying(false)
    } else {
      startPlayback()
    }
  }

  function seekTo(time: number) {
    setCurrentTime(time)
    Object.values(audioRefs.current).forEach(audio => {
      audio.currentTime = time
    })
    // Redraw waveforms
    localFiles?.forEach(file => {
      if (file.waveform_data) {
        drawWaveform(file.id, file.waveform_data)
      }
    })
  }

  // Solo a specific track (clearing solo/mute on all others). Pass null to clear solo.
  function soloTrack(trackId: string | null) {
    setTrackStates(prev => {
      const next: Record<string, TrackState> = {}
      Object.entries(prev).forEach(([id, state]) => {
        next[id] = {
          ...state,
          solo: trackId !== null && id === trackId,
          muted: false,
        }
      })
      return next
    })
  }

  // Jump to a comment's timecode: optionally solo its track, then start playback.
  function seekToComment(comment: CommentWithProfile) {
    if (comment.timestamp_seconds === null) return
    if (comment.solo_track_id && audioRefs.current[comment.solo_track_id]) {
      soloTrack(comment.solo_track_id)
    }
    seekTo(comment.timestamp_seconds)
    startPlayback(comment.timestamp_seconds)
  }

  function handleWaveformClick(fileId: string, e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const seekTime = (x / rect.width) * duration
    seekTo(seekTime)
  }

  function toggleMute(fileId: string) {
    setTrackStates(prev => ({
      ...prev,
      [fileId]: {
        ...prev[fileId],
        muted: !prev[fileId].muted,
        solo: false // Un-solo when muting
      }
    }))
  }

  function toggleSolo(fileId: string) {
    setTrackStates(prev => ({
      ...prev,
      [fileId]: {
        ...prev[fileId],
        solo: !prev[fileId].solo,
        muted: false // Un-mute when soloing
      }
    }))
  }

  function setVolume(fileId: string, volume: number) {
    setTrackStates(prev => ({
      ...prev,
      [fileId]: {
        ...prev[fileId],
        volume
      }
    }))
  }

  function formatTime(seconds: number): string {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function markCurrentTime() {
    setCommentTimestamp(Math.floor(currentTime))
  }

  async function addComment() {
    if (!newComment.trim() || !currentUserId) return

    try {
      const response = await fetch('/api/multitrack/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          multitrack_group_id: group.id,
          content: newComment.trim(),
          timestamp_seconds: commentTimestamp,
          solo_track_id:
            commentTimestamp !== null && selectedTrackId !== 'all'
              ? selectedTrackId
              : null
        })
      })

      if (response.ok) {
        const comment = await response.json()
        setComments(prev => [...prev, comment])
        setNewComment('')
        setCommentTimestamp(null)
        setSelectedTrackId('all')
      }
    } catch (error) {
      console.error('Failed to add comment:', error)
    }
  }

  async function deleteComment(commentId: string) {
    try {
      const response = await fetch(`/api/multitrack/comments?id=${commentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId))
      }
    } catch (error) {
      console.error('Failed to delete comment:', error)
    }
  }

  // Regenerate waveforms for all files with higher resolution
  async function regenerateWaveforms() {
    if (!isAdmin || regeneratingWaveforms) return
    
    setRegeneratingWaveforms(true)
    const numBars = 400 // High resolution
    
    try {
      for (const file of localFiles) {
        // Fetch audio file and generate waveform
        const response = await fetch(file.file_url)
        if (!response.ok) continue
        
        const arrayBuffer = await response.arrayBuffer()
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        
        // Get audio data
        const channelData = audioBuffer.getChannelData(0)
        const samplesPerBar = Math.floor(channelData.length / numBars)
        const waveformData: number[] = []
        
        for (let i = 0; i < numBars; i++) {
          let sum = 0
          const start = i * samplesPerBar
          for (let j = 0; j < samplesPerBar; j++) {
            sum += Math.abs(channelData[start + j] || 0)
          }
          waveformData.push(sum / samplesPerBar)
        }
        
        // Normalize
        const maxAmplitude = Math.max(...waveformData) || 1
        const normalizedWaveform = waveformData.map(v => v / maxAmplitude)
        
        // Save to database
        await fetch('/api/multitrack/regenerate-waveform', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: file.id,
            waveformData: normalizedWaveform
          })
        })
        
        // Update local state
        setLocalFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, waveform_data: normalizedWaveform } : f
        ))
        
        audioContext.close()
      }
    } catch (error) {
      console.error('Failed to regenerate waveforms:', error)
    } finally {
      setRegeneratingWaveforms(false)
    }
  }

  // Handle track end
  useEffect(() => {
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }

    const firstAudio = Object.values(audioRefs.current)[0]
    if (firstAudio) {
      firstAudio.addEventListener('ended', handleEnded)
      return () => firstAudio.removeEventListener('ended', handleEnded)
    }
  }, [audioRefs.current])

  const hasSolo = Object.values(trackStates).some(s => s.solo)

  return (
    <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Headphones className="h-4 w-4 text-indigo-600" />
            <span className="text-indigo-900 dark:text-indigo-100">{group.name}</span>
            <span className="text-xs text-muted-foreground font-normal">
              ({localFiles?.length || 0} треков)
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-indigo-600"
              title="Скачать все треки ZIP-архивом"
            >
              <a href={`/api/download?multitrack=${encodeURIComponent(group.id)}`}>
                <Download className="h-3 w-3 mr-1" />
                Скачать ZIP
              </a>
            </Button>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-indigo-600"
                onClick={regenerateWaveforms}
                disabled={regeneratingWaveforms}
                title="Перегенерировать waveform с высоким разрешением"
              >
                <RefreshCw className={cn("h-3 w-3 mr-1", regeneratingWaveforms && "animate-spin")} />
                {regeneratingWaveforms ? 'Обновление...' : 'Обновить waveform'}
              </Button>
            )}
            {isAdmin && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive h-8 w-8"
                onClick={() => onDelete(group.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hidden audio elements */}
        {localFiles?.map(file => (
          <audio
            key={file.id}
            ref={el => {
              if (el) audioRefs.current[file.id] = el
            }}
            src={file.file_url}
            preload="metadata"
          />
        ))}

        {/* Main Timeline */}
        <div className="space-y-2">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={(value) => seekTo(value[0])}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
          </div>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => seekTo(Math.max(0, currentTime - 10))}
          >
            -10
          </Button>
          <Button
            size="lg"
            className="h-12 w-12 rounded-full bg-indigo-600 hover:bg-indigo-700"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => seekTo(Math.min(duration, currentTime + 10))}
          >
            +10
          </Button>
        </div>

        {/* Track List with Waveforms */}
        <div className="space-y-2 border rounded-lg p-3 bg-background">
          {localFiles?.map((file, index) => {
            const state = trackStates[file.id]
            const isActive = state && !state.muted && (!hasSolo || state.solo)

            return (
              <div 
                key={file.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg transition-colors",
                  isActive ? "bg-indigo-100/50 dark:bg-indigo-900/20" : "bg-muted/50 opacity-60"
                )}
              >
                {/* Waveform - full width */}
                <div className="flex-1 h-14 bg-muted/30 rounded cursor-pointer relative">
                  {file.waveform_data ? (
                    <canvas
                      ref={el => { waveformCanvasRefs.current[file.id] = el }}
                      className="w-full h-full rounded"
                      width={800}
                      height={56}
                      onClick={(e) => handleWaveformClick(file.id, e)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                      Нет waveform данных
                    </div>
                  )}
                  {/* Track name - positioned at bottom edge */}
                  <span className="absolute -bottom-2 left-2 text-xs text-muted-foreground truncate max-w-[80%]">
                    {file.filename.replace(/\.[^/.]+$/, '')}
                  </span>
                </div>

                {/* Mute/Solo Buttons */}
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant={state?.muted ? "destructive" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0 text-xs font-bold"
                    onClick={() => toggleMute(file.id)}
                    title="Mute"
                  >
                    M
                  </Button>
                  <Button
                    variant={state?.solo ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-8 w-8 p-0 text-xs font-bold",
                      state?.solo && "bg-yellow-500 hover:bg-yellow-600 text-black"
                    )}
                    onClick={() => toggleSolo(file.id)}
                    title="Solo"
                  >
                    S
                  </Button>
                </div>

                {/* Volume Slider */}
                <div className="flex items-center gap-2 w-28 shrink-0">
                  {state?.muted || (hasSolo && !state?.solo) ? (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-indigo-600" />
                  )}
                  <Slider
                    value={[state?.volume || 100]}
                    max={100}
                    step={1}
                    onValueChange={(value) => setVolume(file.id, value[0])}
                    className="flex-1"
                    disabled={state?.muted}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Comments Section */}
        <div className="pt-4 border-t space-y-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={markCurrentTime}
              className="gap-1"
            >
              <Clock className="h-3 w-3" />
              Отметить время
            </Button>
            <Select value={selectedTrackId} onValueChange={setSelectedTrackId}>
              <SelectTrigger size="sm" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все треки</SelectItem>
                {localFiles?.map(file => (
                  <SelectItem key={file.id} value={file.id}>
                    {file.filename.replace(/\.[^/.]+$/, '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {commentTimestamp !== null && (
              <span className="text-sm bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded">
                {formatTime(commentTimestamp)}
                <button 
                  onClick={() => setCommentTimestamp(null)}
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3 inline" />
                </button>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Комментарий к мультитреку..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addComment()}
              disabled={!currentUserId}
            />
            <Button onClick={addComment} size="icon" disabled={!currentUserId}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Comments List */}
        {comments.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <h4 className="text-sm font-medium">Комментарии ({comments.length})</h4>
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 p-2 rounded-lg bg-secondary/50">
                {comment.timestamp_seconds !== null && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto py-1 px-2 text-xs font-sans text-indigo-600 hover:text-indigo-700"
                      onClick={() => seekToComment(comment)}
                    >
                      {formatTime(comment.timestamp_seconds)}
                    </Button>
                    {comment.solo_track_id && (
                      <span className="flex items-center gap-1 text-xs font-sans text-yellow-600 dark:text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">
                        <Headphones className="h-3 w-3" />
                        {localFiles
                          ?.find(f => f.id === comment.solo_track_id)
                          ?.filename.replace(/\.[^/.]+$/, '') || 'трек'}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{comment.content}</p>
                  <p className="text-xs text-muted-foreground">
                    <AdminUserHoverCard
                      userId={comment.user_id}
                      userName={comment.profile?.display_name || comment.profile?.username || 'Пользователь'}
                      isAdmin={isAdmin}
                    >
                      <span className="hover:underline cursor-pointer">
                        {comment.profile?.display_name || comment.profile?.username || 'Пользователь'}
                      </span>
                    </AdminUserHoverCard>
                    {' · '}
                    {new Date(comment.created_at).toLocaleDateString('ru-RU', { 
                      day: 'numeric', 
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                {(comment.user_id === currentUserId || isAdmin) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={() => deleteComment(comment.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
