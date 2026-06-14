/// <reference lib="webworker" />
/**
 * Service worker VEF (modo injectManifest de vite-plugin-pwa).
 * Port de front/sw.js:
 *  - Precache de la app (Workbox inyecta el manifest con los hashes de Vite).
 *  - Fallback de navegación al app-shell (funciona offline).
 *  - Background Sync: procesa el outbox de IndexedDB cuando vuelve la red.
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()

// Precache de todos los assets generados por Vite.
precacheAndRoute(self.__WB_MANIFEST)

// Navegaciones → app-shell precacheado (excepto la API). Permite abrir la app
// sin conexión.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//],
  }),
)

// ── Background Sync: procesa la cola (outbox) cuando el navegador recupera red ──
interface SyncEvent extends ExtendableEvent {
  readonly tag: string
}

self.addEventListener('sync', ((event: Event) => {
  const e = event as SyncEvent
  if (e.tag === 'vef-sync-ops') e.waitUntil(syncOutboxFromSW())
}) as EventListener)

interface OutboxRow {
  id: number
  op: string
  payload: unknown
}

async function syncOutboxFromSW(): Promise<void> {
  const db = await openDB()
  const ops = await getAllOutbox(db)
  if (!ops.length) return

  for (const op of ops) {
    let url: string
    if (op.op === 'venta') url = '/api/ventas'
    else if (op.op === 'extraccion') url = '/api/movimientos/extraccion'
    else if (op.op === 'pago') url = '/api/movimientos/pago'
    else if (op.op === 'baja') url = '/api/bajas'
    else if (op.op === 'credito') url = '/api/creditos'
    else {
      await delOutbox(db, op.id)
      continue
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op.payload),
      })
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        await delOutbox(db, op.id)
      }
    } catch {
      // Sigue con la siguiente; la cola persiste.
    }
  }

  // Notifica a todos los clientes abiertos.
  const clients = await self.clients.matchAll({ type: 'window' })
  clients.forEach((c) => c.postMessage({ type: 'SW_SYNC_COMPLETE' }))
}

// ── Helpers mínimos de IndexedDB para el SW ────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('vef-offline', 1)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.onupgradeneeded = () => {
      const db = r.result
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true })
      }
    }
  })
}

function getAllOutbox(db: IDBDatabase): Promise<OutboxRow[]> {
  return new Promise((resolve, reject) => {
    const r = db.transaction('outbox', 'readonly').objectStore('outbox').getAll()
    r.onsuccess = () => resolve(r.result as OutboxRow[])
    r.onerror = () => reject(r.error)
  })
}

function delOutbox(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const r = db.transaction('outbox', 'readwrite').objectStore('outbox').delete(id)
    r.onsuccess = () => resolve()
    r.onerror = () => reject(r.error)
  })
}
