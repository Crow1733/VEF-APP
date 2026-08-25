/**
 * Modelos de dominio VEF — reflejan las tablas de backend/schema.sql.
 * Los campos booleanos llegan del backend como 0 | 1 (SQLite).
 */

export type Rol = 'admin' | 'cajero'

export interface Usuario {
  id: number
  nombre: string
  usuario: string
  rol: Rol
  activo?: number
  creado_en?: string
}

export interface Categoria {
  id: number
  nombre: string
  tipo: string
  es_consignacion: number
  activa: number
}

export interface Producto {
  id: number
  categoria_id: number
  nombre: string
  codigo: string | null
  tipo_producto: string
  consignador: string | null
  costo: number
  precio_venta: number
  ganancia: number
  unidad: string
  stock_inicial: number
  stock_actual: number
  imagen: string
  activa: number
  // Campos enriquecidos que añade el backend en GET /productos
  categoria_nombre?: string
  es_consignacion?: number
  /** Total vendido desde que existe el producto (histórico). */
  vendidos?: number
  // ── Semana en curso (desde el último cierre semanal) ──────────────────────
  /** Existencia al arrancar la semana. */
  inicial_semana?: number
  vendidos_semana?: number
  entradas_semana?: number
  bajas_semana?: number
  credito_semana?: number
  /** Foto de stock del último cierre (referencia). */
  snapshot_cierre?: number | null
  /** Fecha de cierre que delimita la semana en curso. */
  corte_semana?: string | null
}

export interface CajaCategoria {
  id: number
  nombre: string
  es_consignacion: number
}

/** Config de una de las 3 cajas fijas (GET /cajas/config). */
export interface CajaConfig {
  id: number
  nombre: string
  categorias_ids: number[]
  categorias?: CajaCategoria[]
}

export interface Caja {
  id: number
  numero: number | null
  fecha_apertura: string
  fecha_cierre: string | null
  efectivo_inicial: number
  efectivo_contado: number | null
  diferencia: number | null
  estado: 'abierta' | 'cerrada'
  observacion: string
  abierta_por_id: number | null
  abierta_por: string | null
  venta_total?: number
}

/** Estado de una de las 3 registradoras fijas (GET /cajas/estado). */
export interface CajaEstado {
  numero: number
  nombre: string
  abierta: boolean
  /** Sesión abierta ahora mismo (o null). */
  caja: Caja | null
  /** Última caja abierta HOY aunque ya esté cerrada (distingue abrir vs reabrir). */
  caja_hoy: Caja | null
}

/** Resultado del cierre automático de medianoche (POST /cajas/cerrar-vencidas). */
export interface CierreVencidasResult {
  cerradas: { id: number; numero: number | null }[]
}

export interface VentaItem {
  producto_id: number
  cantidad: number
  precio_unitario?: number
}

/** Línea de venta enriquecida que devuelve el backend al listar/obtener. */
export interface VentaDetalle {
  id: number
  venta_id: number
  producto_id: number
  cantidad: number
  costo_unitario: number
  precio_unitario: number
  subtotal: number
  ganancia_unitaria: number
  ganancia_total: number
  es_consignacion: number
  producto_nombre: string
  categoria_nombre: string
  /** >0 cuando se vendió por debajo del precio de lista (p. ej. a precio de costo). */
  perdida_ganancia?: number
  ganancia_elevacion?: number
}

export interface Venta {
  id: number | string
  caja_id: number | null
  caja_numero?: number | null
  /** Número de la venta dentro de su día (reinicia cada jornada). */
  numero_dia?: number
  fecha: string
  tipo_pago: string
  total: number
  subtotal_efectivo: number
  subtotal_transferencia: number
  es_consignacion: number
  estado: 'completada' | 'cancelada'
  cancelada_en: string | null
  observacion: string
  cajero_id?: number | null
  cajero_nombre?: string | null
  items: VentaDetalle[]
  _offline?: boolean
}

export interface VentaPayload {
  items: VentaItem[]
  subtotal_efectivo?: number
  subtotal_transferencia?: number
  observacion?: string
  caja_id?: number | null
  cajero_id?: number | null
  cajero_nombre?: string | null
}

