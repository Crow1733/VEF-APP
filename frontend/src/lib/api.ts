/**
 * VEF API — Capa de acceso a datos con soporte offline.
 * Con conexión: llama al backend FastAPI (/api). Sin conexión: sirve desde
 * IndexedDB y encola las escrituras en el outbox. Port TS de front/js/api.js.
 */
import { db } from './db'
import type {
  Caja,
  CajaConfig,
  CajaEstado,
  Categoria,
  Cierre,
  CierreDetalle,
  CierrePayload,
  CierreResult,
  CierreVencidasResult,
  ConsignacionReporte,
  CuadreReporte,
  VentaPorDia,
  Compra,
  CompraPayload,
  Consignacion,
  CuentaPayload,
  CuentaPorPagar,
  Desglose,
  PagoDeuda,
  PagoDeudaPayload,
  Gasto,
  GastoPayload,
  InventarioReporte,
  Movimiento,
  MovimientoResult,
  Producto,
  ReporteCategoria,
  ResumenCierres,
  ReporteProducto,
  ReporteSemanal,
  Usuario,
  Venta,
  VentaItem,
  VentaPayload,
  VentasFiltro,
  Baja,
  BajaPayload,
  Credito,
  CreditoPayload,
  PagoCredito,
  PagoCreditoPayload,
} from './types'

const BASE = '/api'

// ── Meta de operación: caja de trabajo + cajero actual ──────────────────────
// Lee localStorage directamente (sin acoplar a Svelte) para etiquetar cada
// operación con su caja_id y el cajero que la realizó. Así el outbox offline
// también queda etiquetado al encolarse.
function sessionMeta(): { cajero_id: number | null; cajero_nombre: string | null } {
  try {
    const s = JSON.parse(localStorage.getItem('appSession') || 'null')
    if (s) return { cajero_id: s.id ?? null, cajero_nombre: s.displayName || s.username || null }
  } catch {
    /* ignorar */
  }
  return { cajero_id: null, cajero_nombre: null }
}

function workingCajaId(): number | null {
  try {
    const w = JSON.parse(localStorage.getItem('vef.workingCaja') || 'null')
    if (w && typeof w.id === 'number') return w.id
  } catch {
    /* ignorar */
  }
  return null
}

function opMeta(): { caja_id: number | null; cajero_id: number | null; cajero_nombre: string | null } {
  return { caja_id: workingCajaId(), ...sessionMeta() }
}

// ── Red ──────────────────────────────────────────────────────────────────
async function netReq<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}
const netGet = <T>(p: string) => netReq<T>('GET', p)
const netPost = <T>(p: string, b?: unknown) => netReq<T>('POST', p, b)
const netPut = <T>(p: string, b?: unknown) => netReq<T>('PUT', p, b)
const netPatch = <T>(p: string, b?: unknown) => netReq<T>('PATCH', p, b)
const netDel = <T>(p: string) => netReq<T>('DELETE', p)

// ── ¿Error de red? (fallo de conexión al servidor) ─────────────────────────
function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || !navigator.onLine
}

// ── Encolar op pendiente ───────────────────────────────────────────────────
async function queue(
  op: 'venta' | 'extraccion' | 'pago' | 'baja' | 'credito',
  payload: unknown,
): Promise<void> {
  await db.pushOutbox(op, payload)
  window.dispatchEvent(new CustomEvent('vef:queue-op'))
}

// ── Categorías ─────────────────────────────────────────────────────────────
const categorias = {
  listar: async (): Promise<Categoria[]> => {
    try {
      const data = await netGet<Categoria[]>('/categorias')
      db.putAll('categorias', data)
      return data
    } catch (e) {
      if (isNetworkError(e)) return db.getAll<Categoria>('categorias')
      throw e
    }
  },
  crear: (p: { nombre: string; es_consignacion?: boolean }) => netPost<Categoria>('/categorias', p),
  actualizar: (id: number, p: { nombre: string; es_consignacion?: boolean }) =>
    netPut<Categoria>(`/categorias/${id}`, p),
  eliminar: (id: number) => netDel<{ ok: boolean; reason?: string }>(`/categorias/${id}`),
}

