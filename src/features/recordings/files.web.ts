import { useEffect, useState } from 'react';

/**
 * Browsers have no app file system, so recordings are kept as blobs in IndexedDB. The database row
 * stores `idb:<id>`; playback turns that into a temporary object URL.
 */
const DB_NAME = 'linewise-recordings';
const STORE = 'audio';
const PREFIX = 'idb:';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = action(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export function deleteAudioFiles(uris: string[]): void {
  for (const uri of uris) {
    if (!uri.startsWith(PREFIX)) continue;
    run('readwrite', (s) => s.delete(uri.slice(PREFIX.length))).catch(() => {
      // A missing entry must not block deleting the database row.
    });
  }
}

/** Stores the recorder's output (a blob: URL on the web) and returns the reference to save. */
export async function persistRecording(tempUri: string, id: string): Promise<string> {
  // Reads the recorder's in-memory blob. Only blob: URLs are accepted, so this never touches the network.
  if (!tempUri.startsWith('blob:')) throw new Error('Expected a blob: URL from the recorder');
  const blob = await (await fetch(tempUri)).blob();
  await run('readwrite', (s) => s.put(blob, id));
  if (tempUri.startsWith('blob:')) URL.revokeObjectURL(tempUri);
  return PREFIX + id;
}

export function usePlayableUri(storedUri: string): string | null {
  // The object URL is remembered with the reference it was made for, so a stale one is never used.
  const [loaded, setLoaded] = useState<{ for: string; url: string } | null>(null);
  const stored = storedUri.startsWith(PREFIX);
  useEffect(() => {
    if (!stored) return;
    let objectUrl: string | null = null;
    let live = true;
    run<Blob | undefined>('readonly', (s) => s.get(storedUri.slice(PREFIX.length)))
      .then((blob) => {
        if (!live || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ for: storedUri, url: objectUrl });
      })
      .catch(() => {});
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [storedUri, stored]);
  if (!stored) return storedUri;
  return loaded?.for === storedUri ? loaded.url : null;
}
