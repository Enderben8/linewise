import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync, openDatabaseSync } from 'expo-sqlite';
import { schema } from './schema';

/**
 * On the web, expo-sqlite runs SQLite (WebAssembly) in a worker, and each synchronous call spins
 * only briefly waiting for the reply. At startup the worker has not loaded yet, so a synchronous
 * open times out. initDatabase() starts the worker with an async open first; after that the same
 * synchronous Drizzle API the Android app uses works unchanged.
 *
 * `db` is assigned once initDatabase() resolves. The root layout renders nothing that touches the
 * database before then.
 */
function open() {
  const sqlite = openDatabaseSync('linewise.db');
  sqlite.execSync('PRAGMA foreign_keys = ON;');
  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof open>;

export let db: Db = undefined as unknown as Db;

let ready: Promise<void> | null = null;

export function initDatabase(): Promise<void> {
  ready ??= (async () => {
    const warm = await openDatabaseAsync('linewise.db');
    await warm.getFirstAsync('SELECT 1');
    await warm.closeAsync();
    db = open();
  })();
  return ready;
}