// ── Productos ──────────────────────────────────────────────────────────────
const productos = {
  listar: async (): Promise<Producto[]> => {
    try {
      const data = await netGet<Producto[]>('/productos')
      db.putAll('productos', data)
      return data
    } catch (e) {
      if (isNetworkError(e)) return db.getAll<Producto>('productos')
      throw e
    }
  },
  crear: (p: Partial<Producto>) => netPost<Producto>('/productos', p),
  actualizar: (id: number, p: Partial<Producto>) => netPut<Producto>(`/productos/${id}`, p),
  eliminar: (id: number) => netDel<{ ok: boolean }>(`/productos/${id}`),
  ajustarStock: (id: number, stock: number) =>
    netPatch<Producto>(`/productos/${id}/stock`, { stock_actual: stock }),
}

// ── Usuarios ───────────────────────────────────────────────────────────────
const usuarios = {
  listar: () => netGet<Usuario[]>('/usuarios'),
  autenticar: (usuario: string, clave: string) =>
    netPost<Usuario>('/auth/login', { usuario, clave }).catch(() => null),
  crear: (p: Partial<Usuario> & { clave?: string }) => netPost<Usuario>('/usuarios', p),
  actualizar: (id: number, p: Partial<Usuario> & { clave?: string }) =>
    netPut<Usuario>(`/usuarios/${id}`, p),
  eliminar: (id: number) => netDel<void>(`/usuarios/${id}`),
}

// ── Cajas config ───────────────────────────────────────────────────────────
const cajas_config = {
  listar: async (): Promise<CajaConfig[]> => {
    try {
      const data = await netGet<CajaConfig[]>('/cajas/config')
      db.kvSet('cajas_config', data)
      return data
    } catch (e) {
      if (isNetworkError(e)) {
        const cached = await db.kvGet<CajaConfig[]>('cajas_config')
        if (cached) return cached
      }
      throw e
    }
  },
  actualizarCategorias: (id: number, cat_ids: number[]) =>
    netPut<CajaConfig[]>(`/cajas/config/${id}`, { categorias_ids: cat_ids }),
}

// ── Cajas operativas ───────────────────────────────────────────────────────
const cajas = {
  listar: () => netGet<Caja[]>('/cajas'),
  estado: async (): Promise<CajaEstado[]> => {
    try {
      const data = await netGet<CajaEstado[]>('/cajas/estado')
      db.kvSet('cajas_estado', data)
      return data
    } catch (e) {
      if (isNetworkError(e)) {
        return (await db.kvGet<CajaEstado[]>('cajas_estado')) ?? []
      }
      throw e
    }
  },
  actual: async (): Promise<Caja | null> => {
    try {
      const data = await netGet<Caja | null>('/cajas/actual')
      if (data) db.kvSet('caja_actual', data)
      return data
    } catch (e) {
      if (isNetworkError(e)) {
        return (await db.kvGet<Caja>('caja_actual')) ?? null
      }
      throw e
    }
  },
  abrir: (numero: number, efectivo_inicial: number) => {
    const s = sessionMeta()
    return netPost<Caja>('/cajas/abrir', {
      numero,
      efectivo_inicial,
      abierta_por_id: s.cajero_id,
      abierta_por: s.cajero_nombre,
    })
  },
  reabrir: (id: number) => netPost<Caja>(`/cajas/${id}/reabrir`),
  cerrar: (id: number, efectivo_contado: number, obs?: string) =>
    netPost<CierreResult>(`/cajas/${id}/cerrar`, {
      efectivo_contado,
      observacion: obs || '',
    }).then((r) => {
      db.kvSet('caja_actual', null)
      return r
    }),
  /** Cierre automático de medianoche (según la hora local del PC). */
  cerrarVencidas: () => netPost<CierreVencidasResult>('/cajas/cerrar-vencidas'),
  desgloseEfectivo: (id: number) => netGet<Desglose>(`/cajas/${id}/desglose`),
}

