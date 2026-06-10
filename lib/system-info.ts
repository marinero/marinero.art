import { db } from '@/lib/db'

export type DatabaseInfo = {
  host: string
  port: string
  database: string
  user: string
  serverVersion: string | null
  serverTime: string | null
  reachable: boolean
  error?: string
}

export type DeploymentKind = 'local' | 'production' | 'development'

export type DeploymentInfo = {
  kind: DeploymentKind
  label: string
  siteUrl: string | null
}

export type SystemInfo = {
  buildTime: string | null
  gitSha: string | null
  nodeEnv: string
  deployment: DeploymentInfo
  database: DatabaseInfo
}

function resolveDeployment(
  siteUrl: string | null,
  nodeEnv: string,
  dbHost: string
): DeploymentInfo {
  const url = (siteUrl || '').toLowerCase()
  const isLocalUrl =
    url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0')
  const isDockerDb = dbHost === 'postgres' || dbHost === 'localhost'

  if (isLocalUrl || (isDockerDb && nodeEnv !== 'production')) {
    return {
      kind: 'local',
      label: 'Локальный сервер (Docker)',
      siteUrl,
    }
  }

  if (nodeEnv === 'production') {
    return {
      kind: 'production',
      label: 'Продакшен',
      siteUrl,
    }
  }

  return {
    kind: 'development',
    label: 'Разработка',
    siteUrl,
  }
}

function parseDatabaseUrl(url: string | undefined): {
  host: string
  port: string
  database: string
  user: string
} {
  const fallback = { host: 'unknown', port: '', database: 'unknown', user: '' }
  if (!url) return fallback
  try {
    const parsed = new URL(url)
    return {
      host: parsed.hostname || fallback.host,
      port: parsed.port || '5432',
      database: parsed.pathname.replace(/^\//, '') || fallback.database,
      user: decodeURIComponent(parsed.username) || fallback.user,
    }
  } catch {
    return fallback
  }
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const conn = parseDatabaseUrl(process.env.DATABASE_URL)

  const database: DatabaseInfo = {
    ...conn,
    serverVersion: null,
    serverTime: null,
    reachable: false,
  }

  try {
    const row = await db.queryOne<{
      version: string
      now: string
      current_database: string
    }>(
      `SELECT version() AS version, now()::text AS now, current_database() AS current_database`
    )
    if (row) {
      // version() возвращает длинную строку, берём только "PostgreSQL X.Y ..."
      const match = row.version.match(/PostgreSQL\s+[\d.]+/i)
      database.serverVersion = match ? match[0] : row.version.split(' ').slice(0, 2).join(' ')
      database.serverTime = row.now
      database.database = row.current_database || database.database
      database.reachable = true
    }
  } catch (e) {
    database.error = e instanceof Error ? e.message : String(e)
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || null
  const nodeEnv = process.env.NODE_ENV || 'development'

  return {
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || null,
    gitSha: process.env.NEXT_PUBLIC_GIT_SHA || null,
    nodeEnv,
    deployment: resolveDeployment(siteUrl, nodeEnv, database.host),
    database,
  }
}
