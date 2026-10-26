// Minimal promise-based IndexedDB wrapper. Hand-rolled instead of pulling in
// Dexie because we need four tiny object stores and nothing else — the whole
// surface used by the app is get/put/getAll/delete.
//
// IndexedDB (not sessionStorage/localStorage) because the offline sales queue
// has to survive the tab being closed, the browser crashing and the device
// rebooting. sessionStorage dies with the tab and localStorage is capped at a
// few MB of strings.

const DB_NAME = "pippo_offline";
const DB_VERSION = 1;

export const STORE = {
  /** Cached POS catalog, keyed by branch id. */
  catalog: "catalog",
  /** Sales waiting to reach the server, keyed by idempotency key. */
  salesQueue: "sales_queue",
  /** Reserved daily_number ranges, keyed by `${branchId}:${day}`. */
  numberBlocks: "number_blocks",
  /** Small key/value bag (last sync timestamp, device id, ...). */
  meta: "meta",
} as const;

export type StoreName = (typeof STORE)[keyof typeof STORE];

let dbPromise: Promise<IDBDatabase> | null = null;

export function isOfflineStorageAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!isOfflineStorageAvailable()) {
      reject(new Error("IndexedDB no disponible en este navegador"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of Object.values(STORE)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // Another tab holds an older version open — without this the promise would
    // hang forever instead of surfacing a usable error.
    request.onblocked = () => reject(new Error("IndexedDB bloqueada por otra pestaña"));
  });

  // A failed open must not be cached, or every later call reuses the rejection.
  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

function runTransaction<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  action: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = action(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export function dbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  return runTransaction<T | undefined>(store, "readonly", (s) => s.get(key));
}

export function dbGetAll<T>(store: StoreName): Promise<T[]> {
  return runTransaction<T[]>(store, "readonly", (s) => s.getAll());
}

export function dbPut(store: StoreName, key: string, value: unknown): Promise<unknown> {
  return runTransaction(store, "readwrite", (s) => s.put(value, key));
}

export function dbDelete(store: StoreName, key: string): Promise<unknown> {
  return runTransaction(store, "readwrite", (s) => s.delete(key));
}

export function dbClear(store: StoreName): Promise<unknown> {
  return runTransaction(store, "readwrite", (s) => s.clear());
}

/**
 * Asks the browser not to evict our data when disk gets tight. Matters because
 * an evicted sales queue means losing sales that never reached the server.
 * Granted silently for installed PWAs in most browsers; best-effort elsewhere.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