// ── Ventas ─────────────────────────────────────────────────────────────────
const ventas = {
  listar: async (filtros: VentasFiltro = {}): Promise<Venta[]> => {
    const qs = new URLSearchParams()
    if (filtros.caja_id != null) qs.set('caja_id', String(filtros.caja_id))
    if (filtros.estado) qs.set('estado', filtros.estado)
    if (filtros.desde) qs.set('desde', filtros.desde)
    if (filtros.hasta) qs.set('hasta', filtros.hasta)
    const path = '/ventas' + (qs.toString() ? '?' + qs : '')
    const cacheKey = 'ventas_' + (filtros.caja_id ?? 'all')
    try {
      const data = await netGet<Venta[]>(path)
      db.kvSet(cacheKey, data)
      return data
    } catch (e) {
      if (isNetworkError(e)) {
        return (await db.kvGet<Venta[]>(cacheKey)) ?? []
      }
      throw e
    }
  },
  listarPorCaja: (caja_id: number) => ventas.listar({ caja_id }),
  obtener: (id: number) => netGet<Venta>(`/ventas/${id}`),
  registrar: async (payload: VentaPayload): Promise<Venta> => {
    const full: VentaPayload = { ...opMeta(), ...payload }
    try {
      return await netPost<Venta>('/ventas', full)
    } catch (e) {
      if (isNetworkError(e)) return _ventaOffline(full)
      throw e
    }
  },
  cancelar: (id: number) => netPost<Venta>(`/ventas/${id}/cancelar`),
  eliminar: (id: number) => netDel<{ ok: boolean }>(`/ventas/${id}`),
}

async function _ventaOffline(payload: VentaPayload): Promise<Venta> {
  // Descuenta stock local para que la caja refleje el cambio de inmediato
  if (Array.isArray(payload.items)) {
    for (const item of payload.items as VentaItem[]) {
      const p = await db.get<Producto>('productos', item.producto_id)
      if (p) {
        p.stock_actual = Math.max(0, (p.stock_actual || 0) - item.cantidad)
        await db.put('productos', p)
      }
    }
  }
  await queue('venta', payload)
  return {
    id: 'off_' + Date.now(),
    estado: 'completada',
    fecha: new Date().toISOString(),
    _offline: true,
    ...payload,
  } as unknown as Venta
}

// ── Movimientos ────────────────────────────────────────────────────────────
const movimientos = {
  listar: (caja_id?: number) => {
    const q = caja_id != null ? `?caja_id=${caja_id}` : ''
    return netGet<Movimiento[]>('/movimientos' + q)
  },
  registrarExtraccion: async (p: Record<string, unknown>): Promise<MovimientoResult> => {
    const full = { ...opMeta(), ...p }
    try {
      return await netPost<MovimientoResult>('/movimientos/extraccion', full)
    } catch (e) {
      if (isNetworkError(e)) {
        await queue('extraccion', full)
        return { id: 'off_' + Date.now(), _offline: true, ...full }
      }
      throw e
    }
  },
  registrarPago: async (p: Record<string, unknown>): Promise<MovimientoResult> => {
    const full = { ...opMeta(), ...p }
    try {
      return await netPost<MovimientoResult>('/movimientos/pago', full)
    } catch (e) {
      if (isNetworkError(e)) {
        await queue('pago', full)
        return { id: 'off_' + Date.now(), _offline: true, ...full }
      }
      throw e
    }
  },
}

// ── Compras ────────────────────────────────────────────────────────────────
const compras = {
  listar: () => netGet<Compra[]>('/compras'),
  registrar: (p: CompraPayload) => netPost<Compra>('/compras', { ...opMeta(), ...p }),
}

// ── Consignaciones ─────────────────────────────────────────────────────────
const consignaciones = {
  listar: () => netGet<Consignacion[]>('/consignaciones'),
  crear: (p: Record<string, unknown>) => netPost<Consignacion>('/consignaciones', p),
  agregarEntrega: (id: number, item: Record<string, unknown>) =>
    netPost(`/consignaciones/${id}/entrega`, item),
  cerrar: (id: number) => netPost<Consignacion>(`/consignaciones/${id}/cerrar`),
}

