/** Извлекает S3-ключ из URL в БД (legacy Vercel Blob или новый формат). */
export function extractStorageKey(storedUrl: string): string | null {
  if (!storedUrl) return null

  // Уже ключ без URL
  if (!storedUrl.includes('://') && !storedUrl.startsWith('/api/')) {
    return storedUrl.replace(/^\/+/, '')
  }

  try {
    const url = storedUrl.startsWith('http')
      ? new URL(storedUrl)
      : new URL(storedUrl, 'http://localhost')

    const keyParam = url.searchParams.get('key') ?? url.searchParams.get('pathname')
    if (keyParam) return decodeURIComponent(keyParam)

    // Прямой MinIO/S3 URL: .../marinero-public/marinero/gallery/foo.jpg
    const publicBase = process.env.NEXT_PUBLIC_STORAGE_URL
    if (publicBase && storedUrl.startsWith(publicBase)) {
      return storedUrl.slice(publicBase.length).replace(/^\//, '')
    }
  } catch {
    return null
  }

  return null
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)$/i

/** Определяет бакет по пути файла в Blob/MinIO. */
export function resolveBucket(key: string): 'public' | 'private' {
  const normalized = key.replace(/^\/+/, '')

  if (normalized.startsWith('temp-chunks/')) return 'private'
  if (normalized.startsWith('marinero/gallery/')) return 'public'
  if (normalized.startsWith('marinero/audio/')) return 'private'
  if (normalized.startsWith('multitrack/')) return 'private'

  // Обложки альбомов / событий: marinero/1234-abc.jpg
  if (normalized.startsWith('marinero/') && IMAGE_EXT.test(normalized)) {
    return 'public'
  }

  return 'private'
}

export function isStreamableKey(key: string): boolean {
  return !key.startsWith('temp-chunks/')
}

/** URL для отдачи через Next.js (приватные файлы и legacy записи). */
export function fileApiUrl(key: string): string {
  return `/api/file?key=${encodeURIComponent(key)}`
}

/** URL для аудио с поддержкой Range (репетиции, мультитреки). */
export function audioStreamUrl(key: string): string {
  return `/api/audio/stream?key=${encodeURIComponent(key)}`
}

/** Прямой публичный URL (фото галереи, обложки). */
export function publicAssetUrl(key: string): string | null {
  if (resolveBucket(key) !== 'public') return null
  const base = process.env.NEXT_PUBLIC_STORAGE_URL?.replace(/\/$/, '')
  if (!base) return null
  return `${base}/${key}`
}

/** Лучший URL для сохранения в БД. */
export function storageUrlForKey(key: string): string {
  return publicAssetUrl(key) ?? fileApiUrl(key)
}

/** MIME по расширению (без зависимостей). */
export function guessContentType(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    flac: 'audio/flac',
  }
  return map[ext ?? ''] ?? 'application/octet-stream'
}
