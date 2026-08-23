'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Pencil, Trash2, Eye, EyeOff, Music, FileText, Search } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChordEditor } from '@/components/songs/chord-editor'
import { ChordLibrary } from '@/components/songs/chord-library'
import type { SongText, Chord } from '@/lib/types'
import { toast } from 'sonner'

export default function AdminSongsPage() {
  const [songs, setSongs] = useState<SongText[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [activeTab, setActiveTab] = useState('songs')
  const [formData, setFormData] = useState({
    title: '',
    bpm: '',
    is_published: false
  })

  useEffect(() => {
    fetchSongs()
  }, [])

  async function fetchSongs() {
    const response = await fetch('/api/admin/songs')
    if (response.ok) {
      const data = await response.json()
      setSongs(data.songs || [])
    }
    setLoading(false)
  }

  function generateSlug(title: string): string {
    const map: Record<string, string> = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
      'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    }
    const transliterated = title.toLowerCase().split('').map(ch => map[ch] ?? ch).join('')
    return transliterated
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  function resetForm() {
    setFormData({
      title: '',
      bpm: '',
      is_published: false
    })
    setIsCreating(false)
  }

  function startCreate() {
    resetForm()
    setIsCreating(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast.error('Введите название песни')
      return
    }

    const songData = {
      title: formData.title.trim(),
      slug: generateSlug(formData.title),
      bpm: formData.bpm.trim() || null,
      is_published: formData.is_published,
      text_content: ''
    }

    try {
      const response = await fetch('/api/admin/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(songData),
      })

      if (!response.ok) {
        if (response.status === 409) {
          toast.error('Песня с таким названием уже существует')
        } else {
          throw new Error('Failed to create')
        }
        return
      }
      toast.success('Песня создана')

      resetForm()
      fetchSongs()
    } catch {
      toast.error('Ошибка сохранения')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить эту песню и все привязанные аккорды?')) return

    const response = await fetch(`/api/admin/songs/${id}`, { method: 'DELETE' })

    if (!response.ok) {
      toast.error('Ошибка удаления')
      return
    }

    toast.success('Песня удалена')
    fetchSongs()
  }

  async function togglePublished(song: SongText) {
    const response = await fetch(`/api/admin/songs/${song.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !song.is_published }),
    })

    if (response.ok) {
      fetchSongs()
    }
  }

  const filteredSongs = songs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Тексты песен</h1>
          <p className="text-muted-foreground">Управление текстами и аккордами</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="songs" className="gap-2">
            <FileText className="h-4 w-4" />
            Песни
          </TabsTrigger>
          <TabsTrigger value="chords" className="gap-2">
            <Music className="h-4 w-4" />
            Библиотека аккордов
          </TabsTrigger>
        </TabsList>

        <TabsContent value="songs" className="space-y-6 mt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск песен..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button onClick={startCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Добавить песню
            </Button>
          </div>

          {isCreating && (
            <Card>
              <CardHeader>
                <CardTitle>Новая песня</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium">Название *</label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Название песни"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">BPM</label>
                      <Input
                        type="text"
                        value={formData.bpm}
                        onChange={(e) => setFormData({ ...formData, bpm: e.target.value })}
                        placeholder="115/120"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_published"
                      checked={formData.is_published}
                      onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <label htmlFor="is_published" className="text-sm font-medium">
                      Опубликована
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit">Создать</Button>
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Отмена
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-3">
            {filteredSongs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {searchQuery ? 'Песни не найдены' : 'Нет песен. Создайте первую!'}
                </CardContent>
              </Card>
            ) : (
              filteredSongs.map((song) => (
                <Card key={song.id} className={!song.is_published ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Music className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">{song.title}</h3>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {song.bpm && (
                              <span>{song.bpm} BPM</span>
                            )}
                            <span>
                              {format(new Date(song.created_at), 'd MMM yyyy', { locale: ru })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => togglePublished(song)}
                        >
                          {song.is_published ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                        <Link href={`/admin/songs/${song.slug}`}>
                          <Button variant="ghost" size="icon">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(song.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="chords" className="space-y-6 mt-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Chord Editor */}
            <div className="lg:col-span-2">
              <ChordEditor 
                onSave={() => {
                  // Library will refresh automatically via its own useEffect
                }}
              />
            </div>
            
            {/* Chord Library */}
            <div className="lg:col-span-1">
              <Card className="h-[600px]">
                <CardHeader className="pb-0">
                  <CardTitle className="text-lg">Библиотека аккордов</CardTitle>
                </CardHeader>
                <ChordLibrary className="h-[calc(100%-60px)]" />
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
