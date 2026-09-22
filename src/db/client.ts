import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import { schema } from './schema';

const sqlite = openDatabaseSync('linewise.db');
sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });
export type Db = typeof db;

/** On Android the database opens synchronously at import. The web version needs a warm-up; see client.web.ts. */
export function initDatabase(): Promise<void> {
  return Promise.resolve();
}

/** Only a browser can find the database held by another page; on Android it never is. */
export function isDatabaseBusy(_error: unknown): boolean {
  return false;
}
