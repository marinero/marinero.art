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
