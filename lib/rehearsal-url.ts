const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/** Normalizes rehearsal_date (Date, ISO string, or yyyy-MM-dd) to yyyy-MM-dd for URLs. */
export function rehearsalDateSlug(rehearsalDate: string | Date): string {
  if (rehearsalDate instanceof Date) {
    if (Number.isNaN(rehearsalDate.getTime())) return ''
    const y = rehearsalDate.getUTCFullYear()
    const m = String(rehearsalDate.getUTCMonth() + 1).padStart(2, '0')
    const d = String(rehearsalDate.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const value = String(rehearsalDate)
  return value.includes('T') ? value.slice(0, 10) : value
}

export function adminRehearsalUrl(
  rehearsalDate: string | Date,
  query?: Record<string, string | undefined>
): string {
  const base = `/admin/rehearsals/${rehearsalDateSlug(rehearsalDate)}`
  if (!query) return base

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}