// ── Reportes ───────────────────────────────────────────────────────────────
function reporteQS(desde?: string | null, hasta?: string | null, caja_id?: number | null): string {
  const qs = new URLSearchParams()
  if (desde) qs.set('desde', desde)
  if (hasta) qs.set('hasta', hasta)
  if (caja_id != null) qs.set('caja_id', String(caja_id))
  return qs.toString()
}
const reportes = {
  semanal: (desde?: string | null, hasta?: string | null, caja_id?: number | null) =>
    netGet<ReporteSemanal>('/reportes/semanal?' + reporteQS(desde, hasta, caja_id)),
  porCategoria: (desde?: string | null, hasta?: string | null, caja_id?: number | null) =>
    netGet<ReporteCategoria[]>('/reportes/por-categoria?' + reporteQS(desde, hasta, caja_id)),
  utilidadPorProducto: (desde?: string | null, hasta?: string | null, caja_id?: number | null) =>
    netGet<ReporteProducto[]>('/reportes/utilidad-por-producto?' + reporteQS(desde, hasta, caja_id)),
  inventario: (caja_id?: number | null) =>
    netGet<InventarioReporte>(
      '/reportes/inventario' + (caja_id != null ? `?caja_id=${caja_id}` : ''),
    ),
  consignaciones: (desde?: string | null, hasta?: string | null, caja_id?: number | null) =>
    netGet<ConsignacionReporte>('/reportes/consignaciones?' + reporteQS(desde, hasta, caja_id)),
  cuadre: (desde?: string | null, hasta?: string | null, socios = 2, reserva_pct = 20) => {
    const qs = new URLSearchParams()
    if (desde) qs.set('desde', desde)
    if (hasta) qs.set('hasta', hasta)
    qs.set('socios', String(socios))
    qs.set('reserva_pct', String(reserva_pct))
    return netGet<CuadreReporte>('/reportes/cuadre?' + qs)
  },
  ventasPorDia: (desde?: string | null, hasta?: string | null, caja_id?: number | null) => {
    const qs = new URLSearchParams()
    if (desde) qs.set('desde', desde)
    if (hasta) qs.set('hasta', hasta)
    if (caja_id != null) qs.set('caja_id', String(caja_id))
    return netGet<VentaPorDia[]>('/reportes/ventas-por-dia?' + qs)
  },
  movimientosDiarios: (desde?: string | null, hasta?: string | null) => {
    const qs = new URLSearchParams()
    if (desde) qs.set('desde', desde)
    if (hasta) qs.set('hasta', hasta)
    return netGet<{ categorias: unknown[]; dias: string[] }>('/reportes/movimientos-diarios?' + qs)
  },
  cobroDiario: (desde?: string | null, hasta?: string | null) => {
    const qs = new URLSearchParams()
    if (desde) qs.set('desde', desde)
    if (hasta) qs.set('hasta', hasta)
    return netGet<{ dias: string[]; categorias: unknown[]; totales_por_dia: Record<string, number> }>(
      '/reportes/cobro-diario?' + qs,
    )
  },
}

// ── Gastos ───────────────────────────────────────────────────────────────────
const gastos = {
  listar: (desde?: string | null, hasta?: string | null, tipo?: string | null) => {
    const qs = new URLSearchParams()
    if (desde) qs.set('desde', desde)
    if (hasta) qs.set('hasta', hasta)
    if (tipo) qs.set('tipo', tipo)
    return netGet<Gasto[]>('/gastos' + (qs.toString() ? '?' + qs : ''))
  },
  crear: (p: GastoPayload) => netPost<Gasto>('/gastos', { ...p, ...sessionMeta() }),
  eliminar: (id: number) => netDel<{ ok: boolean }>(`/gastos/${id}`),
}

// ── Cierres semanales (snapshot del cuadre) ──────────────────────────────────
const cierres = {
  listar: () => netGet<Cierre[]>('/cierres'),
  resumen: () => netGet<ResumenCierres>('/cierres/resumen'),
  obtener: (id: number) => netGet<CierreDetalle>(`/cierres/${id}`),
  crear: (p: CierrePayload) => netPost<CierreDetalle>('/cierres', p),
  eliminar: (id: number) => netDel<{ ok: boolean }>(`/cierres/${id}`),
}

// ── Cuentas por pagar / deudas ───────────────────────────────────────────────
const deudas = {
  listar: (estado?: string | null) =>
    netGet<CuentaPorPagar[]>('/deudas' + (estado ? `?estado=${estado}` : '')),
  crear: (p: CuentaPayload) => netPost<CuentaPorPagar>('/deudas', p),
  pagar: (id: number, p: PagoDeudaPayload) => netPost<CuentaPorPagar>(`/deudas/${id}/pago`, p),
  pagos: (id: number) => netGet<PagoDeuda[]>(`/deudas/${id}/pagos`),
  eliminar: (id: number) => netDel<{ ok: boolean }>(`/deudas/${id}`),
}