export interface Movimiento {
  id: number | string
  caja_id: number | null
  fecha: string
  tipo_movimiento: string
  concepto: string
  monto: number
  metodo_pago: string
  es_extraccion: number
  es_compra_mercancia: number
  responsable: string | null
  _offline?: boolean
}

export interface CompraDetalle {
  id: number
  compra_id: number
  producto_id: number
  cantidad: number
  costo_unitario: number
  subtotal: number
  producto_nombre: string
}

export interface Compra {
  id: number
  fecha: string
  total: number
  metodo_pago: string
  descuenta_fondo: number
  procedencia: string | null
  observacion: string
  items: CompraDetalle[]
}

/** Payload para registrar una compra de mercancía. */
export interface CompraPayload {
  procedencia?: string
  metodo_pago?: string
  descuenta_fondo?: boolean
  observacion?: string
  items: { producto_id: number; cantidad: number; costo_unitario: number }[]
  caja_id?: number | null
  cajero_id?: number | null
  cajero_nombre?: string | null
}

export interface Consignacion {
  id: number
  consignador: string
  categoria_id: number | null
  fecha_inicio: string
  fecha_fin: string | null
  estado: 'activa' | 'cerrada'
  observacion: string
}

/** Filtros de listado de ventas. */
export interface VentasFiltro {
  caja_id?: number | null
  estado?: string
  desde?: string
  hasta?: string
}

/** Sesión persistida en localStorage (rol → home). */
export interface Session {
  id: number
  username: string
  role: Rol
  displayName: string
  home: string
  loggedAt: string
}

/** Operación encolada en el outbox para sincronizar offline. */
export type OutboxOp = 'venta' | 'extraccion' | 'pago' | 'baja' | 'credito'

export interface OutboxEntry {
  id?: number
  op: OutboxOp
  payload: unknown
  ts: number
  retries: number
  /** El servidor la rechazó (p. ej. sin stock al sincronizar): NO se descarta. */
  rechazada?: boolean
  motivo?: string
  rechazadaEn?: number
}

// ── Cuentas por pagar / deudas (Capa 5) ──────────────────────────────────────
export interface CuentaPorPagar {
  id: number
  fecha: string
  proveedor: string
  concepto: string
  monto: number
  saldo: number
  estado: 'pendiente' | 'pagada'
  observacion: string
}

export interface CuentaPayload {
  proveedor?: string
  concepto?: string
  monto: number
  fecha?: string | null
  observacion?: string
}

export interface PagoDeuda {
  id: number
  cuenta_id: number
  fecha: string
  monto: number
  metodo_pago: string
}

export interface PagoDeudaPayload {
  monto: number
  metodo_pago?: string
  fecha?: string | null
  producto?: string | null
  cantidad?: number | null
  precio_costo?: number | null
  precio_vendido?: number | null
}

// ── Bajas / mermas de inventario ─────────────────────────────────────────────
export type BajaRazon = 'merma' | 'rotura' | 'vencimiento' | 'robo' | 'otro'

export interface Baja {
  id: number | string
  fecha: string
  producto_id: number
  cantidad: number
  costo_unitario: number
  razon: BajaRazon | string
  observacion: string
  caja_id: number | null
  cajero_id: number | null
  cajero_nombre: string | null
  producto_nombre?: string
  categoria_nombre?: string
  _offline?: boolean
}

export interface BajaPayload {
  producto_id: number
  cantidad: number
  razon?: string
  observacion?: string
  fecha?: string | null
  caja_id?: number | null
  cajero_id?: number | null
  cajero_nombre?: string | null
}

// ── Créditos / ventas a libreta (cuentas por cobrar de clientes) ──────────────
export interface CreditoItem {
  producto_id: number
  cantidad: number
  precio_unitario?: number
}

export interface CreditoDetalle {
  id: number
  credito_id: number
  producto_id: number
  cantidad: number
  costo_unitario: number
  precio_unitario: number
  subtotal: number
  producto_nombre?: string
  categoria_nombre?: string
}

export interface Credito {
  id: number | string
  fecha: string
  cliente: string
  total: number
  saldo: number
  estado: 'activa' | 'pagada'
  observacion: string
  caja_id: number | null
  cajero_id: number | null
  cajero_nombre: string | null
  items: CreditoDetalle[]
  _offline?: boolean
}

