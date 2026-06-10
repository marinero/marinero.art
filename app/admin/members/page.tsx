'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, X, Users, ImageIcon } from 'lucide-react'
import { upload } from '@/lib/upload-client'
import { BAND_ROLES, getRoleColor, getRoleLabel } from '@/lib/band'
import type { BandMember } from '@/lib/types'
import { resolveAssetUrl } from '@/lib/storage-keys'

interface SegmentForm {
  role: string
  start_year: string
  end_year: string // '' => по наст. время
}

const emptyForm = {
  name: '',
  photo_url: '',
  instruments: '',
  bio: '',
  is_current: true,
  order_index: 0,
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<BandMember[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<BandMember | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({ ...emptyForm })
  const [segments, setSegments] = useState<SegmentForm[]>([])

  useEffect(() => {
    fetchMembers()
  }, [])

  async function fetchMembers() {
    const res = await fetch('/api/admin/members')
    if (res.ok) {
      const data = await res.json()
      setMembers(data.members || [])
    }
    setLoading(false)
  }

  function resetForm() {
    setFormData({ ...emptyForm })
    setSegments([])
    setEditing(null)
    setIsCreating(false)
  }

  function startCreate() {
    resetForm()
    setIsCreating(true)
  }

  function startEdit(member: BandMember) {
    setEditing(member)
    setIsCreating(false)
    setFormData({
      name: member.name,
      photo_url: member.photo_url ?? '',
      instruments: member.instruments ?? '',
      bio: member.bio ?? '',
      is_current: member.is_current,
      order_index: member.order_index,
    })
    setSegments(
      (member.segments ?? []).map((s) => ({
        role: s.role,
        start_year: String(s.start_year),
        end_year: s.end_year ? String(s.end_year) : '',
      }))
    )
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const filename = `marinero/about/member-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${ext}`
      const blob = await upload(filename, file, { access: 'public' })
      setFormData((f) => ({ ...f, photo_url: blob.url }))
    } catch {
      alert('Ошибка загрузки фото')
    } finally {
      setUploading(false)
    }
  }

  function addSegment() {
    setSegments((s) => [
      ...s,
      { role: BAND_ROLES[0].key, start_year: '', end_year: '' },
    ])
  }

  function updateSegment(i: number, patch: Partial<SegmentForm>) {
    setSegments((s) => s.map((seg, idx) => (idx === i ? { ...seg, ...patch } : seg)))
  }

  function removeSegment(i: number) {
    setSegments((s) => s.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      name: formData.name,
      photo_url: formData.photo_url || null,
      instruments: formData.instruments || null,
      bio: formData.bio || null,
      is_current: formData.is_current,
      order_index: Number(formData.order_index) || 0,
      segments: segments
        .filter((s) => s.role && s.start_year)
        .map((s) => ({
          role: s.role,
          start_year: Number(s.start_year),
          end_year: s.end_year ? Number(s.end_year) : null,
        })),
    }

    if (editing) {
      await fetch(`/api/admin/members/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    resetForm()
    fetchMembers()
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить участника?')) return
    await fetch(`/api/admin/members/${id}`, { method: 'DELETE' })
    fetchMembers()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Участники</h1>
          <p className="text-muted-foreground">
            Состав группы и отрезки для временной шкалы
          </p>
        </div>
        <Button onClick={startCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Добавить участника
        </Button>
      </div>

      {(isCreating || editing) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editing ? 'Редактировать участника' : 'Новый участник'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Имя *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Инструменты (подпись)</label>
                  <Input
                    value={formData.instruments}
                    onChange={(e) =>
                      setFormData({ ...formData, instruments: e.target.value })
                    }
                    placeholder="Вокал, гитара"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Биография</label>
                  <textarea
                    className="w-full min-h-24 px-3 py-2 rounded-md border border-input bg-background text-sm"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Порядок</label>
                  <Input
                    type="number"
                    value={formData.order_index}
                    onChange={(e) =>
                      setFormData({ ...formData, order_index: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="flex items-center gap-2 pt-7">
                  <input
                    type="checkbox"
                    id="is_current"
                    checked={formData.is_current}
                    onChange={(e) =>
                      setFormData({ ...formData, is_current: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <label htmlFor="is_current" className="text-sm font-medium">
                    Текущий участник
                  </label>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Фото</label>
                  {formData.photo_url ? (
                    <div className="relative w-24">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveAssetUrl(formData.photo_url) ?? formData.photo_url}
                        alt="photo"
                        className="w-24 h-24 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => setFormData({ ...formData, photo_url: '' })}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50">
                      {uploading ? (
                        <span className="text-xs text-muted-foreground animate-pulse">
                          ...
                        </span>
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Timeline segments */}
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    Отрезки для временной шкалы
                  </label>
                  <Button type="button" variant="outline" size="sm" onClick={addSegment}>
                    <Plus className="h-4 w-4 mr-1" />
                    Отрезок
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Каждый отрезок = инструмент за период. Пустой «по» = по настоящее время.
                </p>

                {segments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет отрезков</p>
                ) : (
                  <div className="space-y-2">
                    {segments.map((seg, i) => (
                      <div
                        key={i}
                        className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-border"
                      >
                        <span
                          className="inline-block h-4 w-4 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: getRoleColor(seg.role) }}
                        />
                        <select
                          className="h-9 px-2 rounded-md border border-input bg-background text-sm"
                          value={seg.role}
                          onChange={(e) => updateSegment(i, { role: e.target.value })}
                        >
                          {BAND_ROLES.map((r) => (
                            <option key={r.key} value={r.key}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        <Input
                          type="number"
                          className="w-24 h-9"
                          placeholder="с"
                          value={seg.start_year}
                          onChange={(e) =>
                            updateSegment(i, { start_year: e.target.value })
                          }
                        />
                        <Input
                          type="number"
                          className="w-24 h-9"
                          placeholder="по (наст.)"
                          value={seg.end_year}
                          onChange={(e) =>
                            updateSegment(i, { end_year: e.target.value })
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive"
                          onClick={() => removeSegment(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit">{editing ? 'Сохранить' : 'Создать'}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {members.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Нет участников. Добавьте первого!
            </CardContent>
          </Card>
        ) : (
          members.map((member) => (
            <Card key={member.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-secondary">
                    {member.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveAssetUrl(member.photo_url) ?? member.photo_url}
                        alt={member.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Users className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{member.name}</h3>
                      {!member.is_current && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">
                          Бывший
                        </span>
                      )}
                    </div>
                    {member.instruments && (
                      <p className="text-sm text-muted-foreground">
                        {member.instruments}
                      </p>
                    )}
                    {(member.segments?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {member.segments!.map((s) => (
                          <span
                            key={s.id}
                            className="text-xs px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: getRoleColor(s.role) }}
                          >
                            {getRoleLabel(s.role)} {s.start_year}–{s.end_year ?? 'наст.'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(member)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => handleDelete(member.id)}
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
    </div>
  )
}