// ── Bajas / mermas de inventario ─────────────────────────────────────────────
async function _bajaOffline(payload: BajaPayload): Promise<Baja> {
  const prod = await db.get<Producto>('productos', payload.producto_id)
  if (prod) {
    prod.stock_actual = Math.max(0, (prod.stock_actual || 0) - payload.cantidad)
    await db.put('productos', prod)
  }
  await queue('baja', payload)
  return {
    ...payload,
    id: 'off_' + Date.now(),
    fecha: payload.fecha || new Date().toISOString(),
    costo_unitario: 0,
    _offline: true,
  } as unknown as Baja
}

const bajas = {
  listar: async (params?: {
    desde?: string | null
    hasta?: string | null
    producto_id?: number | null
    categoria_id?: number | null
  }): Promise<Baja[]> => {
    const qs = new URLSearchParams()
    if (params?.desde) qs.set('desde', params.desde)
    if (params?.hasta) qs.set('hasta', params.hasta)
    if (params?.producto_id != null) qs.set('producto_id', String(params.producto_id))
    if (params?.categoria_id != null) qs.set('categoria_id', String(params.categoria_id))
    const q = qs.toString()
    try {
      const data = await netGet<Baja[]>('/bajas' + (q ? '?' + q : ''))
      db.kvSet('bajas_list', data)
      return data
    } catch (e) {
      if (isNetworkError(e)) return (await db.kvGet<Baja[]>('bajas_list')) ?? []
      throw e
    }
  },
  registrar: async (payload: BajaPayload): Promise<Baja> => {
    const full: BajaPayload = { ...opMeta(), ...payload }
    try {
      return await netPost<Baja>('/bajas', full)
    } catch (e) {
      if (isNetworkError(e)) return _bajaOffline(full)
      throw e
    }
  },
  eliminar: (id: number) => netDel<{ ok: boolean }>(`/bajas/${id}`),
}

// ── Créditos / ventas a libreta (cuentas por cobrar) ─────────────────────────
async function _creditoOffline(payload: CreditoPayload): Promise<Credito> {
  if (Array.isArray(payload.items)) {
    for (const item of payload.items) {
      const p = await db.get<Producto>('productos', item.producto_id)
      if (p) {
        p.stock_actual = Math.max(0, (p.stock_actual || 0) - item.cantidad)
        await db.put('productos', p)
      }
    }
  }
  await queue('credito', payload)
  const total = payload.items.reduce((s, i) => s + (i.precio_unitario ?? 0) * i.cantidad, 0)
  return {
    ...payload,
    id: 'off_' + Date.now(),
    fecha: payload.fecha || new Date().toISOString(),
    total,
    saldo: total,
    estado: 'activa',
    items: [],
    _offline: true,
  } as unknown as Credito
}

const creditos = {
  listar: async (estado?: string | null): Promise<Credito[]> => {
    try {
      const data = await netGet<Credito[]>('/creditos' + (estado ? `?estado=${estado}` : ''))
      db.kvSet('creditos_list', data)
      return data
    } catch (e) {
      if (isNetworkError(e)) return (await db.kvGet<Credito[]>('creditos_list')) ?? []
      throw e
    }
  },
  registrar: async (payload: CreditoPayload): Promise<Credito> => {
    const full: CreditoPayload = { ...opMeta(), ...payload }
    try {
      return await netPost<Credito>('/creditos', full)
    } catch (e) {
      if (isNetworkError(e)) return _creditoOffline(full)
      throw e
    }
  },
  pagar: (id: number, p: PagoCreditoPayload) => netPost<Credito>(`/creditos/${id}/pago`, p),
  pagos: (id: number) => netGet<PagoCredito[]>(`/creditos/${id}/pagos`),
  eliminar: (id: number) => netDel<{ ok: boolean }>(`/creditos/${id}`),
}

export const api = {
  categorias,
  productos,
  usuarios,
  cajas_config,
  cajas,
  ventas,
  movimientos,
  compras,
  consignaciones,
  reportes,
  gastos,
  deudas,
  cierres,
  bajas,
  creditos,
}

export type Api = typeof api
