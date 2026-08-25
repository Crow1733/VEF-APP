/**
 * VEF Sync Manager — port de front/js/sync-manager.js.
 * - Detecta online/offline
 * - Procesa la cola (outbox) cuando hay conexión
 * - Publica el estado en el store `syncState` (antes: BroadcastChannel/CustomEvent)
 */
import { db } from './db'
import { syncState } from './stores'
import type { Producto, SyncStatus } from './types'

function emit(
  status: SyncStatus,
  extra: { pending?: number; synced?: number; rechazadas?: number } = {},
) {
  syncState.set({
    status,
    pending: extra.pending ?? 0,
    synced: extra.synced ?? 0,
    rechazadas: extra.rechazadas ?? 0,
  })
}

let _syncing = false

export async function processOutbox(): Promise<void> {
  if (_syncing) return
  _syncing = true

  const todas = await db.getAllOutbox().catch(() => [])
  // Las rechazadas no se reintentan solas: esperan revisión.
  const ops = todas.filter((o) => !o.rechazada)
  const yaRechazadas = todas.length - ops.length
  if (!ops.length) {
    emit(yaRechazadas ? 'partial' : 'synced', { pending: 0, rechazadas: yaRechazadas })
    _syncing = false
    return
  }

  emit('syncing', { pending: ops.length, rechazadas: yaRechazadas })

  let synced = 0
  let rechazadasAhora = 0
  for (const op of ops) {
    try {
      let url: string
      if (op.op === 'venta') url = '/api/ventas'
      else if (op.op === 'extraccion') url = '/api/movimientos/extraccion'
      else if (op.op === 'pago') url = '/api/movimientos/pago'
      else if (op.op === 'baja') url = '/api/bajas'
      else if (op.op === 'credito') url = '/api/creditos'
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
        // El servidor la rechaza (p. ej. 422 por falta de stock). Antes se
        // borraba en silencio y la operación desaparecía sin dejar rastro: si era
        // una venta cobrada offline, se perdía. Ahora se conserva con el motivo
        // para que alguien la revise.
        const detalle = await res
          .json()
          .then((b) => (b as { detail?: string }).detail)
          .catch(() => null)
        const motivo = detalle || `El servidor la rechazó (HTTP ${res.status})`
        if (op.id != null) await db.marcarOutboxRechazada(op.id, motivo)
        rechazadasAhora++
      }
      // 5xx: dejar en cola, reintentar en el próximo ciclo
    } catch {
      // Error de red: seguimos por si las siguientes sí pasan
    }
  }

  const remaining = await db.countOutboxPendientes().catch(() => 0)
  const rechazadasTotal = await db
    .getOutboxRechazadas()
    .then((r) => r.length)
    .catch(() => 0)

  // Refresca productos desde el servidor para stock autoritativo
  if (synced > 0) {
    try {
      const prods: Producto[] = await fetch('/api/productos').then((r) => r.json())
      await db.putAll('productos', prods)
    } catch {
      /* ignorar */
    }
  }

  emit(remaining === 0 && rechazadasTotal === 0 ? 'synced' : 'partial', {
    pending: remaining,
    synced,
    rechazadas: rechazadasTotal,
  })

  if (synced > 0) {
    window.dispatchEvent(new CustomEvent('vef:sync-complete', { detail: { synced } }))
  }
  // Aviso explícito: hay operaciones que el servidor no aceptó y que alguien
  // tiene que revisar (no se pierden, quedan guardadas con su motivo).
  if (rechazadasAhora > 0) {
    window.dispatchEvent(
      new CustomEvent('vef:sync-rechazadas', {
        detail: { rechazadas: rechazadasAhora, total: rechazadasTotal },
      }),
    )
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
