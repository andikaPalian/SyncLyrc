import type { LrcDocument } from "@/types/lrc";

const DB_NAME = "synclrc_cache_db";
const STORE_NAME = "lrc_documents";
const DB_VERSION = 1;

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedLrc(hashKey: string): Promise<LrcDocument | null> {
  try {
    const db = await openCacheDb();
    return await new Promise<LrcDocument | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(hashKey);
      req.onsuccess = () => resolve((req.result as LrcDocument) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveCachedLrc(
  hashKey: string,
  doc: LrcDocument
): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(doc, hashKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Non-fatal if IndexedDB is blocked
  }
}
