// IndexedDB cache of the game manual, per season, in this browser only (no Firebase Storage on Spark).
const DB = '3dm-manual'
const STORE = 'pdfs'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = op(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    })
  } finally { db.close() }
}

export const pdfCache = {
  put: (sid: string, bytes: Uint8Array): Promise<void> => run<unknown>('readwrite', (s) => s.put(bytes, sid)).then(() => undefined),
  async get(sid: string): Promise<Uint8Array | null> {
    const v = await run<unknown>('readonly', (s) => s.get(sid))
    return v instanceof Uint8Array ? v : v instanceof ArrayBuffer ? new Uint8Array(v) : null
  },
}
