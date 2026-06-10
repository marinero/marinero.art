/**
 * Pure-JS full database backup.
 *
 * Produces a single, restorable SQL file (data dump) for every base table in
 * the `public` schema. It introspects the live schema, orders tables by their
 * foreign-key dependencies and emits typed, properly escaped INSERT statements.
 *
 * No external binaries (pg_dump) are required — it works anywhere the app can
 * reach the database, including the standalone Node production container.
 *
 * The dump restores onto a freshly-initialised schema (init.sql + migrations).
 */

// Minimal queryable interface satisfied by both `lib/db` and a raw pg Pool.
export interface BackupClient {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
}

interface ColumnMeta {
  column_name: string
  data_type: string
  udt_name: string
}

const NUMERIC_TYPES = new Set([
  'smallint',
  'integer',
  'bigint',
  'numeric',
  'decimal',
  'real',
  'double precision',
])

const ROWS_PER_INSERT = 50

function quoteIdent(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"'
}

function escapeString(value: string): string {
  // Postgres standard_conforming_strings is on by default → only single
  // quotes need doubling.
  return "'" + value.replace(/'/g, "''") + "'"
}

function formatArrayLiteral(arr: unknown[]): string {
  const parts = arr.map((el) => {
    if (el === null || el === undefined) return 'NULL'
    if (typeof el === 'number' || typeof el === 'boolean') return String(el)
    const s = String(el).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return `"${s}"`
  })
  return `'{${parts.join(',')}}'`
}

function formatValue(value: unknown, col: ColumnMeta): string {
  if (value === null || value === undefined) return 'NULL'

  const dt = col.data_type

  if (dt === 'jsonb' || dt === 'json') {
    return escapeString(JSON.stringify(value)) + '::' + dt
  }

  if (dt === 'ARRAY') {
    const arr = Array.isArray(value) ? value : [value]
    const elemType = col.udt_name.replace(/^_/, '')
    return formatArrayLiteral(arr) + '::' + elemType + '[]'
  }

  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'

  if (NUMERIC_TYPES.has(dt)) {
    // node-postgres returns numeric/bigint as strings, ints as numbers.
    return String(value)
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value)
  }

  if (value instanceof Date) {
    return escapeString(value.toISOString())
  }

  if (typeof value === 'object') {
    // Defensive fallback for unexpected object values.
    return escapeString(JSON.stringify(value))
  }

  return escapeString(String(value))
}

/**
 * Topologically sort tables so that referenced (parent) tables come before
 * tables that reference them. Self-references are ignored. Any remaining
 * tables involved in cycles are appended at the end.
 */
function sortByDependencies(
  tables: string[],
  fkPairs: { child: string; parent: string }[]
): string[] {
  const tableSet = new Set(tables)
  const indegree = new Map<string, number>()
  const dependents = new Map<string, Set<string>>()
  for (const t of tables) {
    indegree.set(t, 0)
    dependents.set(t, new Set())
  }

  const seenEdges = new Set<string>()
  for (const { child, parent } of fkPairs) {
    if (child === parent) continue
    if (!tableSet.has(child) || !tableSet.has(parent)) continue
    const edgeKey = `${parent}->${child}`
    if (seenEdges.has(edgeKey)) continue
    seenEdges.add(edgeKey)
    dependents.get(parent)!.add(child)
    indegree.set(child, (indegree.get(child) ?? 0) + 1)
  }

  const queue = tables.filter((t) => (indegree.get(t) ?? 0) === 0).sort()
  const ordered: string[] = []
  const visited = new Set<string>()

  while (queue.length > 0) {
    const node = queue.shift()!
    if (visited.has(node)) continue
    visited.add(node)
    ordered.push(node)
    for (const dep of [...dependents.get(node)!].sort()) {
      indegree.set(dep, (indegree.get(dep) ?? 0) - 1)
      if ((indegree.get(dep) ?? 0) === 0) queue.push(dep)
    }
  }

  // Append any tables left out due to cycles.
  for (const t of tables) {
    if (!visited.has(t)) ordered.push(t)
  }

  return ordered
}

export async function generateBackupSql(client: BackupClient): Promise<string> {
  const { rows: dbRows } = await client.query('SELECT current_database() AS db')
  const dbName = (dbRows[0]?.db as string) ?? 'unknown'

  const { rows: tableRows } = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  )
  const tables = tableRows.map((r) => r.table_name as string)

  const { rows: columnRows } = await client.query(
    `SELECT table_name, column_name, data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position`
  )
  const columnsByTable = new Map<string, ColumnMeta[]>()
  for (const r of columnRows) {
    const t = r.table_name as string
    if (!columnsByTable.has(t)) columnsByTable.set(t, [])
    columnsByTable.get(t)!.push({
      column_name: r.column_name as string,
      data_type: r.data_type as string,
      udt_name: r.udt_name as string,
    })
  }

  const { rows: fkRows } = await client.query(
    `SELECT tc.table_name AS child, ccu.table_name AS parent
     FROM information_schema.table_constraints tc
     JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = 'public'`
  )
  const fkPairs = fkRows.map((r) => ({
    child: r.child as string,
    parent: r.parent as string,
  }))

  const orderedTables = sortByDependencies(tables, fkPairs)

  const out: string[] = []
  out.push('-- ============================================================')
  out.push('-- MARINERO full database backup (data dump)')
  out.push(`-- Database:  ${dbName}`)
  out.push(`-- Generated: ${new Date().toISOString()}`)
  out.push('--')
  out.push('-- Restore onto a freshly-initialised schema (init.sql + migrations):')
  out.push('--   psql "$DATABASE_URL" -f marinero-backup-<date>.sql')
  out.push('-- ============================================================')
  out.push('')
  out.push('BEGIN;')
  out.push('')

  for (const table of orderedTables) {
    const cols = columnsByTable.get(table) ?? []
    if (cols.length === 0) continue

    const { rows } = await client.query(`SELECT * FROM ${quoteIdent(table)}`)
    out.push(`-- ${table} (${rows.length} rows)`)

    if (rows.length === 0) {
      out.push('')
      continue
    }

    const colList = cols.map((c) => quoteIdent(c.column_name)).join(', ')

    for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
      const chunk = rows.slice(i, i + ROWS_PER_INSERT)
      const valuesLines = chunk.map((row) => {
        const vals = cols.map((c) => formatValue(row[c.column_name], c))
        return `  (${vals.join(', ')})`
      })
      out.push(`INSERT INTO ${quoteIdent(table)} (${colList}) VALUES`)
      out.push(valuesLines.join(',\n') + ';')
    }
    out.push('')
  }

  out.push('COMMIT;')
  out.push('')

  return out.join('\n')
}
