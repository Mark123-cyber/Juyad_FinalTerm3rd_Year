import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

test('existing reports gain campus and open status without losing their original data', () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'slsu-lost-and-found-migration-'))
  const databasePath = join(temporaryDirectory, 'legacy.sqlite')
  const legacyDb = new DatabaseSync(databasePath)

  legacyDb.exec(`
    CREATE TABLE campuses (name TEXT PRIMARY KEY);
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      login TEXT NOT NULL COLLATE NOCASE UNIQUE,
      campus TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT NOT NULL,
      type TEXT NOT NULL,
      reporter TEXT NOT NULL,
      date TEXT NOT NULL,
      created_by TEXT
    );
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    INSERT INTO users (id, full_name, login, campus, role, password_hash, created_at)
    VALUES ('legacy-student', 'Legacy Student', 'legacy-student', 'Sogod', 'user', 'unused', '2025-01-01');
    INSERT INTO items (id, title, description, location, type, reporter, date, created_by)
    VALUES ('legacy-item', 'Old backpack', 'Blue backpack', 'Library', 'lost', 'Legacy Student', '2025-01-02', 'legacy-student');
  `)
  legacyDb.close()

  try {
    const serverPath = fileURLToPath(new URL('./index.js', import.meta.url))
    const serverUrl = pathToFileURL(serverPath).href
    const script = `
      const { db } = await import(${JSON.stringify(serverUrl)})
      const item = db.prepare('SELECT title, campus, status FROM items WHERE id = ?').get('legacy-item')
      console.log(JSON.stringify(item))
      db.close()
    `
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        DB_PATH: databasePath,
        ADMIN_USERNAME: 'migration-admin',
        ADMIN_PASSWORD: 'migration-admin-password-123',
        NODE_ENV: 'test',
        SMTP_HOST: '',
        SMTP_FROM: '',
        SMTP_USER: '',
        SMTP_PASSWORD: '',
      },
    })

    assert.equal(result.status, 0, result.stderr)
    const migratedItem = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1))
    assert.deepEqual(migratedItem, { title: 'Old backpack', campus: 'Sogod', status: 'open' })
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
})
