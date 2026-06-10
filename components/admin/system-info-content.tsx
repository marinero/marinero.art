import { Badge } from '@/components/ui/badge'
import { Server, Database, GitCommitHorizontal, Clock } from 'lucide-react'
import type { DeploymentKind, SystemInfo } from '@/lib/system-info'

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function InfoList({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5">
      {children}
    </dl>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground whitespace-nowrap">{label}</dt>
      <dd className="text-sm font-medium break-all m-0 min-w-0">{value}</dd>
    </>
  )
}

export const deploymentBannerClass: Record<DeploymentKind, string> = {
  local: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  production: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  development: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
}

export function deploymentShortLabel(kind: DeploymentKind): string {
  switch (kind) {
    case 'local':
      return 'Docker'
    case 'production':
      return 'Прод'
    case 'development':
      return 'Dev'
  }
}

export function SystemInfoContent({ info }: { info: SystemInfo }) {
  const { database: db, deployment } = info
  const isProd = info.nodeEnv === 'production'

  return (
    <div className="space-y-4">
      <div
        className={`rounded-lg border px-3 py-2.5 ${deploymentBannerClass[deployment.kind]}`}
      >
        <p className="text-sm font-semibold">{deployment.label}</p>
        {deployment.siteUrl ? (
          <p className="text-xs font-mono mt-0.5 opacity-90">{deployment.siteUrl}</p>
        ) : null}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <Server className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Бэкенд</span>
        </div>
        <InfoList>
          <InfoRow
            label="Окружение"
            value={
              <Badge variant={isProd ? 'default' : 'secondary'}>{info.nodeEnv}</Badge>
            }
          />
          <InfoRow
            label="Версия (сборка)"
            value={
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {formatDateTime(info.buildTime)}
              </span>
            }
          />
          {info.gitSha ? (
            <InfoRow
              label="Git"
              value={
                <span className="inline-flex items-center gap-1 font-mono text-xs">
                  <GitCommitHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  {info.gitSha}
                </span>
              }
            />
          ) : null}
        </InfoList>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">База данных</span>
        </div>
        <InfoList>
          <InfoRow
            label="Статус"
            value={
              <Badge variant={db.reachable ? 'default' : 'destructive'}>
                {db.reachable ? 'подключена' : 'нет связи'}
              </Badge>
            }
          />
          <InfoRow
            label="Хост"
            value={
              <span className="font-mono text-xs">
                {db.host}
                {db.port ? `:${db.port}` : ''}
              </span>
            }
          />
          <InfoRow label="База" value={<span className="font-mono text-xs">{db.database}</span>} />
          {db.user ? (
            <InfoRow label="Пользователь" value={<span className="font-mono text-xs">{db.user}</span>} />
          ) : null}
          {db.serverVersion ? (
            <InfoRow label="PostgreSQL" value={<span className="text-xs">{db.serverVersion}</span>} />
          ) : null}
          {db.serverTime ? (
            <InfoRow label="Время сервера БД" value={<span className="text-xs">{formatDateTime(db.serverTime)}</span>} />
          ) : null}
          {db.error ? (
            <InfoRow
              label="Ошибка"
              value={<span className="text-xs text-destructive">{db.error}</span>}
            />
          ) : null}
        </InfoList>
      </div>
    </div>
  )
}
