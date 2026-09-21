/**
 * Test-only: an in-memory SQLite database with the real migrations applied, wrapped in the same
 * Drizzle sync API the app uses on the phone. Never imported by app code.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrations } from './migrations';
import { schema } from './schema';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  for (const entry of migrations.journal.entries) {
    const key = `m${String(entry.idx).padStart(4, '0')}` as keyof typeof migrations.migrations;
    for (const statement of migrations.migrations[key].split('--> statement-breakpoint')) {
      sqlite.exec(statement);
    }
  }
  return drizzle(sqlite, { schema });
}

export type TestDb = ReturnType<typeof createTestDb>;
