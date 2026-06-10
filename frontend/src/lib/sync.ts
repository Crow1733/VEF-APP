/**
 * VEF Sync Manager — port de front/js/sync-manager.js.
 * - Detecta online/offline
 * - Procesa la cola (outbox) cuando hay conexión
 * - Publica el estado en el store `syncState` (antes: BroadcastChannel/CustomEvent)
 */
import { db } from './db'
import { syncState } from './stores'
import type { Producto, SyncStatus } from './types'

function emit(status: SyncStatus, extra: { pending?: number; synced?: number } = {}) {
  syncState.set({ status, pending: extra.pending ?? 0, synced: extra.synced ?? 0 })
}

let _syncing = false

export async function processOutbox(): Promise<void> {
  if (_syncing) return
  _syncing = true

  const ops = await db.getAllOutbox().catch(() => [])
  if (!ops.length) {
    emit('synced', { pending: 0 })
    _syncing = false
    return
  }

  emit('syncing', { pending: ops.length })

  let synced = 0
  for (const op of ops) {
    try {
      let url: string
      if (op.op === 'venta') url = '/api/ventas'
      else if (op.op === 'extraccion') url = '/api/movimientos/extraccion'
      else if (op.op === 'pago') url = '/api/movimientos/pago'
      else {
        if (op.id != null) await db.delOutbox(op.id)
        synced++
        continue
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op.payload),
      })

      if (res.ok) {
        if (op.id != null) await db.delOutbox(op.id)
        synced++
      } else if (res.status >= 400 && res.status < 500) {
        // Op inválida (400/422/etc) — descartar
        if (op.id != null) await db.delOutbox(op.id)
      }
      // 5xx: dejar en cola, reintentar en el próximo ciclo
    } catch {
      // Error de red: seguimos por si las siguientes sí pasan
    }
  }

  const remaining = await db.countOutbox().catch(() => 0)

  // Refresca productos desde el servidor para stock autoritativo
  if (synced > 0) {
    try {
      const prods: Producto[] = await fetch('/api/productos').then((r) => r.json())
      await db.putAll('productos', prods)
    } catch {
      /* ignorar */
    }
  }

  emit(remaining === 0 ? 'synced' : 'partial', { pending: remaining, synced })

  if (synced > 0) {
    window.dispatchEvent(new CustomEvent('vef:sync-complete', { detail: { synced } }))
  }

  _syncing = false
}

let _started = false

/** Arranca los listeners de sincronización. Idempotente. */
export function initSync(): void {
  if (_started) return
  _started = true

  window.addEventListener('online', async () => {
    const pending = await db.countOutbox().catch(() => 0)
    emit('online', { pending })
    setTimeout(processOutbox, 600)
  })

  window.addEventListener('offline', async () => {
    const pending = await db.countOutbox().catch(() => 0)
    emit('offline', { pending })
  })

  // Estado inicial
  ;(async () => {
    const pending = await db.countOutbox().catch(() => 0)
    if (navigator.onLine) {
      if (pending > 0) setTimeout(processOutbox, 1200)
      else emit('synced', { pending: 0 })
    } else {
      emit('offline', { pending })
    }
  })()

  // Chequeo periódico cada 30 s
  setInterval(async () => {
    if (!navigator.onLine) return
    const pending = await db.countOutbox().catch(() => 0)
    if (pending > 0) processOutbox()
  }, 30_000)

  // Background Sync (donde esté disponible)
  if ('serviceWorker' in navigator) {
    window.addEventListener('vef:queue-op', async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        if ('sync' in reg) {
          await (reg as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register(
            'vef-sync-ops',
          )
        }
      } catch {
        /* ignorar */
      }
    })

    navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
      if (e.data?.type === 'SW_SYNC_COMPLETE') {
        window.dispatchEvent(new CustomEvent('vef:sync-complete', { detail: { synced: true } }))
        processOutbox()
      }
    })
  }
}
