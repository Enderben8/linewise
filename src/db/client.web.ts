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
 *
 * The database files live in the browser's private file system, which one page at a time may write
 * to, so pages queue for a lock before opening it.
 */
function open() {
  const sqlite = openDatabaseSync('linewise.db');
  sqlite.execSync('PRAGMA foreign_keys = ON;');
  return drizzle(sqlite, { schema });
}

type Db = ReturnType<typeof open>;

export let db: Db = undefined as unknown as Db;

let ready: Promise<void> | null = null;

const DB_LOCK = 'linewise-db';
/** How long to wait for another page to let go, which covers a page being replaced by a reload. */
const LOCK_WAIT_MS = 3000;
const RELOADED = 'linewise-db-reloaded';

class DatabaseBusyError extends Error {}

/** True when another tab or window holds the database, rather than the database being broken. */
export function isDatabaseBusy(error: unknown): boolean {
  return error instanceof DatabaseBusyError;
}

/** The browser refused a file the other page still holds. */
function isFileHeld(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return /NoModificationAllowedError|Access Handles cannot be created/.test(text);
}

/** sessionStorage is per tab, and can throw when the browser blocks site data. */
function reloadedAlready(): boolean {
  try {
    return sessionStorage.getItem(RELOADED) === '1';
  } catch {
    return true;
  }
}
function rememberReload(remember: boolean): void {
  try {
    if (remember) sessionStorage.setItem(RELOADED, '1');
    else sessionStorage.removeItem(RELOADED);
  } catch {
    // Site data is blocked; without it the page simply does not retry.
  }
}

/**
 * Takes the lock and holds it for as long as the page lives. Resolves false when another page keeps
 * it for longer than LOCK_WAIT_MS, which means Linewise is open somewhere else.
 */
function holdDatabaseLock(): Promise<boolean> {
  if (!navigator.locks) return Promise.resolve(true);
  const giveUp = new AbortController();
  const timer = setTimeout(() => giveUp.abort(), LOCK_WAIT_MS);
  return new Promise((resolve) => {
    navigator.locks
      .request(DB_LOCK, { signal: giveUp.signal }, () => {
        clearTimeout(timer);
        resolve(true);
        // Never resolving keeps the lock until this page goes away.
        return new Promise(() => {});
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(false);
      });
  });
}

export function initDatabase(): Promise<void> {
  ready ??= (async () => {
    if (!(await holdDatabaseLock())) {
      throw new DatabaseBusyError('Linewise is open in another tab or window');
    }
    try {
      const warm = await openDatabaseAsync('linewise.db');
      await warm.getFirstAsync('SELECT 1');
      await warm.closeAsync();
      db = open();
      rememberReload(false);
    } catch (e) {
      if (!isFileHeld(e)) throw e;
      // The page being replaced can hold the files for a moment after letting go of the lock. The
      // worker cannot open the database again once its first try failed, so reload the page; if that
      // does not help either, another page really does have it.
      if (!reloadedAlready()) {
        rememberReload(true);
        window.location.reload();
        await new Promise(() => {});
      }
      throw new DatabaseBusyError('Linewise is open in another tab or window');
    }
  })();
  return ready;
}
