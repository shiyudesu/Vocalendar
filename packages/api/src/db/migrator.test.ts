import { describe, expect, test } from 'vitest'

import { listSqlMigrationFiles, runPendingSqlMigrations } from './migrator.js'

describe('listSqlMigrationFiles', () => {
  test('loads sql migrations from the migrations directory in lexical order', async () => {
    const files = await listSqlMigrationFiles()

    expect(files.length).toBeGreaterThan(0)
    expect(files.map((file) => file.name)).toEqual([...files.map((file) => file.name)].sort())
    expect(files[0]?.name).toBe('0001_phase1_foundation.sql')
    expect(files[0]?.sql).toContain('create table if not exists users')
  })

  test('runs only pending migrations and records them in order', async () => {
    const statements: string[] = []
    const appliedNames: string[] = ['0001_phase1_foundation.sql']

    await runPendingSqlMigrations(
      {
        async query(sql, params) {
          statements.push(sql)

          if (sql.includes('select name from schema_migrations')) {
            return {
              rows: appliedNames.map((name) => ({ name })),
            }
          }

          if (sql.startsWith('insert into schema_migrations')) {
            appliedNames.push(String(params?.[0]))
          }

          return { rows: [] }
        },
      },
      [
        {
          name: '0001_phase1_foundation.sql',
          path: '/tmp/0001.sql',
          sql: 'select 1;',
        },
        {
          name: '0002_auth.sql',
          path: '/tmp/0002.sql',
          sql: 'select 2;',
        },
      ],
    )

    expect(
      statements.some((statement) =>
        statement.includes('create table if not exists schema_migrations'),
      ),
    ).toBe(true)
    expect(statements.some((statement) => statement === 'select 2;')).toBe(true)
    expect(statements.some((statement) => statement === 'select 1;')).toBe(false)
    expect(appliedNames).toEqual(['0001_phase1_foundation.sql', '0002_auth.sql'])
  })
})
