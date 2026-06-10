/**
 * Stores globales de Svelte. Reemplazan la comunicación por
 * CustomEvent/BroadcastChannel entre iframes del frontend antiguo:
 * ahora el sync-manager actualiza `syncState` y los componentes se suscriben.
 */
import { writable } from 'svelte/store'
import type { Caja, SyncState } from './types'

export const syncState = writable<SyncState>({
  status: navigator.onLine ? 'synced' : 'offline',
  pending: 0,
  synced: 0,
})

// ── Caja de trabajo ─────────────────────────────────────────────────────────
// La registradora (sesión abierta) en la que opera el cajero. Se persiste en
// localStorage para que POS/Operaciones/Compras y la capa api la usen.
const WORKING_KEY = 'vef.workingCaja'

function readWorkingCaja(): Caja | null {
  try {
    const raw = localStorage.getItem(WORKING_KEY)
    return raw ? (JSON.parse(raw) as Caja) : null
  } catch {
    return null
  }
}

export const workingCaja = writable<Caja | null>(readWorkingCaja())

workingCaja.subscribe((v) => {
  try {
    if (v) localStorage.setItem(WORKING_KEY, JSON.stringify(v))
    else localStorage.removeItem(WORKING_KEY)
  } catch {
    /* ignorar */
  }
})