export interface CreditoPayload {
  cliente: string
  items: CreditoItem[]
  observacion?: string
  fecha?: string | null
  caja_id?: number | null
  cajero_id?: number | null
  cajero_nombre?: string | null
}

export interface PagoCredito {
  id: number
  credito_id: number
  fecha: string
  monto: number
  metodo_pago: string
}

export interface PagoCreditoPayload {
  monto: number
  metodo_pago?: string
  fecha?: string | null
}

// ── Gastos (Capa 3) ──────────────────────────────────────────────────────────
export type GastoTipo =
  | 'salario'
  | 'transporte'
  | 'onat'
  | 'arrendamiento'
  | 'contador'
  | 'estimulacion'
  | 'individual'
  | 'otro'

export interface Gasto {
  id: number
  fecha: string
  tipo: GastoTipo | string
  concepto: string
  monto: number
  socio: string | null
  caja_id: number | null
  cajero_id: number | null
  cajero_nombre: string | null
}

export interface GastoPayload {
  tipo: string
  concepto?: string
  monto: number
  socio?: string | null
  fecha?: string | null
}

export type SyncStatus = 'synced' | 'online' | 'syncing' | 'offline' | 'partial'

export interface SyncState {
  status: SyncStatus
  pending: number
  synced: number
  /** Operaciones que el servidor rechazó y quedaron guardadas para revisar. */
  rechazadas?: number
}

// ── Reportes ────────────────────────────────────────────────────────────────
export interface ReporteSemanal {
  desde: string | null
  hasta: string | null
  caja_id: number | null
  venta_total: number
  efectivo_total: number
  transferencia_total: number
  consignacion_total: number
  utilidad_total: number
  extracciones_total: number
  compras_total: number
  diferencia_caja: number
}

export interface ReporteCategoria {
  categoria_id: number
  nombre: string
  es_consignacion: number
  venta_total: number
  utilidad_total: number
  unidades: number
}

export interface ReporteProducto {
  producto_id: number
  nombre: string
  categoria_nombre: string
  tipo_producto: string
  es_consignacion: number
  unidades: number
  venta_total: number
  utilidad_total: number
}

// ── Cuadre / cierre semanal (Capa 6 / CUADRE DE LA SEMANA) ───────────────────
export interface CuadreReporte {
  desde: string | null
  hasta: string | null
  venta_total: number
  efectivo: number
  transferencia: number
  venta_propia: number
  venta_consignacion: number
  perdida_ganancia: number
  venta_real: number
  venta_costo: number
  utilidad_bruta: number
  gastos: {
    salarios: number
    transporte: number
    onat: number
    arrendamiento: number
    contador: number
    estimulacion: number
    individual: number
    otros: number
    operativos: number
    total_descontado: number
  }
  utilidad_neta: number
  reserva_pct: number
  reserva: number
  dividendos: number
  socios: number
  por_socio: number
  movimientos: {
    extracciones: number
    compras_mercancia: number
    pagos_caja: number
    deudas_pagadas: number
    ingresos: number
  }
  consignadores_a_pagar: number
  faltante_sobrante: number
  efectivo_caja: number
  bajas_total?: number
  entradas_costo?: number
  /** Venta valorada a precio de lista (equivale a E18 del Excel). */
  venta_lista?: number
  /** Importe cobrado por lo vendido a precio de costo (R28 del Excel). */
  ventas_al_costo?: number
  /** Pago neto a cada socio: su parte menos lo que ya retiró (I21/J21). */
  pago_por_socio?: Record<string, number>
  individual_por_socio?: Record<string, number>
}

// ── Movimientos de caja (libro / ledger) ─────────────────────────────────────
export interface MovimientoCaja {
  id: number
  caja_id: number | null
  caja_numero: number | null
  fecha: string
  tipo_movimiento: string
  concepto: string
  monto: number
  metodo_pago: string | null
  es_extraccion: number
  es_compra_mercancia: number
  cajero_nombre: string | null
  direccion: 'entra' | 'sale'
  relacionado_tipo?: string | null
}
export interface MovimientosCajaReporte {
  movimientos: MovimientoCaja[]
  resumen: { entra: number; sale: number; neto: number; n: number }
}

