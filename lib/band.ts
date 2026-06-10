// Инструменты/роли для временной шкалы и карточек участников.
// Ключ хранится в БД (member_timeline.role), цвет и подпись — здесь.

export interface BandRole {
  key: string
  label: string
  color: string
}

export const BAND_ROLES: BandRole[] = [
  { key: 'vocal', label: 'Вокал', color: '#e11d2e' },
  { key: 'backing_vocal', label: 'Бэк-вокал', color: '#f4a6c0' },
  { key: 'guitar1', label: 'Гитара 1', color: '#16a34a' },
  { key: 'guitar2', label: 'Гитара 2', color: '#84cc16' },
  { key: 'bass', label: 'Бас-гитара', color: '#2563eb' },
  { key: 'keys', label: 'Клавишные', color: '#7c2da8' },
  { key: 'sax', label: 'Саксофон', color: '#6b7280' },
  { key: 'flute', label: 'Флейта', color: '#06b6d4' },
  { key: 'drums', label: 'Ударные', color: '#f59e0b' },
]

const ROLE_MAP: Record<string, BandRole> = Object.fromEntries(
  BAND_ROLES.map((r) => [r.key, r])
)

// Старый ключ 'guitar' (до разделения на Гитару 1/2) — для совместимости
const ROLE_ALIASES: Record<string, string> = {
  guitar: 'guitar1',
}

function resolveKey(key: string): string {
  return ROLE_ALIASES[key] ?? key
}

export function getRole(key: string): BandRole | undefined {
  return ROLE_MAP[resolveKey(key)]
}

export function getRoleColor(key: string): string {
  return ROLE_MAP[resolveKey(key)]?.color ?? '#9ca3af'
}

export function getRoleLabel(key: string): string {
  return ROLE_MAP[resolveKey(key)]?.label ?? key
}

// Цвет вертикальных меток студийных альбомов на шкале
export const ALBUM_MARKER_COLOR = '#111827'
export const ALBUM_MARKER_LABEL = 'Студийный альбом'
