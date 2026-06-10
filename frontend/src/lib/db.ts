/**
 * VEF Offline DB — Wrapper de IndexedDB para modo sin conexión.
 * Stores: productos, categorias, kv (clave-valor), outbox (cola de escrituras).
 * Port TS del antiguo window.vefDB; ahora se importa como singleton `db`.
 */
import type { OutboxEntry, OutboxOp } from './types'

const DB_NAME = 'vef-offline'
const DB_VERSION = 1

type StoreName = 'productos' | 'categorias' | 'kv' | 'outbox'

class VefDB {
  private _p: Promise<IDBDatabase> | null = null

  open(): Promise<IDBDatabase> {
    if (this._p) return this._p
    this._p = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result
        ;(
          [
            ['productos', { keyPath: 'id' }],
            ['categorias', { keyPath: 'id' }],
            ['kv', { keyPath: 'k' }],
          ] as const
        ).forEach(([name, opts]) => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, opts)
        })
        if (!db.objectStoreNames.contains('outbox')) {
          const ob = db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true })
          ob.createIndex('by_ts', 'ts')
        }
      }
      req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
      req.onerror = () => reject(req.error)
    })
    return this._p
  }

  // ── Helpers genéricos ──────────────────────────────────────────────────
  async getAll<T = unknown>(store: StoreName): Promise<T[]> {
    const db = await this.open()
    return new Promise((res, rej) => {
      const r = db.transaction(store, 'readonly').objectStore(store).getAll()
      r.onsuccess = () => res(r.result as T[])
      r.onerror = () => rej(r.error)
    })
  }

  async get<T = unknown>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    const db = await this.open()
    return new Promise((res, rej) => {
      const r = db.transaction(store, 'readonly').objectStore(store).get(key)
      r.onsuccess = () => res(r.result as T | undefined)
      r.onerror = () => rej(r.error)
    })
  }

  async put(store: StoreName, item: unknown): Promise<IDBValidKey> {
    const db = await this.open()
    return new Promise((res, rej) => {
      const r = db.transaction(store, 'readwrite').objectStore(store).put(item)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  }

  async putAll(store: StoreName, items: unknown[]): Promise<void> {
    if (!items || !items.length) return
    const db = await this.open()
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite')
      const st = tx.objectStore(store)
      items.forEach((i) => st.put(i))
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
    })
  }

  async del(store: StoreName, key: IDBValidKey): Promise<void> {
    const db = await this.open()
    return new Promise((res, rej) => {
      const r = db.transaction(store, 'readwrite').objectStore(store).delete(key)
      r.onsuccess = () => res()
      r.onerror = () => rej(r.error)
    })
  }

  async count(store: StoreName): Promise<number> {
    const db = await this.open()
    return new Promise((res, rej) => {
      const r = db.transaction(store, 'readonly').objectStore(store).count()
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  }

  // ── Key-Value ────────────────────────────────────────────────────────────
  async kvGet<T = unknown>(key: string): Promise<T | undefined> {
    const r = await this.get<{ k: string; v: T }>('kv', key)
    return r ? r.v : undefined
  }
  async kvSet(key: string, value: unknown): Promise<IDBValidKey> {
    return this.put('kv', { k: key, v: value })
  }

  // ── Outbox (cola de operaciones pendientes) ──────────────────────────────
  async pushOutbox(op: OutboxOp, payload: unknown): Promise<IDBValidKey> {
    const entry: OutboxEntry = { op, payload, ts: Date.now(), retries: 0 }
    return this.put('outbox', entry)
  }
  async getAllOutbox(): Promise<OutboxEntry[]> {
    return this.getAll<OutboxEntry>('outbox')
  }
  async delOutbox(id: number): Promise<void> {
    return this.del('outbox', id)
  }
  async countOutbox(): Promise<number> {
    return this.count('outbox')
  }
}

export const db = new VefDB()
