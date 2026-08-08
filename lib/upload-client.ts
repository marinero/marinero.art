'use client'

/** Загрузка файла в MinIO/S3 через наш API (замена @vercel/blob/client). */
export async function uploadToStorage(
  pathname: string,
  file: File | Blob,
  options?: { access?: 'public' | 'private' | 'auto' }
): Promise<{ pathname: string; url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('pathname', pathname)
  if (options?.access) {
    formData.append('access', options.access)
  }

  const response = await fetch('/api/upload/file', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Upload failed')
  }

  const data = await response.json()
  return { pathname: data.pathname, url: data.url }
}

/** Совместимость с прежним API @vercel/blob/client upload(). */
export async function upload(
  pathname: string,
  file: File | Blob,
  options?: { access?: 'public' | 'private' }
): Promise<{ pathname: string; url: string }> {
  return uploadToStorage(pathname, file, { access: options?.access ?? 'auto' })
}

const CHUNK_SIZE = 2 * 1024 * 1024 // 2MB

/**
 * Загрузка файла чанками через /api/upload/multitrack-chunk.
 * Обходит таймауты обратного прокси и лимиты размера тела запроса,
 * т.к. каждый чанк — отдельный короткий POST. Возвращает итоговый S3-ключ.
 */
export async function uploadFileInChunks(
  pathname: string,
  file: File | Blob,
  onProgress?: (percent: number) => void
): Promise<{ pathname: string }> {
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE))
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const contentType = (file as File).type || 'audio/mpeg'

  let finalPathname = ''

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    const params = new URLSearchParams({
      uploadId,
      chunkIndex: i.toString(),
      totalChunks: totalChunks.toString(),
      filename: pathname,
    })

    const response = await fetch(`/api/upload/multitrack-chunk?${params}`, {
      method: 'POST',
      body: chunk,
      credentials: 'include',
      headers: { 'Content-Type': contentType },
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Upload failed')
    }

    const result = await response.json()
    if (result.complete && result.pathname) {
      finalPathname = result.pathname
    }

    onProgress?.(Math.round(((i + 1) / totalChunks) * 100))
  }

  if (!finalPathname) {
    throw new Error('Upload completed but no pathname returned')
  }

  return { pathname: finalPathname }
}
