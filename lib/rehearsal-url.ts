const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/** Normalizes rehearsal_date (date or ISO) to yyyy-MM-dd for URLs. */
export function rehearsalDateSlug(rehearsalDate: string): string {
  return rehearsalDate.includes('T') ? rehearsalDate.slice(0, 10) : rehearsalDate
}

export function adminRehearsalUrl(
  rehearsalDate: string,
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
