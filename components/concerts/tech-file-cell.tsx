'use client'

import { useRef, useState } from 'react'
import { Loader2, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { uploadFileInChunks, uploadToStorage } from '@/lib/upload-client'
import { resolveAssetUrl, storageUrlForKey } from '@/lib/storage-keys'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  isFileRef,
  type TechCellValue,
  type TechFileRef,
  type TechKey,
} from '@/lib/song-tech'

function sanitizeName(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[^\w.\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'file'
  )
}

function isMidiName(name: string, type = '') {
  const lower = name.toLowerCase()
  return (
    lower.endsWith('.mid') ||
    lower.endsWith('.midi') ||
    lower.endsWith('.syx') ||
    type === 'audio/midi' ||
    type === 'audio/mid'
  )
}

async function uploadTechFile(
  songId: string,
  key: TechKey,
  file: File,
  kind: 'pdf' | 'media' | 'midi'
): Promise<TechFileRef> {
  const safe = sanitizeName(file.name)
  const midi = kind === 'midi' || (kind === 'media' && isMidiName(file.name, file.type))
  const folder = kind === 'pdf' || midi ? 'documents' : 'audio'
  const pathname = `marinero/${folder}/${songId}/${key}-${Date.now()}-${safe}`

  if (kind === 'media' && !midi) {
    const { pathname: stored } = await uploadFileInChunks(pathname, file)
    return {
      url: storageUrlForKey(stored),
      filename: file.name,
      content_type: file.type || null,
    }
  }

  const { url } = await uploadToStorage(pathname, file, { access: 'private' })
  return {
    url,
    filename: file.name,
    content_type: file.type || null,
  }
}

export function TechFileControl({
  songId,
  fieldKey,
  value,
  kind,
  onSave,
  className,
}: {
  songId: string
  fieldKey: TechKey
  value: TechCellValue
  kind: 'pdf' | 'media' | 'midi'
  onSave: (next: TechCellValue) => Promise<void>
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const file = isFileRef(value) ? value : null
  const href = file ? resolveAssetUrl(file.url) ?? file.url : null
  const accept =
    kind === 'pdf'
      ? 'application/pdf,.pdf'
      : kind === 'midi'
        ? 'audio/midi,audio/mid,.mid,.midi,.syx'
        : 'audio/*,audio/midi,.wav,.mp3,.aiff,.aif,.m4a,.ogg,.flac,.mid,.midi'

  async function pick(list: FileList | null) {
    const next = list?.[0]
    if (!next) return
    if (kind === 'pdf' && next.type !== 'application/pdf' && !next.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Нужен PDF')
      return
    }
    if (kind === 'midi' && !isMidiName(next.name, next.type)) {
      toast.error('Нужен MIDI файл')
      return
    }
    if (kind === 'media' && !isMidiName(next.name, next.type) && !next.type.startsWith('audio/') && !/\.(wav|mp3|aiff?|m4a|ogg|flac)$/i.test(next.name)) {
      toast.error('Нужен audio или MIDI файл')
      return
    }
    setBusy(true)
    try {
      const uploaded = await uploadTechFile(songId, fieldKey, next, kind)
      await onSave(uploaded)
    } catch {
      toast.error('Не удалось загрузить файл')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const label = file ? (kind === 'pdf' ? 'PDF' : file.filename) : 'No'

  return (
    <div
      className={cn(
        'relative flex h-7 min-w-[5.5rem] items-stretch overflow-hidden',
        file
          ? 'bg-emerald-200/80 dark:bg-emerald-800/70'
          : 'bg-amber-200/80 dark:bg-amber-700/80',
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={(event) => pick(event.target.files)}
      />
      {busy ? (
        <span className="flex flex-1 items-center justify-center">
          <Loader2 className="size-3.5 animate-spin" />
        </span>
      ) : file && href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          title={file.filename}
          className="flex min-w-0 flex-1 items-center px-1.5 font-medium text-emerald-950 underline-offset-2 hover:underline dark:text-emerald-50"
        >
          <span className="truncate">{label}</span>
        </a>
      ) : (
        <button
          type="button"
          className="flex flex-1 items-center justify-center px-1 font-medium text-amber-950 dark:text-amber-50"
          title="Нажмите, чтобы загрузить файл"
          onClick={() => inputRef.current?.click()}
        >
          No
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="shrink-0 px-0.5 text-foreground/70 hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Действия с файлом"
            disabled={busy}
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => window.setTimeout(() => inputRef.current?.click(), 0)}>
            {file ? 'Заменить файл' : 'Загрузить файл'}
          </DropdownMenuItem>
          {href ? (
            <DropdownMenuItem asChild>
              <a href={href} target="_blank" rel="noreferrer">
                Открыть
              </a>
            </DropdownMenuItem>
          ) : null}
          {file ? (
            <DropdownMenuItem onSelect={() => onSave('no')}>Поставить No</DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function TechFileCell({
  songId,
  fieldKey,
  value,
  kind,
  onSave,
}: {
  songId: string
  fieldKey: TechKey
  value: TechCellValue
  kind: 'pdf' | 'media' | 'midi'
  onSave: (next: TechCellValue) => Promise<void>
}) {
  return (
    <td className="relative z-0 border border-border p-0">
      <TechFileControl
        songId={songId}
        fieldKey={fieldKey}
        value={value}
        kind={kind}
        onSave={onSave}
        className="max-w-[9rem]"
      />
    </td>
  )
}