// ── Movimientos de inventario (entradas / bajas) ─────────────────────────────
export interface InvMovCategoria {
  categoria: string
  uds: number
  valor: number
}
export interface InvMovDetalle {
  fecha: string
  producto: string
  categoria: string
  cantidad: number
  costo_unitario: number
  valor: number
  razon?: string
  observacion?: string
  compra_id?: number
  baja_id?: number
}
export interface InvMovLado {
  total_uds: number
  total_valor: number
  por_categoria: InvMovCategoria[]
  detalle: InvMovDetalle[]
}
export interface InventarioMovimientos {
  entradas: InvMovLado
  bajas: InvMovLado
}

// ── Ventas agrupadas por día (historial diario accesible por el admin) ────────
export interface VentaPorDia {
  dia: string
  num_ventas: number
  venta_total: number
  efectivo: number
  transferencia: number
  venta_propia: number
  venta_consignacion: number
}

// ── Cierre semanal persistido (Capa 6b) ──────────────────────────────────────
export interface Cierre {
  id: number
  fecha_inicio: string
  fecha_fin: string
  venta_total: number
  utilidad_total: number
  utilidad_neta: number
  dividendos: number
  por_socio: number
  socios: number
  reserva_pct: number
  cerrada_en: string | null
  observacion: string
}

export interface CierreDetalle extends Cierre {
  snapshot?: string
  cuadre?: CuadreReporte | null
}

export interface CierrePayload {
  desde: string
  hasta: string
  socios?: number
  reserva_pct?: number
  perdida_ganancia?: number
  observacion?: string
}

// ── Multi-semana / comparación de cierres (Capa 7 / Hoja1) ───────────────────
export interface SemanaResumen {
  id: number
  fecha_inicio: string
  fecha_fin: string
  venta_total: number
  venta_costo: number
  utilidad_bruta: number
  perdida_ganancia: number
  gastos_operativos: number
  onat_arrend: number
  contador: number
  estimulacion: number
  utilidad_neta: number
  reserva: number
  dividendos: number
  por_socio: number
  socios: number
}

export interface ResumenCierres {
  semanas: SemanaResumen[]
  total: {
    venta_total: number
    venta_costo: number
    utilidad_bruta: number
    perdida_ganancia: number
    gastos_operativos: number
    onat_arrend: number
    contador: number
    estimulacion: number
    utilidad_neta: number
    reserva: number
    dividendos: number
    por_socio: number
  }
}

// ── Liquidación de consignaciones (Capa 4 / "IMPORTE AL COSTO" de los ledgers) ──
export interface ConsignacionLiquidacion {
  consignador: string
  unidades: number
  a_pagar: number
  venta: number
  utilidad_bazar: number
}

export interface ConsignacionReporte {
  consignadores: ConsignacionLiquidacion[]
  total: { unidades: number; a_pagar: number; venta: number; utilidad_bazar: number }
}

// ── Inventario valorado (Capa 2 / "IMPORTE EN MERCANCIA" del cuadre) ──────────
export interface InventarioCategoria {
  categoria_id: number
  nombre: string
  es_consignacion: number
  productos: number
  unidades: number
  valor_costo: number
  valor_venta: number
  utilidad_potencial: number
}

export interface InventarioReporte {
  categorias: InventarioCategoria[]
  total: {
    productos: number
    unidades: number
    valor_costo: number
    valor_venta: number
    utilidad_potencial: number
  }
}

// ── Caja: desglose y cierre ──────────────────────────────────────────────────
export interface Desglose {
  caja_id: number
  efectivo_inicial: number
  ventas_efectivo: number
  ventas_transferencia: number
  ingresos: number
  extracciones: number
  compras_mercancia: number
  pagos_varios: number
  efectivo_esperado: number
}

export interface CierreResult {
  caja: Caja
  desglose: Desglose
}

/** Resultado de registrar extracción/pago (online: {ok, mov}; offline: {_offline}). */
export interface MovimientoResult {
  ok?: boolean
  mov?: Movimiento
  reason?: string
  _offline?: boolean
  id?: number | string
}
