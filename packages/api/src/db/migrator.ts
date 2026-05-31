import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type SqlMigrationFile = {
  name: string
  path: string
  sql: string
}

export type SqlResultRow = {
  name: string
}

export type MigrationSqlClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: SqlResultRow[] }>
}

export type SqlExecutor = MigrationSqlClient & {
  execute?: (sql: string) => Promise<void>
}

const defaultMigrationsDirectory = fileURLToPath(new URL('./migrations', import.meta.url))

export async function listSqlMigrationFiles(directory = defaultMigrationsDirectory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const migrationNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  return Promise.all(
    migrationNames.map(async (name) => {
      const migrationPath = path.join(directory, name)
      const sql = await readFile(migrationPath, 'utf8')

      return {
        name,
        path: migrationPath,
        sql,
      } satisfies SqlMigrationFile
    }),
  )
}

export async function applySqlMigrations(executor: SqlExecutor, files?: SqlMigrationFile[]) {
  const migrationFiles = files ?? (await listSqlMigrationFiles())

  for (const file of migrationFiles) {
    if (executor.execute) {
      await executor.execute(file.sql)
      continue
    }

    await executor.query(file.sql)
  }
}

export async function runPendingSqlMigrations(
  client: MigrationSqlClient,
  files?: SqlMigrationFile[],
) {
  const migrationFiles = files ?? (await listSqlMigrationFiles())

  await client.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `)

  const result = await client.query('select name from schema_migrations order by name asc')
  const appliedNames = new Set(result.rows.map((row) => row.name))

  for (const file of migrationFiles) {
    if (appliedNames.has(file.name)) {
      continue
    }

    await client.query(file.sql)
    await client.query('insert into schema_migrations (name) values ($1)', [file.name])
  }
}
