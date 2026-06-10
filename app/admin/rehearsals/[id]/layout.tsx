import type { Metadata } from 'next'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { resolveRehearsal } from '@/lib/admin-resolve'
import { pageMetadata } from '@/lib/metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params

  if (id === 'new') {
    return pageMetadata({ segments: ['Админ', 'Репетиции', 'Новая репетиция'] })
  }

  const rehearsal = await resolveRehearsal<{ rehearsal_date: string }>(id)

  let label = 'Репетиция'
  if (rehearsal?.rehearsal_date) {
    const parsed = new Date(rehearsal.rehearsal_date)
    if (!Number.isNaN(parsed.getTime())) {
      label = `Репетиция ${format(parsed, 'd MMMM yyyy', { locale: ru })}`
    }
  }

  return pageMetadata({ segments: ['Админ', 'Репетиции', label] })
}

export default function AdminRehearsalEditorLayout({ children }: { children: React.ReactNode }) {
  return children
}
