<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { guard, logout } from '../lib/auth'
  import { api } from '../lib/api'
  import {
    formatDate,
    formatDateTime,
    formatMoney,
    ROLE_LABELS,
    TIPO_PAGO_LABELS,
    readFileAsDataUrl,
  } from '../lib/format'
  import type {
    Caja,
    CajaConfig,
    Categoria,
    Cierre,
    ConsignacionReporte,
    CuadreReporte,
    CuentaPorPagar,
    Credito,
    Gasto,
    InventarioReporte,
    Movimiento,
    Producto,
    ReporteCategoria,
    ReporteProducto,
    ReporteSemanal,
    ResumenCierres,
    Usuario,
    Venta,
    VentaPorDia,
  } from '../lib/types'

  type MainTab = 'productos' | 'categorias' | 'caja' | 'economia' | 'usuarios'
  // prettier-ignore
  type EconTab = 'ventas' | 'extracciones' | 'reportes' | 'inventario' | 'gastos' | 'consignaciones' | 'deudas' | 'creditos' | 'cuadre' | 'historial'
  type CajaSel = 'all' | number

  // ── Estado de navegación / filtros ──────────────────────────────────────
  let activeTab = $state<MainTab>('productos')
  let activeEconomia = $state<EconTab>('ventas')
  let activeFilter = $state<'today' | 'week' | 'month'>('today')
  let customRange = $state<{ from: string; to: string } | null>(null)
  let cajaFilter = $state<{
    ventas: CajaSel
    extracciones: CajaSel
    reportes: CajaSel
    inventario: CajaSel
    gastos: CajaSel
    consignaciones: CajaSel
    deudas: CajaSel
    creditos: CajaSel
    cuadre: CajaSel
    historial: CajaSel
  }>({
    ventas: 'all',
    extracciones: 'all',
    reportes: 'all',
    inventario: 'all',
    gastos: 'all',
    consignaciones: 'all',
    deudas: 'all',
    creditos: 'all',
    cuadre: 'all',
    historial: 'all',
  })
  let reportFilter = $state<'week' | 'month' | 'all'>('week')
  let reportRange = $state<{ from: string; to: string } | null>(null)

  let productFilters = $state<{
    search: string
    category: string
    tipo: string
    priceMin: number | null
    priceMax: number | null
    stockMin: number | null
    stockMax: number | null
  }>({ search: '', category: 'all', tipo: 'all', priceMin: null, priceMax: null, stockMin: null, stockMax: null })
  let productFormVisible = $state(true)

  // Fechas (inputs de rango)
  let fromDate = $state('')
  let toDate = $state('')
  let reportFrom = $state('')
  let reportTo = $state('')

  // ── Cache de datos ────────────────────────────────────────────────────────
  let categorias = $state<Categoria[]>([])
  let productos = $state<Producto[]>([])
  let ventas = $state<Venta[]>([])
  let cajasConfig = $state<CajaConfig[]>([])
  let cajasHistorial = $state<Caja[]>([])
  let movimientos = $state<Movimiento[]>([])
  let usuarios = $state<Usuario[]>([])

  // ── Formulario de producto ──────────────────────────────────────────────
  let editingProductId = $state<number | null>(null)
  let pName = $state('')
  let pCode = $state('')
  let pCategory = $state<number | ''>('')
  let pType = $state('propio')
  let pConsignador = $state('')
  let pCost = $state<number | null>(null)
  let pSale = $state<number | null>(null)
  let pUnit = $state('unidad')
  let pStock = $state<number | null>(null)
  let pEntrada = $state<number | null>(null)
  let pBaja = $state<number | null>(null)
  let pImageData = $state('')
  let fileInput = $state<HTMLInputElement | undefined>(undefined)
  const profit = $derived(formatMoney((Number(pSale) || 0) - (Number(pCost) || 0)))
  const editingStockActual = $derived(
    editingProductId ? (productos.find((p) => p.id === editingProductId)?.stock_actual ?? 0) : 0,
  )
  const editingStockInicial = $derived(
    editingProductId ? (productos.find((p) => p.id === editingProductId)?.stock_inicial ?? 0) : 0,
  )

  // ── Formulario de categoría ────────────────────────────────────────────
  let editingCategoryId = $state<number | null>(null)
  let cName = $state('')
  let cIsConsignacion = $state(false)

  // ── Formulario de usuario ──────────────────────────────────────────────
  let editingUserId = $state<number | null>(null)
  let uName = $state('')
  let uLogin = $state('')
  let uRole = $state<'admin' | 'cajero'>('admin')
  let uPass = $state('')
  let uPassConfirm = $state('')
  let uError = $state('')
  let uPassHint = $state('')

  // ── Reportes ────────────────────────────────────────────────────────────
  let reportSemanal = $state<ReporteSemanal | null>(null)
  let reportCategorias = $state<ReporteCategoria[]>([])
  let reportProductos = $state<ReporteProducto[]>([])
  let inventario = $state<InventarioReporte | null>(null)

  // ── Gastos ────────────────────────────────────────────────────────────────
  let gastos = $state<Gasto[]>([])
  let gTipo = $state('salario')
  let gConcepto = $state('')
  let gMonto = $state<number | null>(null)
  let gFecha = $state('')
  let gSocio = $state('')
  let gError = $state('')

  const GASTO_TIPOS = [
    { value: 'salario', label: 'Salario' },
    { value: 'transporte', label: 'Transporte / Corriente' },
    { value: 'onat', label: 'ONAT (impuesto)' },
    { value: 'arrendamiento', label: 'Arrendamiento' },
    { value: 'contador', label: 'Contador' },
    { value: 'estimulacion', label: 'Estimulación' },
    { value: 'individual', label: 'Individual (socio)' },
    { value: 'otro', label: 'Otro' },
  ]
  const GASTO_LABEL: Record<string, string> = Object.fromEntries(
    GASTO_TIPOS.map((t) => [t.value, t.label]),
  )
  const gastosTotal = $derived(gastos.reduce((s, g) => s + g.monto, 0))

  // ── Consignaciones (liquidación por proveedor) ──────────────────────────────
  let consigData = $state<ConsignacionReporte | null>(null)
  let consigFilter = $state<'week' | 'month' | 'all'>('week')
  let consigRange = $state<{ from: string; to: string } | null>(null)
  let consigFrom = $state('')
  let consigTo = $state('')

  // ── Cuentas por pagar / deudas ──────────────────────────────────────────────
  let deudasList = $state<CuentaPorPagar[]>([])
  let dProveedor = $state('')
  let dConcepto = $state('')
  let dMonto = $state<number | null>(null)
  let dFecha = $state('')
  // Modal de pago
  let payCuenta = $state<CuentaPorPagar | null>(null)
  let payMonto = $state<number | null>(null)
  let payMetodo = $state('efectivo')
  const totalAdeudado = $derived(deudasList.reduce((s, c) => s + c.saldo, 0))

  // ── Créditos / ventas a libreta (cuentas por cobrar) ────────────────────────
  let creditosList = $state<Credito[]>([])
  // Modal de cobro
  let payCred = $state<Credito | null>(null)
  let payCredMonto = $state<number | null>(null)
  let payCredMetodo = $state('efectivo')
  const totalPorCobrar = $derived(creditosList.reduce((s, c) => s + c.saldo, 0))

  // ── Cuadre / cierre semanal ─────────────────────────────────────────────────
  let cuadre = $state<CuadreReporte | null>(null)
  let cuadreFilter = $state<'week' | 'month' | 'all'>('week')
  let cuadreRange = $state<{ from: string; to: string } | null>(null)
  let cuadreFrom = $state('')
  let cuadreTo = $state('')
  let cuadreSocios = $state(2)
  let cuadreReserva = $state(20)
  let cierresList = $state<Cierre[]>([])
  let resumen = $state<ResumenCierres | null>(null)
  let cuadreError = $state('')

  // ── Resumen de ventas del día (mismo cálculo que el cuadre, rango = hoy) ─────
  let resumenDiario = $state<CuadreReporte | null>(null)
  let resumenDiarioInterval: ReturnType<typeof setInterval> | null = null

  // ── Modales ───────────────────────────────────────────────────────────────
  let saleModal = $state<Venta | null>(null)
  let confirmBox = $state<{
    title: string
    text: string
    okLabel: string
    danger: boolean
    onConfirm: () => void | Promise<void>
  } | null>(null)

  let ready = $state(false)

  // ── Derivados ──────────────────────────────────────────────────────────────
  const propias = $derived(categorias.filter((c) => c.activa))
  const categoriasActivas = $derived(categorias.filter((c) => c.activa))

  const filteredProducts = $derived.by(() => {
    const f = productFilters
    const q = f.search.trim().toLowerCase()
    return productos
      .filter((p) => {
        if (q) {
          const enNombre = p.nombre.toLowerCase().includes(q)
          const enCodigo = (p.codigo || '').toLowerCase().includes(q)
          if (!enNombre && !enCodigo) return false
        }
        if (f.category !== 'all' && String(p.categoria_id) !== String(f.category)) return false
        if (f.tipo !== 'all' && p.tipo_producto !== f.tipo) return false
        if (f.priceMin != null && p.precio_venta < f.priceMin) return false
        if (f.priceMax != null && p.precio_venta > f.priceMax) return false
        if (f.stockMin != null && p.stock_actual < f.stockMin) return false
        if (f.stockMax != null && p.stock_actual > f.stockMax) return false
        return true
      })
      .slice()
      .sort((a, b) => a.id - b.id)
  })

  const sortedCategorias = $derived(categorias.slice().sort((a, b) => a.id - b.id))
  const sortedUsuarios = $derived(usuarios.slice().sort((a, b) => a.id - b.id))

  function getCajaFilter(scope: EconTab): number | null {
    const v = cajaFilter[scope]
    return v === 'all' ? null : Number(v)
  }

  function getSalesDateRange(): { from: Date; to: Date } {
    if (customRange) {
      return {
        from: new Date(`${customRange.from}T00:00:00`),
        to: new Date(`${customRange.to}T23:59:59`),
      }
    }
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (activeFilter === 'today') return { from: todayStart, to: now }
    if (activeFilter === 'week') {
      const from = new Date(todayStart)
      from.setDate(from.getDate() - 6)
      return { from, to: now }
    }
    const from = new Date(todayStart)
    from.setDate(from.getDate() - 29)
    return { from, to: now }
  }

  const filteredSales = $derived.by(() => {
    const { from, to } = getSalesDateRange()
    const cajaId = getCajaFilter('ventas')
    return ventas
      .filter((v) => cajaId === null || v.caja_numero === cajaId)
      .filter((v) => {
        const d = new Date(v.fecha + 'Z')
        return d >= from && d <= to
      })
  })

  // Ventas agrupadas por día (mismo filtro de caja y rango que la lista). El
  // total incluye la consignación y se desglosa. Es el registro histórico diario.
  const ventasPorDia = $derived.by(() => {
    const map = new Map<string, VentaPorDia>()
    for (const v of filteredSales) {
      if (v.estado === 'cancelada') continue
      const dia = v.fecha.slice(0, 10)
      let e = map.get(dia)
      if (!e) {
        e = { dia, num_ventas: 0, venta_total: 0, efectivo: 0, transferencia: 0, venta_propia: 0, venta_consignacion: 0 }
        map.set(dia, e)
      }
      e.num_ventas += 1
      e.venta_total += v.total
      e.efectivo += v.subtotal_efectivo
      e.transferencia += v.subtotal_transferencia
      if (v.es_consignacion) e.venta_consignacion += v.total
      else e.venta_propia += v.total
    }
    return [...map.values()].sort((a, b) => b.dia.localeCompare(a.dia))
  })

  const filteredExtracciones = $derived.by(() => {
    const cajaId = getCajaFilter('extracciones')
    return movimientos
      .filter((m) => m.es_extraccion)
      .filter((m) => cajaId === null || m.caja_id === cajaId)
      .slice()
      .sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha))
  })

  // ── Carga de datos ──────────────────────────────────────────────────────
  async function refreshCache() {
    ;[categorias, productos, ventas, cajasConfig, movimientos, usuarios] = await Promise.all([
      api.categorias.listar(),
      api.productos.listar(),
      api.ventas.listar(),
      api.cajas_config.listar(),
      api.movimientos.listar(),
      api.usuarios.listar(),
    ])
    if (!pCategory && propias.length) pCategory = propias[0].id
  }

  function getReportRange(): { desde: string | null; hasta: string | null } {
    if (reportRange) {
      return {
        desde: `${reportRange.from}T00:00:00.000Z`,
        hasta: `${reportRange.to}T23:59:59.999Z`,
      }
    }
    if (reportFilter === 'all') return { desde: null, hasta: null }
    const now = new Date()
    const days = reportFilter === 'month' ? 30 : 7
    const from = new Date(now)
    from.setDate(from.getDate() - days)
    return { desde: from.toISOString(), hasta: now.toISOString() }
  }

  async function loadReportes() {
    const { desde, hasta } = getReportRange()
    const cajaId = getCajaFilter('reportes')
    const [semanal, porCategoria, porProducto] = await Promise.all([
      api.reportes.semanal(desde, hasta, cajaId),
      api.reportes.porCategoria(desde, hasta, cajaId),
      api.reportes.utilidadPorProducto(desde, hasta, cajaId),
    ])
    reportSemanal = semanal
    reportCategorias = porCategoria
    reportProductos = porProducto
  }

  // Carga reportes cuando se entra a esa sub-pestaña o cambian sus filtros.
  $effect(() => {
    if (!ready) return
    if (activeTab !== 'economia' || activeEconomia !== 'reportes') return
    // Tracking de dependencias:
    void reportFilter
    void reportRange
    void cajaFilter.reportes
    loadReportes()
  })

  async function loadInventario() {
    inventario = await api.reportes.inventario()
  }

  // Carga el inventario al entrar a su sub-pestaña.
  $effect(() => {
    if (!ready) return
    if (activeTab !== 'economia' || activeEconomia !== 'inventario') return
    loadInventario()
  })

  async function loadGastos() {
    gastos = await api.gastos.listar()
  }

  // Carga los gastos al entrar a su sub-pestaña.
  $effect(() => {
    if (!ready) return
    if (activeTab !== 'economia' || activeEconomia !== 'gastos') return
    loadGastos()
  })

  async function submitGasto(e: SubmitEvent) {
    e.preventDefault()
    const monto = Number(gMonto) || 0
    if (monto <= 0) {
      gError = 'El monto debe ser mayor que cero.'
      return
    }
    gError = ''
    await api.gastos.crear({
      tipo: gTipo,
      concepto: gConcepto.trim(),
      monto,
      socio: gTipo === 'individual' ? gSocio.trim() || null : null,
      fecha: gFecha || null,
    })
    gConcepto = ''
    gMonto = null
    gSocio = ''
    gFecha = ''
    await loadGastos()
  }

  function deleteGasto(g: Gasto) {
    showConfirm({
      title: `Eliminar gasto #${g.id}`,
      text: `Se eliminará "${g.concepto || GASTO_LABEL[g.tipo] || g.tipo}" (${formatMoney(g.monto)}).`,
      okLabel: 'Sí, eliminar',
      onConfirm: async () => {
        await api.gastos.eliminar(g.id)
        await loadGastos()
      },
    })
  }

  function getConsigRange(): { desde: string | null; hasta: string | null } {
    if (consigRange) {
      return {
        desde: `${consigRange.from}T00:00:00.000Z`,
        hasta: `${consigRange.to}T23:59:59.999Z`,
      }
    }
    if (consigFilter === 'all') return { desde: null, hasta: null }
    const now = new Date()
    const days = consigFilter === 'month' ? 30 : 7
    const from = new Date(now)
    from.setDate(from.getDate() - days)
    return { desde: from.toISOString(), hasta: now.toISOString() }
  }

  async function loadConsignaciones() {
    const { desde, hasta } = getConsigRange()
    consigData = await api.reportes.consignaciones(desde, hasta, getCajaFilter('consignaciones'))
  }

  function applyConsigRange() {
    if (consigFrom && consigTo) consigRange = { from: consigFrom, to: consigTo }
  }
  function setConsigQuick(f: 'week' | 'month' | 'all') {
    consigFilter = f
    consigRange = null
  }

  // Carga la liquidación de consignaciones al entrar a su sub-pestaña o cambiar filtros.
  $effect(() => {
    if (!ready) return
    if (activeTab !== 'economia' || activeEconomia !== 'consignaciones') return
    void consigFilter
    void consigRange
    void cajaFilter.consignaciones
    loadConsignaciones()
  })

  async function loadDeudas() {
    deudasList = await api.deudas.listar()
  }

  // Carga las cuentas por pagar al entrar a su sub-pestaña.
  $effect(() => {
    if (!ready) return
    if (activeTab !== 'economia' || activeEconomia !== 'deudas') return
    loadDeudas()
  })

  async function submitDeuda(e: SubmitEvent) {
    e.preventDefault()
    const monto = Number(dMonto) || 0
    if (!dProveedor.trim() || monto <= 0) return
    await api.deudas.crear({
      proveedor: dProveedor.trim(),
      concepto: dConcepto.trim(),
      monto,
      fecha: dFecha || null,
    })
    dProveedor = ''
    dConcepto = ''
    dMonto = null
    dFecha = ''
    await loadDeudas()
  }

  function openPago(c: CuentaPorPagar) {
    payCuenta = c
    payMonto = c.saldo
    payMetodo = 'efectivo'
  }
  async function confirmPago() {
    if (!payCuenta) return
    const monto = Number(payMonto) || 0
    if (monto <= 0) return
    await api.deudas.pagar(payCuenta.id, { monto, metodo_pago: payMetodo })
    payCuenta = null
    await loadDeudas()
  }

  function deleteDeuda(c: CuentaPorPagar) {
    showConfirm({
      title: `Eliminar deuda #${c.id}`,
      text: `Se eliminará la cuenta de "${c.proveedor}" (${formatMoney(c.monto)}) y sus pagos.`,
      okLabel: 'Sí, eliminar',
      onConfirm: async () => {
        await api.deudas.eliminar(c.id)
        await loadDeudas()
      },
    })
  }

  // ── Créditos / ventas a libreta ─────────────────────────────────────────────
  async function loadCreditos() {
    creditosList = await api.creditos.listar()
  }

  $effect(() => {
    if (!ready) return
    if (activeTab !== 'economia' || activeEconomia !== 'creditos') return
    loadCreditos()
  })

  function openCobro(c: Credito) {
    payCred = c
    payCredMonto = c.saldo
    payCredMetodo = 'efectivo'
  }
  async function confirmCobro() {
    if (!payCred || typeof payCred.id !== 'number') return
    const monto = Number(payCredMonto) || 0
    if (monto <= 0) return
    await api.creditos.pagar(payCred.id, { monto, metodo_pago: payCredMetodo })
    payCred = null
    await loadCreditos()
  }

  function deleteCredito(c: Credito) {
    if (typeof c.id !== 'number') return
    const id = c.id
    showConfirm({
      title: `Eliminar crédito #${id}`,
      text: `Se eliminará el crédito de "${c.cliente}" (${formatMoney(c.total)}). Si está activo, se devuelve el stock.`,
      okLabel: 'Sí, eliminar',
      onConfirm: async () => {
        await api.creditos.eliminar(id)
        await loadCreditos()
      },
    })
  }

  function getCuadreRange(): { desde: string | null; hasta: string | null } {
    if (cuadreRange) {
      return {
        desde: `${cuadreRange.from}T00:00:00.000Z`,
        hasta: `${cuadreRange.to}T23:59:59.999Z`,
      }
    }
    if (cuadreFilter === 'all') return { desde: null, hasta: null }
    const now = new Date()
    const days = cuadreFilter === 'month' ? 30 : 7
    const from = new Date(now)
    from.setDate(from.getDate() - days)
    return { desde: from.toISOString(), hasta: now.toISOString() }
  }

  async function loadCuadre() {
    const { desde, hasta } = getCuadreRange()
    cuadre = await api.reportes.cuadre(desde, hasta, cuadreSocios, cuadreReserva)
  }

  async function loadCierres() {
    cierresList = await api.cierres.listar()
  }

  function cerrarSemana() {
    const { desde, hasta } = getCuadreRange()
    if (!desde || !hasta) {
      cuadreError = 'Elige un período con fechas (no "Todo") para cerrar la semana.'
      return
    }
    cuadreError = ''
    showConfirm({
      title: 'Cerrar semana',
      text: `Se guardará un cierre del período seleccionado. Utilidad neta: ${formatMoney(cuadre?.utilidad_neta ?? 0)}.`,
      okLabel: 'Sí, cerrar semana',
      danger: false,
      onConfirm: async () => {
        await api.cierres.crear({
          desde,
          hasta,
          socios: cuadreSocios,
          reserva_pct: cuadreReserva,
        })
        await loadCierres()
      },
    })
  }

  async function loadResumen() {
    resumen = await api.cierres.resumen()
  }

  // Carga la comparación multi-semana al entrar a su sub-pestaña.
  $effect(() => {
    if (!ready) return
    if (activeTab !== 'economia' || activeEconomia !== 'historial') return
    loadResumen()
  })

  function deleteCierre(c: Cierre) {
    showConfirm({
      title: `Eliminar cierre #${c.id}`,
      text: `Se eliminará el cierre del ${formatDate(c.fecha_inicio)} al ${formatDate(c.fecha_fin)}.`,
      okLabel: 'Sí, eliminar',
      onConfirm: async () => {
        await api.cierres.eliminar(c.id)
        await loadCierres()
      },
    })
  }

  function applyCuadreRange() {
    if (cuadreFrom && cuadreTo) { cuadreRange = { from: cuadreFrom, to: cuadreTo }; cuadreError = '' }
  }
  function setCuadreQuick(f: 'week' | 'month' | 'all') {
    cuadreFilter = f
    cuadreRange = null
    cuadreError = ''
  }

  // Carga el cuadre al entrar a su sub-pestaña o cambiar filtros/parámetros.
  $effect(() => {
    if (!ready) return
    if (activeTab !== 'economia' || activeEconomia !== 'cuadre') return
    void cuadreFilter
    void cuadreRange
    void cuadreSocios
    void cuadreReserva
    loadCuadre()
    loadCierres()
  })

  // Bloquea el scroll del body cuando hay un modal abierto.
  $effect(() => {
    const open = !!(saleModal || confirmBox || payCuenta)
    document.body.classList.toggle('modal-open', open)
  })

  // ── PRODUCTOS ─────────────────────────────────────────────────────────────
  function resetProductForm() {
    editingProductId = null
    pName = ''
    pCode = ''
    pCategory = propias.length ? propias[0].id : ''
    pType = 'propio'
    pConsignador = ''
    pCost = null
    pSale = null
    pUnit = 'unidad'
    pStock = null
    pEntrada = null
    pBaja = null
    pImageData = ''
    if (fileInput) fileInput.value = ''
  }

  async function onProductFile() {
    const f = fileInput?.files?.[0]
    if (f) pImageData = await readFileAsDataUrl(f)
    else pImageData = editingProductId ? getEditingImage() : ''
  }

  function getEditingImage(): string {
    if (!editingProductId) return ''
    const p = productos.find((x) => x.id === editingProductId)
    return p ? p.imagen || '' : ''
  }

  async function submitProduct(e: SubmitEvent) {
    e.preventDefault()
    const nombre = pName.trim()
    const categoria_id = Number(pCategory)
    if (!nombre || !categoria_id) return
    const payload: Partial<Producto> = {
      nombre,
      codigo: pCode.trim(),
      categoria_id,
      tipo_producto: pType,
      consignador: pConsignador.trim() || null,
      costo: Number(pCost) || 0,
      precio_venta: Number(pSale) || 0,
      unidad: pUnit.trim() || 'unidad',
      imagen: pImageData,
    }
    if (editingProductId) {
      const id = editingProductId
      // 1. Datos descriptivos (el backend NO toca el stock al editar).
      await api.productos.actualizar(id, payload)
      // 2. Entrada: suma al stock actual y queda registrada (no descuenta caja).
      const entrada = Number(pEntrada) || 0
      if (entrada > 0) {
        await api.compras.registrar({
          items: [{ producto_id: id, cantidad: entrada, costo_unitario: Number(pCost) || 0 }],
          descuenta_fondo: false,
          observacion: 'Entrada desde edición de producto',
        })
      }
      // 3. Baja: descuenta del stock actual y queda registrada. Las ventas ya
      //    realizadas no se tocan (viven en venta_detalle).
      const baja = Number(pBaja) || 0
      if (baja > 0) {
        await api.bajas.registrar({
          producto_id: id,
          cantidad: baja,
          razon: 'otro',
          observacion: 'Baja desde edición de producto',
        })
      }
    } else {
      await api.productos.crear({ ...payload, stock_inicial: Number(pStock) || 0 })
    }
    await refreshCache()
    resetProductForm()
  }

  function editProduct(id: number) {
    const p = productos.find((x) => x.id === id)
    if (!p) return
    editingProductId = id
    pName = p.nombre
    pCode = p.codigo || ''
    pCategory = p.categoria_id
    pType = p.tipo_producto
    pConsignador = p.consignador || ''
    pCost = p.costo
    pSale = p.precio_venta
    pUnit = p.unidad || 'unidad'
    pStock = p.stock_actual
    pEntrada = null
    pBaja = null
    pImageData = p.imagen || ''
    if (fileInput) fileInput.value = ''
    productFormVisible = true
    document.getElementById('product-form-card')?.scrollIntoView({ behavior: 'smooth' })
  }

  function deleteProduct(id: number) {
    const p = productos.find((x) => x.id === id)
    if (!p) return
    showConfirm({
      title: `Eliminar ${p.nombre}`,
      text: `Esta acción eliminará el producto #${id} de forma permanente.`,
      okLabel: 'Sí, eliminar',
      onConfirm: async () => {
        await api.productos.eliminar(id)
        await refreshCache()
        if (editingProductId === id) resetProductForm()
      },
    })
  }

  function resetProductFilters() {
    productFilters = {
      search: '',
      category: 'all',
      tipo: 'all',
      priceMin: null,
      priceMax: null,
      stockMin: null,
      stockMax: null,
    }
  }

  // ── CATEGORÍAS ──────────────────────────────────────────────────────────
  function resetCategoryForm() {
    editingCategoryId = null
    cName = ''
    cIsConsignacion = false
  }

  async function submitCategory(e: SubmitEvent) {
    e.preventDefault()
    const nombre = cName.trim()
    if (!nombre) return
    const payload = { nombre, es_consignacion: cIsConsignacion }
    if (editingCategoryId) await api.categorias.actualizar(editingCategoryId, payload)
    else await api.categorias.crear(payload)
    await refreshCache()
    resetCategoryForm()
  }

  function editCategory(id: number) {
    const c = categorias.find((x) => x.id === id)
    if (!c) return
    editingCategoryId = id
    cName = c.nombre
    cIsConsignacion = !!c.es_consignacion
  }

  function deleteCategory(id: number) {
    const c = categorias.find((x) => x.id === id)
    if (!c) return
    showConfirm({
      title: `Eliminar ${c.nombre}`,
      text: `¿Confirmas borrar la categoría #${id}? No podrá eliminarse si tiene productos asociados.`,
      okLabel: 'Sí, eliminar',
      onConfirm: async () => {
        const res = await api.categorias.eliminar(id)
        if (!res.ok) {
          alert('No se puede eliminar: hay productos en esta categoría.')
          return
        }
        await refreshCache()
      },
    })
  }

  // ── CAJA CONFIG ───────────────────────────────────────────────────────────
  async function saveCajaCats(caja: CajaConfig, ids: number[]) {
    caja.categorias_ids = ids
    cajasConfig = [...cajasConfig]
    await api.cajas_config.actualizarCategorias(caja.id, ids)
  }

  function toggleCajaCat(caja: CajaConfig, catId: number, checked: boolean) {
    const set = new Set(caja.categorias_ids)
    if (checked) set.add(catId)
    else set.delete(catId)
    saveCajaCats(caja, [...set])
  }

  function toggleAllCaja(caja: CajaConfig, marcar: boolean) {
    showConfirm({
      title: marcar ? 'Marcar todas las categorías' : 'Quitar todas las categorías',
      text: marcar
        ? `Se asignarán todas las categorías del sistema a ${caja.nombre}. ¿Confirmar?`
        : `Se eliminarán todas las categorías asignadas a ${caja.nombre}. ¿Confirmar?`,
      okLabel: marcar ? 'Sí, marcar todas' : 'Sí, quitar todas',
      danger: true,
      onConfirm: () => saveCajaCats(caja, marcar ? categoriasActivas.map((c) => c.id) : []),
    })
  }

  // ── HISTÓRICO DE CAJAS (solo visible para el administrador) ────────────────
  async function loadCajasHistorial() {
    // Aplica el cierre automático de medianoche antes de listar, para que el
    // histórico no muestre cajas viejas todavía "abiertas".
    try {
      await api.cajas.cerrarVencidas()
    } catch {
      /* ignorar: el listado igualmente las cierra en el backend */
    }
    cajasHistorial = await api.cajas.listar()
  }

  $effect(() => {
    if (activeTab !== 'caja') return
    void loadCajasHistorial()
  })

  const cajasHistorialOrdenado = $derived(cajasHistorial.slice().sort((a, b) => b.id - a.id))

  // ── USUARIOS ────────────────────────────────────────────────────────────
  function resetUserForm() {
    editingUserId = null
    uName = ''
    uLogin = ''
    uRole = 'admin'
    uPass = ''
    uPassConfirm = ''
    uError = ''
    uPassHint = ''
  }

  async function submitUser(e: SubmitEvent) {
    e.preventDefault()
    uError = ''
    const nombre = uName.trim()
    const usuario = uLogin.trim()
    if (!nombre || !usuario) {
      uError = 'Nombre y usuario son obligatorios.'
      return
    }
    const editing = Boolean(editingUserId)
    if (!editing && !uPass) {
      uError = 'La contraseña es obligatoria al crear usuario.'
      return
    }
    if (uPass && uPass.length < 4) {
      uError = 'La contraseña debe tener al menos 4 caracteres.'
      return
    }
    if (uPass && uPass !== uPassConfirm) {
      uError = 'Las contraseñas no coinciden.'
      return
    }
    if (editing && editingUserId) {
      await api.usuarios.actualizar(editingUserId, {
        nombre,
        usuario,
        rol: uRole,
        ...(uPass ? { clave: uPass } : {}),
      })
    } else {
      await api.usuarios.crear({ nombre, usuario, rol: uRole, clave: uPass })
    }
    await refreshCache()
    resetUserForm()
  }

  function editUser(id: number) {
    const u = usuarios.find((x) => x.id === id)
    if (!u) return
    editingUserId = id
    uName = u.nombre
    uLogin = u.usuario
    uRole = u.rol
    uPass = ''
    uPassConfirm = ''
    uPassHint = '(dejar vacío para mantener la actual)'
  }

  function deleteUser(id: number) {
    const u = usuarios.find((x) => x.id === id)
    if (!u || u.rol === 'admin') return
    showConfirm({
      title: `Eliminar ${u.nombre}`,
      text: `Se eliminará el usuario "${u.usuario}".`,
      okLabel: 'Sí, eliminar',
      onConfirm: async () => {
        await api.usuarios.eliminar(id)
        await refreshCache()
      },
    })
  }

  // ── VENTAS ──────────────────────────────────────────────────────────────
  function applyCustomRange() {
    if (!fromDate || !toDate) return
    customRange = { from: fromDate, to: toDate }
    // El resaltado de los botones rápidos se apaga vía `!customRange`.
  }

  // Rango del día de HOY (hora local) expresado en UTC "YYYY-MM-DD HH:MM:SS",
  // que es el formato en que se guardan las fechas de las ventas.
  function rangoHoyUTC(): { desde: string; hasta: string } {
    const now = new Date()
    const ini = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const fin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')
    return { desde: fmt(ini), hasta: fmt(fin) }
  }

  async function loadResumenDiario() {
    const { desde, hasta } = rangoHoyUTC()
    try {
      resumenDiario = await api.reportes.cuadre(desde, hasta, cuadreSocios, cuadreReserva)
    } catch {
      // Silencioso: es un panel informativo que se reintenta solo.
    }
  }

  function deleteSale(v: Venta) {
    showConfirm({
      title: `Eliminar venta #${v.id}`,
      text:
        `Se eliminará la venta #${v.id} (${formatMoney(v.total)}) de forma permanente y ` +
        `se devolverá el stock de sus productos al inventario. Esta acción no se puede deshacer.`,
      okLabel: 'Sí, eliminar',
      danger: true,
      onConfirm: async () => {
        await api.ventas.eliminar(Number(v.id))
        saleModal = null
        await refreshCache()
        await loadResumenDiario()
      },
    })
  }
  function setQuickFilter(f: 'today' | 'week' | 'month') {
    activeFilter = f
    customRange = null
  }
  function applyReportRange() {
    if (!reportFrom || !reportTo) return
    reportRange = { from: reportFrom, to: reportTo }
  }
  function setReportQuick(f: 'week' | 'month' | 'all') {
    reportFilter = f
    reportRange = null
  }

  // ── Modales ───────────────────────────────────────────────────────────────
  function showConfirm(cfg: {
    title: string
    text: string
    okLabel?: string
    danger?: boolean
    onConfirm: () => void | Promise<void>
  }) {
    confirmBox = {
      title: cfg.title,
      text: cfg.text,
      okLabel: cfg.okLabel ?? 'Confirmar',
      danger: cfg.danger ?? true,
      onConfirm: cfg.onConfirm,
    }
  }
  async function doConfirm() {
    const fn = confirmBox?.onConfirm
    confirmBox = null
    if (fn) await fn()
  }

  onMount(async () => {
    if (!guard(['admin'])) return
    productFormVisible = !window.matchMedia('(max-width: 760px)').matches
    await refreshCache()
    ready = true
    // Resumen del día en tiempo real: carga inicial + refresco cada 30 s.
    // Al cambiar el día, el rango es "hoy" y el resumen arranca de nuevo en 0.
    await loadResumenDiario()
    resumenDiarioInterval = setInterval(loadResumenDiario, 30000)
  })

  onDestroy(() => {
    if (resumenDiarioInterval) clearInterval(resumenDiarioInterval)
  })
</script>

{#if ready}
  <div class="admin">
    <header class="top-header">
      <h1>Panel del Administrador</h1>
      <div class="header-actions">
        <button class="btn danger" type="button" onclick={logout}>Cerrar sesión</button>
      </div>
    </header>

    <nav class="main-tabs">
      {#each [['productos', 'Productos'], ['categorias', 'Categorías'], ['caja', 'Caja'], ['economia', 'Economía'], ['usuarios', 'Usuarios']] as [tab, label] (tab)}
        <button
          class="tab-button"
          class:active={activeTab === tab}
          type="button"
          onclick={() => (activeTab = tab as MainTab)}>{label}</button
        >
      {/each}
    </nav>

    <main class="main-content">
      <!-- PRODUCTOS -->
      {#if activeTab === 'productos'}
        <section class="tab-panel active">
          <div class="panel-grid two-columns" class:single-column={!productFormVisible}>
            <article class="panel-card" id="product-form-card" class:hidden={!productFormVisible}>
              <div class="card-head-row">
                <h2>{editingProductId ? `Editar producto #${editingProductId}` : 'Crear producto'}</h2>
              </div>
              <form class="form-grid" onsubmit={submitProduct}>
                <label>Nombre<input type="text" bind:value={pName} required /></label>
                <label>Código (opcional)<input type="text" bind:value={pCode} placeholder="Ej: AS-001" /></label>
                <label>
                  Categoría
                  <select bind:value={pCategory} required>
                    {#each propias as c (c.id)}
                      <option value={c.id}>{c.nombre}{c.es_consignacion ? ' (consignación)' : ''}</option>
                    {/each}
                  </select>
                </label>
                <label>
                  Tipo de producto
                  <select bind:value={pType}>
                    <option value="propio">Propio</option>
                    <option value="consignacion">Consignación</option>
                  </select>
                </label>
                {#if pType === 'consignacion'}
                  <label>Consignador<input type="text" bind:value={pConsignador} placeholder="Ej: Jesús" /></label>
                {/if}
                <label>Costo<input type="number" min="0" step="0.01" bind:value={pCost} required /></label>
                <label>Precio de venta<input type="number" min="0" step="0.01" bind:value={pSale} required /></label>
                <label>Ganancia calculada<input type="text" value={profit} readonly /></label>
                <label>Unidad<input type="text" bind:value={pUnit} /></label>
                {#if editingProductId}
                  <label>Stock inicial (fijo)<input type="number" value={editingStockInicial} readonly /></label>
                  <label>Total actual<input type="number" value={editingStockActual} readonly /></label>
                  <label>Entrada (sumar al total)<input type="number" min="0" step="1" placeholder="0" bind:value={pEntrada} /></label>
                  <label>Baja (restar del total)<input type="number" min="0" step="1" placeholder="0" bind:value={pBaja} /></label>
                {:else}
                  <label>Stock inicial<input type="number" min="0" step="1" bind:value={pStock} required /></label>
                {/if}
                <label>
                  Foto (opcional)
                  <input type="file" accept="image/*" bind:this={fileInput} onchange={onProductFile} />
                  <span class="muted">Sube una imagen para mostrar el producto en caja.</span>
                </label>
                <div class="image-preview" class:show={!!pImageData}>
                  <img src={pImageData} alt="Vista previa" loading="lazy" />
                </div>
                <div class="actions-row">
                  <button type="submit" class="btn primary">Guardar producto</button>
                  <button type="button" class="btn" onclick={resetProductForm}>Cancelar edición</button>
                </div>
              </form>
            </article>

            <article class="panel-card">
              <div class="card-head-row">
                <h2>Lista de productos</h2>
                <button
                  type="button"
                  class="btn product-form-toggle"
                  onclick={() => (productFormVisible = !productFormVisible)}
                  >{productFormVisible ? 'Ocultar formulario' : 'Crear producto'}</button
                >
              </div>
              <div class="filters-grid product-filters">
                <label class="search-filter">
                  Buscar por nombre o código
                  <input
                    type="search"
                    placeholder="Escribe para buscar…"
                    bind:value={productFilters.search}
                  />
                </label>
                <label>
                  Categoría
                  <select bind:value={productFilters.category}>
                    <option value="all">Todas</option>
                    {#each propias as c (c.id)}
                      <option value={String(c.id)}>{c.nombre}</option>
                    {/each}
                  </select>
                </label>
                <label>
                  Tipo
                  <select bind:value={productFilters.tipo}>
                    <option value="all">Todos</option>
                    <option value="propio">Propio</option>
                    <option value="consignacion">Consignación</option>
                  </select>
                </label>
                <label>Precio min<input type="number" min="0" step="0.01" placeholder="0" bind:value={productFilters.priceMin} /></label>
                <label>Precio max<input type="number" min="0" step="0.01" placeholder="0" bind:value={productFilters.priceMax} /></label>
                <label>Stock min<input type="number" min="0" step="1" placeholder="0" bind:value={productFilters.stockMin} /></label>
                <label>Stock max<input type="number" min="0" step="1" placeholder="0" bind:value={productFilters.stockMax} /></label>
                <div class="filter-actions">
                  <button type="button" class="btn" onclick={resetProductFilters}>Limpiar filtros</button>
                </div>
              </div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th><th>Foto</th><th>Código</th><th>Nombre</th><th>Categoría</th>
                      <th>Tipo</th><th>Costo</th><th>Venta</th><th>Ganancia</th><th>Inicial</th><th>Total</th>
                      <th>Vendidos</th><th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#if !filteredProducts.length}
                      <tr class="table-empty-row"
                        ><td colspan="13"><div class="empty-state">No hay productos para el filtro seleccionado.</div></td></tr
                      >
                    {:else}
                      {#each filteredProducts as p (p.id)}
                        <tr>
                          <td data-label="ID">#{p.id}</td>
                          <td data-label="Foto">
                            {#if p.imagen}
                              <img class="product-thumb" src={p.imagen} alt={p.nombre} loading="lazy" />
                            {:else}<span class="muted">—</span>{/if}
                          </td>
                          <td data-label="Código">{p.codigo || '-'}</td>
                          <td data-label="Nombre">{p.nombre}</td>
                          <td data-label="Categoría">{p.categoria_nombre}</td>
                          <td data-label="Tipo">
                            {#if p.tipo_producto === 'consignacion'}
                              <span class="badge visible">Consignación{p.consignador ? ' · ' + p.consignador : ''}</span>
                            {:else}<span class="badge visible">Propio</span>{/if}
                          </td>
                          <td data-label="Costo">{formatMoney(p.costo)}</td>
                          <td data-label="Venta">{formatMoney(p.precio_venta)}</td>
                          <td data-label="Ganancia">{formatMoney(p.ganancia)}</td>
                          <td data-label="Inicial">{p.stock_inicial}</td>
                          <td data-label="Total">{p.stock_actual}</td>
                          <td data-label="Vendidos">{p.vendidos}</td>
                          <td data-label="Acciones">
                            <div class="row-actions">
                              <button class="btn" onclick={() => editProduct(p.id)}>Editar</button>
                              <button class="btn danger" onclick={() => deleteProduct(p.id)}>Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      {/each}
                    {/if}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </section>
      {/if}

      <!-- CATEGORÍAS -->
      {#if activeTab === 'categorias'}
        <section class="tab-panel active">
          <div class="panel-grid">
            <article class="panel-card">
              <h2>{editingCategoryId ? `Editar categoría #${editingCategoryId}` : 'Crear categoría'}</h2>
              <form class="form-grid cat-form-grid" onsubmit={submitCategory}>
                <label>Nombre<input type="text" bind:value={cName} required /></label>
                <label class="inline-row">
                  <input type="checkbox" bind:checked={cIsConsignacion} />
                  Es categoría de consignación (mercancía externa)
                </label>
                <p class="muted">Las categorías de consignación se excluyen del total semanal propio.</p>
                <div class="actions-row">
                  <button type="submit" class="btn primary">Guardar categoría</button>
                  <button type="button" class="btn" onclick={resetCategoryForm}>Cancelar edición</button>
                </div>
              </form>
            </article>

            <article class="panel-card">
              <h2>Lista de categorías</h2>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>ID</th><th>Nombre</th><th>Tipo</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {#if !sortedCategorias.length}
                      <tr class="table-empty-row"><td colspan="4"><div class="empty-state">No hay categorías.</div></td></tr>
                    {:else}
                      {#each sortedCategorias as c (c.id)}
                        <tr>
                          <td data-label="ID">#{c.id}</td>
                          <td data-label="Nombre">{c.nombre}</td>
                          <td data-label="Tipo">
                            {#if c.es_consignacion}<span class="badge visible">Consignación</span>
                            {:else}<span class="badge visible">Propia</span>{/if}
                          </td>
                          <td data-label="Acciones">
                            <div class="row-actions">
                              <button class="btn" onclick={() => editCategory(c.id)}>Editar</button>
                              <button class="btn danger" onclick={() => deleteCategory(c.id)}>Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      {/each}
                    {/if}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </section>
      {/if}

      <!-- CAJA -->
      {#if activeTab === 'caja'}
        <section class="tab-panel active">
          <article class="panel-card">
            <h2>Cajas</h2>
            <p class="muted">
              Hay 3 cajas fijas. Por cada una, marca las categorías de productos que esa caja podrá ver y vender.
            </p>
            <div class="cajas-config-grid">
              {#if !cajasConfig.length}
                <div class="empty-state">No se pudieron cargar las cajas.</div>
              {:else}
                {#each cajasConfig as caja (caja.id)}
                  <div class="caja-config-card">
                    <h3>{caja.nombre}</h3>
                    <div class="summary">{caja.categorias_ids.length} categoría(s) asignada(s)</div>
                    <div class="categoria-checks">
                      {#each categoriasActivas as cat (cat.id)}
                        <label class={cat.es_consignacion ? 'cat-consignacion' : ''}>
                          <input
                            type="checkbox"
                            checked={caja.categorias_ids.includes(cat.id)}
                            onchange={(e) => toggleCajaCat(caja, cat.id, e.currentTarget.checked)}
                          />
                          {cat.nombre}{cat.es_consignacion ? ' (consignación)' : ''}
                        </label>
                      {/each}
                    </div>
                    <div class="actions-row">
                      <button type="button" class="btn" onclick={() => toggleAllCaja(caja, true)}>Marcar todas</button>
                      <button type="button" class="btn" onclick={() => toggleAllCaja(caja, false)}>Quitar todas</button>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </article>

          <article class="panel-card">
            <h2>Histórico de cajas</h2>
            <p class="muted">
              Todas las aperturas y cierres de las 3 cajas. Las cajas se cierran solas a medianoche
              (hora del PC); esas aparecen como «Cierre automático de medianoche».
            </p>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Caja</th>
                    <th>Estado</th>
                    <th>Apertura</th>
                    <th>Cierre</th>
                    <th>Inicial</th>
                    <th>Contado</th>
                    <th>Diferencia</th>
                    <th>Por</th>
                    <th>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {#if !cajasHistorialOrdenado.length}
                    <tr class="table-empty-row"
                      ><td colspan="9"><div class="empty-state">No hay cajas registradas.</div></td></tr
                    >
                  {:else}
                    {#each cajasHistorialOrdenado as c (c.id)}
                      <tr>
                        <td>Caja {c.numero ?? '—'} · #{c.id}</td>
                        <td>{c.estado === 'abierta' ? 'Abierta' : 'Cerrada'}</td>
                        <td>{formatDateTime(c.fecha_apertura)}</td>
                        <td>{formatDateTime(c.fecha_cierre)}</td>
                        <td>{formatMoney(c.efectivo_inicial)}</td>
                        <td>{c.efectivo_contado != null ? formatMoney(c.efectivo_contado) : '-'}</td>
                        <td>{c.diferencia != null ? formatMoney(c.diferencia) : '-'}</td>
                        <td>{c.abierta_por || '—'}</td>
                        <td>{c.observacion || ''}</td>
                      </tr>
                    {/each}
                  {/if}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      {/if}

      <!-- ECONOMÍA -->
      {#if activeTab === 'economia'}
        <section class="tab-panel active">
          <nav class="sub-tabs">
            {#each [['ventas', 'Ventas'], ['extracciones', 'Extracciones'], ['reportes', 'Reportes'], ['inventario', 'Inventario'], ['gastos', 'Gastos'], ['consignaciones', 'Consignaciones'], ['deudas', 'Cuentas x pagar'], ['creditos', 'Cuentas x cobrar'], ['cuadre', 'Cuadre'], ['historial', 'Multi-semana']] as [t, label] (t)}
              <button
                class="sub-tab-button"
                class:active={activeEconomia === t}
                type="button"
                onclick={() => (activeEconomia = t as EconTab)}>{label}</button
              >
            {/each}
          </nav>

          {#if activeEconomia === 'ventas'}
            <div class="econ-panel active">
              <article class="panel-card">
                <h2>Historial de ventas</h2>
                <p class="muted">
                  Cada venta incluye desglose entre efectivo y transferencia. Las marcadas
                  <em>Consignación</em> no suman al total propio.
                </p>

                {#if resumenDiario}
                  <div class="daily-summary">
                    <div class="daily-summary-head">
                      <strong>Resumen de hoy</strong>
                      <span class="muted">En tiempo real · reinicia cada día</span>
                    </div>
                    <div class="daily-summary-grid">
                      <div class="ds-item">
                        <div class="ds-label">Venta total (incluye consignación)</div>
                        <div class="ds-value">{formatMoney(resumenDiario.venta_total)}</div>
                      </div>
                      <div class="ds-item">
                        <div class="ds-label">· Propia</div>
                        <div class="ds-value">{formatMoney(resumenDiario.venta_propia)}</div>
                      </div>
                      <div class="ds-item">
                        <div class="ds-label">· Consignación</div>
                        <div class="ds-value">{formatMoney(resumenDiario.venta_consignacion)}</div>
                      </div>
                      <div class="ds-item">
                        <div class="ds-label">Efectivo</div>
                        <div class="ds-value">{formatMoney(resumenDiario.efectivo)}</div>
                      </div>
                      <div class="ds-item">
                        <div class="ds-label">Transferencia</div>
                        <div class="ds-value">{formatMoney(resumenDiario.transferencia)}</div>
                      </div>
                      <div class="ds-item">
                        <div class="ds-label">Utilidad bruta</div>
                        <div class="ds-value">{formatMoney(resumenDiario.utilidad_bruta)}</div>
                      </div>
                    </div>
                  </div>
                {/if}
                <fieldset class="cajas-filter">
                  <legend>Cajas</legend>
                  {#each ['all', 1, 2, 3] as c (c)}
                    <button
                      class="btn filter"
                      class:active={String(cajaFilter.ventas) === String(c)}
                      type="button"
                      onclick={() => (cajaFilter.ventas = c as CajaSel)}
                      >{c === 'all' ? 'Todas' : `Caja ${c}`}</button
                    >
                  {/each}
                </fieldset>
                <div class="filters-grid">
                  <div class="quick-filters">
                    {#each [['today', 'Hoy'], ['week', 'Última semana'], ['month', 'Último mes']] as [f, label] (f)}
                      <button
                        class="btn filter"
                        class:active={activeFilter === f && !customRange}
                        type="button"
                        onclick={() => setQuickFilter(f as 'today' | 'week' | 'month')}>{label}</button
                      >
                    {/each}
                  </div>
                  <div class="date-range">
                    <label>Desde<input type="date" bind:value={fromDate} /></label>
                    <label>Hasta<input type="date" bind:value={toDate} /></label>
                    <button class="btn" type="button" onclick={applyCustomRange}>Aplicar rango</button>
                  </div>
                </div>

                <h3 class="daily-history-title">Historial por día</h3>
                <p class="muted" style="margin:0 0 8px;">
                  Ventas guardadas por día (respeta el filtro de caja y el rango elegido). El total
                  incluye la consignación y se desglosa.
                </p>
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Día</th><th># Ventas</th><th>Total</th><th>Efectivo</th>
                        <th>Transferencia</th><th>Propia</th><th>Consignación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#if !ventasPorDia.length}
                        <tr class="table-empty-row"><td colspan="7"><div class="empty-state">No hay ventas en este rango.</div></td></tr>
                      {:else}
                        {#each ventasPorDia as d (d.dia)}
                          <tr>
                            <td data-label="Día">{formatDate(d.dia + ' 00:00:00')}</td>
                            <td data-label="# Ventas">{d.num_ventas}</td>
                            <td data-label="Total"><strong>{formatMoney(d.venta_total)}</strong></td>
                            <td data-label="Efectivo">{formatMoney(d.efectivo)}</td>
                            <td data-label="Transferencia">{formatMoney(d.transferencia)}</td>
                            <td data-label="Propia">{formatMoney(d.venta_propia)}</td>
                            <td data-label="Consignación">{formatMoney(d.venta_consignacion)}</td>
                          </tr>
                        {/each}
                      {/if}
                    </tbody>
                  </table>
                </div>

                <div class="sales-list">
                  {#if !filteredSales.length}
                    <div class="empty-state">No hay ventas en este rango.</div>
                  {:else}
                    {#each filteredSales as v (v.id)}
                      <div class="sale-card">
                        <div class="sale-card-top">
                          <div>
                            <strong>Venta #{v.id}</strong>
                            <div class="muted">{formatDateTime(v.fecha)}</div>
                          </div>
                          <div style="text-align:right;">
                            <strong>{formatMoney(v.total)}</strong>
                            <div class="muted">{TIPO_PAGO_LABELS[v.tipo_pago] || v.tipo_pago}</div>
                          </div>
                        </div>
                        <div class="muted">
                          {v.items.length} producto(s) · Efectivo {formatMoney(v.subtotal_efectivo)} · Transferencia
                          {formatMoney(v.subtotal_transferencia)}
                          {#if v.es_consignacion}· <span class="badge visible">Consignación</span>{/if}
                          {#if v.estado === 'cancelada'}· <span class="badge visible">Cancelada</span>{/if}
                        </div>
                        <div class="muted" style="font-size:0.82rem; margin-top:2px;">
                          {#if v.caja_numero != null}Caja {v.caja_numero}{:else}Sin caja{/if}
                          {#if v.cajero_nombre} · {v.cajero_nombre}{/if}
                        </div>
                        <div class="row-actions">
                          <button class="btn" onclick={() => (saleModal = v)}>Ver detalles</button>
                          <button class="btn danger" onclick={() => deleteSale(v)}>Eliminar</button>
                        </div>
                      </div>
                    {/each}
                  {/if}
                </div>
              </article>
            </div>
          {/if}

          {#if activeEconomia === 'extracciones'}
            <div class="econ-panel active">
              <article class="panel-card">
                <h2>Extracciones de caja</h2>
                <p class="muted">Retiros directos registrados desde caja para seguimiento administrativo.</p>
                <fieldset class="cajas-filter">
                  <legend>Cajas</legend>
                  {#each ['all', 1, 2, 3] as c (c)}
                    <button
                      class="btn filter"
                      class:active={String(cajaFilter.extracciones) === String(c)}
                      type="button"
                      onclick={() => (cajaFilter.extracciones = c as CajaSel)}
                      >{c === 'all' ? 'Todas' : `Caja ${c}`}</button
                    >
                  {/each}
                </fieldset>
                <div class="report-list">
                  {#if !filteredExtracciones.length}
                    <div class="empty-state">No hay extracciones para este filtro.</div>
                  {:else}
                    {#each filteredExtracciones as m (m.id)}
                      <div class="report-card">
                        <div class="report-head">
                          <div>
                            <strong>Extracción #{m.id}</strong>
                            <div class="muted">{formatDateTime(m.fecha)} · Caja #{m.caja_id || '—'}</div>
                          </div>
                          <span class="report-tag exit">−{formatMoney(m.monto)}</span>
                        </div>
                        <div class="report-meta">
                          <span>{m.concepto || 'Sin motivo'}</span>
                          {#if m.responsable}<span>Responsable: {m.responsable}</span>{/if}
                        </div>
                      </div>
                    {/each}
                  {/if}
                </div>
              </article>
            </div>
          {/if}

          {#if activeEconomia === 'reportes'}
            <div class="econ-panel active">
              <article class="panel-card">
                <h2>Filtro de período</h2>
                <fieldset class="cajas-filter">
                  <legend>Cajas</legend>
                  {#each ['all', 1, 2, 3] as c (c)}
                    <button
                      class="btn filter"
                      class:active={String(cajaFilter.reportes) === String(c)}
                      type="button"
                      onclick={() => (cajaFilter.reportes = c as CajaSel)}
                      >{c === 'all' ? 'Todas' : `Caja ${c}`}</button
                    >
                  {/each}
                </fieldset>
                <div class="filters-grid">
                  <div class="quick-filters">
                    {#each [['week', 'Última semana'], ['month', 'Último mes'], ['all', 'Todo']] as [f, label] (f)}
                      <button
                        class="btn filter"
                        class:active={reportFilter === f && !reportRange}
                        type="button"
                        onclick={() => setReportQuick(f as 'week' | 'month' | 'all')}>{label}</button
                      >
                    {/each}
                  </div>
                  <div class="date-range">
                    <label>Desde<input type="date" bind:value={reportFrom} /></label>
                    <label>Hasta<input type="date" bind:value={reportTo} /></label>
                    <button class="btn" type="button" onclick={applyReportRange}>Aplicar</button>
                  </div>
                </div>
              </article>

              <article class="panel-card">
                <h2>Reporte semanal</h2>
                <p class="muted">Excluye consignación del total propio.</p>
                {#if reportSemanal}
                  <div class="report-card">
                    <div class="report-meta">
                      <span>Venta total (propio): <strong>{formatMoney(reportSemanal.venta_total)}</strong></span>
                      <span>Efectivo: <strong>{formatMoney(reportSemanal.efectivo_total)}</strong></span>
                      <span>Transferencia: <strong>{formatMoney(reportSemanal.transferencia_total)}</strong></span>
                      <span>Utilidad: <strong>{formatMoney(reportSemanal.utilidad_total)}</strong></span>
                    </div>
                    <div class="report-meta">
                      <span>Extracciones: <strong class="report-delta exit">−{formatMoney(reportSemanal.extracciones_total)}</strong></span>
                      <span>Compras mercancía: <strong class="report-delta exit">−{formatMoney(reportSemanal.compras_total)}</strong></span>
                      <span>Consignación (aparte): <strong>{formatMoney(reportSemanal.consignacion_total)}</strong></span>
                    </div>
                  </div>
                {/if}
              </article>

              <article class="panel-card">
                <h2>Por categoría</h2>
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Categoría</th><th>Tipo</th><th>Unidades</th><th>Venta</th><th>Utilidad</th></tr></thead>
                    <tbody>
                      {#if !reportCategorias.length}
                        <tr class="table-empty-row"><td colspan="5"><div class="empty-state">Sin datos.</div></td></tr>
                      {:else}
                        {#each reportCategorias as r (r.categoria_id)}
                          <tr>
                            <td data-label="Categoría">{r.nombre}</td>
                            <td data-label="Tipo">
                              {#if r.es_consignacion}<span class="badge visible">Consignación</span>
                              {:else}<span class="badge visible">Propia</span>{/if}
                            </td>
                            <td data-label="Unidades">{r.unidades}</td>
                            <td data-label="Venta">{formatMoney(r.venta_total)}</td>
                            <td data-label="Utilidad">{formatMoney(r.utilidad_total)}</td>
                          </tr>
                        {/each}
                      {/if}
                    </tbody>
                  </table>
                </div>
              </article>

              <article class="panel-card">
                <h2>Utilidad por producto</h2>
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Producto</th><th>Categoría</th><th>Tipo</th><th>Unidades</th><th>Venta</th><th>Utilidad</th></tr></thead>
                    <tbody>
                      {#if !reportProductos.length}
                        <tr class="table-empty-row"><td colspan="6"><div class="empty-state">Sin datos.</div></td></tr>
                      {:else}
                        {#each reportProductos as r (r.producto_id)}
                          <tr>
                            <td data-label="Producto">{r.nombre}</td>
                            <td data-label="Categoría">{r.categoria_nombre}</td>
                            <td data-label="Tipo">
                              {#if r.es_consignacion}<span class="badge visible">Consignación</span>
                              {:else}<span class="badge visible">Propio</span>{/if}
                            </td>
                            <td data-label="Unidades">{r.unidades}</td>
                            <td data-label="Venta">{formatMoney(r.venta_total)}</td>
                            <td data-label="Utilidad">{formatMoney(r.utilidad_total)}</td>
                          </tr>
                        {/each}
                      {/if}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          {/if}
          {#if activeEconomia === 'inventario'}
            <div class="econ-panel active">
              <article class="panel-card">
                <h2>Inventario valorado</h2>
                <p class="muted">Valor de la mercancía en stock (stock × costo), por categoría.</p>
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Categoría</th><th>Tipo</th><th>Productos</th><th>Unidades</th>
                        <th>Valor costo</th><th>Valor venta</th><th>Utilidad pot.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#if !inventario || !inventario.categorias.length}
                        <tr class="table-empty-row"><td colspan="7"><div class="empty-state">Sin datos de inventario.</div></td></tr>
                      {:else}
                        {#each inventario.categorias as r (r.categoria_id)}
                          <tr>
                            <td data-label="Categoría">{r.nombre}</td>
                            <td data-label="Tipo">
                              {#if r.es_consignacion}<span class="badge visible">Consignación</span>
                              {:else}<span class="badge visible">Propia</span>{/if}
                            </td>
                            <td data-label="Productos">{r.productos}</td>
                            <td data-label="Unidades">{r.unidades}</td>
                            <td data-label="Valor costo">{formatMoney(r.valor_costo)}</td>
                            <td data-label="Valor venta">{formatMoney(r.valor_venta)}</td>
                            <td data-label="Utilidad pot.">{formatMoney(r.utilidad_potencial)}</td>
                          </tr>
                        {/each}
                        <tr class="total-row">
                          <td data-label="Categoría"><strong>TOTAL</strong></td>
                          <td data-label="Tipo"></td>
                          <td data-label="Productos"><strong>{inventario.total.productos}</strong></td>
                          <td data-label="Unidades"><strong>{inventario.total.unidades}</strong></td>
                          <td data-label="Valor costo"><strong>{formatMoney(inventario.total.valor_costo)}</strong></td>
                          <td data-label="Valor venta"><strong>{formatMoney(inventario.total.valor_venta)}</strong></td>
                          <td data-label="Utilidad pot."><strong>{formatMoney(inventario.total.utilidad_potencial)}</strong></td>
                        </tr>
                      {/if}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          {/if}

          {#if activeEconomia === 'gastos'}
            <div class="econ-panel active">
              <div class="panel-grid two-columns">
                <article class="panel-card">
                  <h2>Registrar gasto</h2>
                  <form class="form-grid" onsubmit={submitGasto}>
                    <label>
                      Tipo
                      <select bind:value={gTipo}>
                        {#each GASTO_TIPOS as t (t.value)}
                          <option value={t.value}>{t.label}</option>
                        {/each}
                      </select>
                    </label>
                    {#if gTipo === 'individual'}
                      <label>Socio<input type="text" bind:value={gSocio} placeholder="Ej: Jesús" /></label>
                    {/if}
                    <label>Concepto<input type="text" bind:value={gConcepto} placeholder="Ej: salario semana" /></label>
                    <label>Monto<input type="number" min="0" step="0.01" bind:value={gMonto} required /></label>
                    <label>Fecha (opcional, hoy si se deja vacío)<input type="date" bind:value={gFecha} /></label>
                    {#if gError}<p class="form-error">{gError}</p>{/if}
                    <div class="actions-row">
                      <button class="btn primary" type="submit">Guardar gasto</button>
                    </div>
                  </form>
                </article>

                <article class="panel-card">
                  <div class="card-head-row">
                    <h2>Gastos registrados</h2>
                    <span class="muted">Total: <strong>{formatMoney(gastosTotal)}</strong></span>
                  </div>
                  <div class="table-wrap">
                    <table>
                      <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Monto</th><th>Acciones</th></tr></thead>
                      <tbody>
                        {#if !gastos.length}
                          <tr class="table-empty-row"><td colspan="5"><div class="empty-state">No hay gastos registrados.</div></td></tr>
                        {:else}
                          {#each gastos as g (g.id)}
                            <tr>
                              <td data-label="Fecha">{formatDate(g.fecha)}</td>
                              <td data-label="Tipo">{GASTO_LABEL[g.tipo] || g.tipo}{g.socio ? ' · ' + g.socio : ''}</td>
                              <td data-label="Concepto">{g.concepto || '-'}</td>
                              <td data-label="Monto">{formatMoney(g.monto)}</td>
                              <td data-label="Acciones">
                                <div class="row-actions">
                                  <button class="btn danger" onclick={() => deleteGasto(g)}>Eliminar</button>
                                </div>
                              </td>
                            </tr>
                          {/each}
                          <tr class="total-row">
                            <td data-label="Fecha"></td>
                            <td data-label="Tipo"><strong>TOTAL</strong></td>
                            <td data-label="Concepto"></td>
                            <td data-label="Monto"><strong>{formatMoney(gastosTotal)}</strong></td>
                            <td data-label="Acciones"></td>
                          </tr>
                        {/if}
                      </tbody>
                    </table>
                  </div>
                </article>
              </div>
            </div>
          {/if}

          {#if activeEconomia === 'consignaciones'}
            <div class="econ-panel active">
              <article class="panel-card">
                <h2>Liquidación de consignaciones</h2>
                <p class="muted">
                  Por consignador: lo vendido de sus productos y cuánto se le debe pagar
                  (<em>a pagar = unidades × costo</em>).
                </p>
                <fieldset class="cajas-filter">
                  <legend>Cajas</legend>
                  {#each ['all', 1, 2, 3] as c (c)}
                    <button
                      class="btn filter"
                      class:active={String(cajaFilter.consignaciones) === String(c)}
                      type="button"
                      onclick={() => (cajaFilter.consignaciones = c as CajaSel)}
                      >{c === 'all' ? 'Todas' : `Caja ${c}`}</button
                    >
                  {/each}
                </fieldset>
                <div class="filters-grid">
                  <div class="quick-filters">
                    {#each [['week', 'Última semana'], ['month', 'Último mes'], ['all', 'Todo']] as [f, label] (f)}
                      <button
                        class="btn filter"
                        class:active={consigFilter === f && !consigRange}
                        type="button"
                        onclick={() => setConsigQuick(f as 'week' | 'month' | 'all')}>{label}</button
                      >
                    {/each}
                  </div>
                  <div class="date-range">
                    <label>Desde<input type="date" bind:value={consigFrom} /></label>
                    <label>Hasta<input type="date" bind:value={consigTo} /></label>
                    <button class="btn" type="button" onclick={applyConsigRange}>Aplicar</button>
                  </div>
                </div>
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Consignador</th><th>Unidades</th><th>A pagar (costo)</th>
                        <th>Venta</th><th>Utilidad bazar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#if !consigData || !consigData.consignadores.length}
                        <tr class="table-empty-row"><td colspan="5"><div class="empty-state">Sin ventas de consignación en este período.</div></td></tr>
                      {:else}
                        {#each consigData.consignadores as r (r.consignador)}
                          <tr>
                            <td data-label="Consignador">{r.consignador}</td>
                            <td data-label="Unidades">{r.unidades}</td>
                            <td data-label="A pagar (costo)">{formatMoney(r.a_pagar)}</td>
                            <td data-label="Venta">{formatMoney(r.venta)}</td>
                            <td data-label="Utilidad bazar">{formatMoney(r.utilidad_bazar)}</td>
                          </tr>
                        {/each}
                        <tr class="total-row">
                          <td data-label="Consignador"><strong>TOTAL</strong></td>
                          <td data-label="Unidades"><strong>{consigData.total.unidades}</strong></td>
                          <td data-label="A pagar (costo)"><strong>{formatMoney(consigData.total.a_pagar)}</strong></td>
                          <td data-label="Venta"><strong>{formatMoney(consigData.total.venta)}</strong></td>
                          <td data-label="Utilidad bazar"><strong>{formatMoney(consigData.total.utilidad_bazar)}</strong></td>
                        </tr>
                      {/if}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          {/if}

          {#if activeEconomia === 'deudas'}
            <div class="econ-panel active">
              <div class="panel-grid two-columns">
                <article class="panel-card">
                  <h2>Registrar cuenta por pagar</h2>
                  <p class="muted">Mercancía u obligación comprada a crédito (deuda con un proveedor).</p>
                  <form class="form-grid" onsubmit={submitDeuda}>
                    <label>Proveedor<input type="text" bind:value={dProveedor} placeholder="Ej: Mayorista centro" required /></label>
                    <label>Concepto<input type="text" bind:value={dConcepto} placeholder="Ej: mercancía aseo" /></label>
                    <label>Monto<input type="number" min="0" step="0.01" bind:value={dMonto} required /></label>
                    <label>Fecha (opcional)<input type="date" bind:value={dFecha} /></label>
                    <div class="actions-row">
                      <button class="btn primary" type="submit">Guardar deuda</button>
                    </div>
                  </form>
                </article>

                <article class="panel-card">
                  <div class="card-head-row">
                    <h2>Cuentas por pagar</h2>
                    <span class="muted">Saldo total: <strong>{formatMoney(totalAdeudado)}</strong></span>
                  </div>
                  <div class="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Fecha</th><th>Proveedor</th><th>Concepto</th><th>Monto</th><th>Saldo</th><th>Estado</th><th>Acciones</th></tr>
                      </thead>
                      <tbody>
                        {#if !deudasList.length}
                          <tr class="table-empty-row"><td colspan="7"><div class="empty-state">No hay cuentas por pagar.</div></td></tr>
                        {:else}
                          {#each deudasList as c (c.id)}
                            <tr>
                              <td data-label="Fecha">{formatDate(c.fecha)}</td>
                              <td data-label="Proveedor">{c.proveedor}</td>
                              <td data-label="Concepto">{c.concepto || '-'}</td>
                              <td data-label="Monto">{formatMoney(c.monto)}</td>
                              <td data-label="Saldo">{formatMoney(c.saldo)}</td>
                              <td data-label="Estado">
                                {#if c.estado === 'pagada'}<span class="badge visible">Pagada</span>
                                {:else}<span class="badge visible">Pendiente</span>{/if}
                              </td>
                              <td data-label="Acciones">
                                <div class="row-actions">
                                  <button class="btn" onclick={() => openPago(c)} disabled={c.estado === 'pagada'}>Pagar</button>
                                  <button class="btn danger" onclick={() => deleteDeuda(c)}>Eliminar</button>
                                </div>
                              </td>
                            </tr>
                          {/each}
                          <tr class="total-row">
                            <td data-label="Fecha"></td>
                            <td data-label="Proveedor"><strong>TOTAL</strong></td>
                            <td data-label="Concepto"></td>
                            <td data-label="Monto"></td>
                            <td data-label="Saldo"><strong>{formatMoney(totalAdeudado)}</strong></td>
                            <td data-label="Estado"></td>
                            <td data-label="Acciones"></td>
                          </tr>
                        {/if}
                      </tbody>
                    </table>
                  </div>
                </article>
              </div>
            </div>
          {/if}

          {#if activeEconomia === 'creditos'}
            <div class="econ-panel active">
              <div class="panel-grid">
                <article class="panel-card">
                  <div class="card-head-row">
                    <h2>Cuentas por cobrar (libreta)</h2>
                    <span class="muted">Saldo total: <strong>{formatMoney(totalPorCobrar)}</strong></span>
                  </div>
                  <p class="muted">Ventas a crédito registradas desde el punto de venta (Caja → Crédito).</p>
                  <div class="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Fecha</th><th>Cliente</th><th>Total</th><th>Saldo</th><th>Estado</th><th>Acciones</th></tr>
                      </thead>
                      <tbody>
                        {#if !creditosList.length}
                          <tr class="table-empty-row"><td colspan="6"><div class="empty-state">No hay cuentas por cobrar.</div></td></tr>
                        {:else}
                          {#each creditosList as c (c.id)}
                            <tr>
                              <td data-label="Fecha">{formatDate(c.fecha)}</td>
                              <td data-label="Cliente">{c.cliente || '-'}</td>
                              <td data-label="Total">{formatMoney(c.total)}</td>
                              <td data-label="Saldo">{formatMoney(c.saldo)}</td>
                              <td data-label="Estado">
                                {#if c.estado === 'pagada'}<span class="badge visible">Cobrada</span>
                                {:else}<span class="badge visible">Activa</span>{/if}
                              </td>
                              <td data-label="Acciones">
                                <div class="row-actions">
                                  <button class="btn" onclick={() => openCobro(c)} disabled={c.estado === 'pagada'}>Cobrar</button>
                                  <button class="btn danger" onclick={() => deleteCredito(c)}>Eliminar</button>
                                </div>
                              </td>
                            </tr>
                          {/each}
                          <tr class="total-row">
                            <td data-label="Fecha"></td>
                            <td data-label="Cliente"><strong>TOTAL</strong></td>
                            <td data-label="Total"></td>
                            <td data-label="Saldo"><strong>{formatMoney(totalPorCobrar)}</strong></td>
                            <td data-label="Estado"></td>
                            <td data-label="Acciones"></td>
                          </tr>
                        {/if}
                      </tbody>
                    </table>
                  </div>
                </article>
              </div>
            </div>
          {/if}

          {#if activeEconomia === 'cuadre'}
            <div class="econ-panel active">
              <article class="panel-card">
                <h2>Cuadre semanal</h2>
                <p class="muted">P&L del bazar en el período (todas las cajas).</p>
                <div class="filters-grid">
                  <div class="quick-filters">
                    {#each [['week', 'Última semana'], ['month', 'Último mes'], ['all', 'Todo']] as [f, label] (f)}
                      <button
                        class="btn filter"
                        class:active={cuadreFilter === f && !cuadreRange}
                        type="button"
                        onclick={() => setCuadreQuick(f as 'week' | 'month' | 'all')}>{label}</button
                      >
                    {/each}
                  </div>
                  <div class="date-range">
                    <label>Desde<input type="date" bind:value={cuadreFrom} /></label>
                    <label>Hasta<input type="date" bind:value={cuadreTo} /></label>
                    <button class="btn" type="button" onclick={applyCuadreRange}>Aplicar</button>
                  </div>
                </div>
                <div class="filters-grid">
                  <label>Socios (reparto)<input type="number" min="1" step="1" bind:value={cuadreSocios} /></label>
                  <label>Reserva %<input type="number" min="0" max="100" step="1" bind:value={cuadreReserva} /></label>
                </div>
                <div class="actions-row">
                  <button class="btn primary" type="button" onclick={cerrarSemana}>Cerrar semana (guardar)</button>
                  {#if cuadreError}<p class="form-error">{cuadreError}</p>{/if}
                </div>
              </article>

              {#if cuadre}
                <article class="panel-card">
                  <h2>Resultado</h2>
                  <div class="report-card">
                    <div class="report-meta">
                      <span>Venta total (incl. consignación): <strong>{formatMoney(cuadre.venta_total)}</strong></span>
                      <span>· Propia: <strong>{formatMoney(cuadre.venta_propia)}</strong></span>
                      <span>· Consignación: <strong>{formatMoney(cuadre.venta_consignacion)}</strong></span>
                    </div>
                    <div class="report-meta">
                      <span>Efectivo: <strong>{formatMoney(cuadre.efectivo)}</strong></span>
                      <span>Transferencia: <strong>{formatMoney(cuadre.transferencia)}</strong></span>
                    </div>
                    <div class="report-meta">
                      <span>Pérdida de ganancia: <strong>{formatMoney(cuadre.perdida_ganancia)}</strong></span>
                      <span>Venta real: <strong>{formatMoney(cuadre.venta_real)}</strong></span>
                      <span>Venta al costo: <strong>{formatMoney(cuadre.venta_costo)}</strong></span>
                      <span>Utilidad bruta: <strong>{formatMoney(cuadre.utilidad_bruta)}</strong></span>
                    </div>
                  </div>

                  <div class="report-card">
                    <div class="report-meta">
                      <span>− Salarios: <strong class="report-delta exit">{formatMoney(cuadre.gastos.salarios)}</strong></span>
                      <span>− Transporte: <strong class="report-delta exit">{formatMoney(cuadre.gastos.transporte)}</strong></span>
                      <span>− ONAT/Arriendo: <strong class="report-delta exit">{formatMoney(cuadre.gastos.onat + cuadre.gastos.arrendamiento)}</strong></span>
                      <span>− Contador: <strong class="report-delta exit">{formatMoney(cuadre.gastos.contador)}</strong></span>
                      <span>− Estimulación: <strong class="report-delta exit">{formatMoney(cuadre.gastos.estimulacion)}</strong></span>
                    </div>
                    <div class="report-meta">
                      <span><strong>Utilidad neta: {formatMoney(cuadre.utilidad_neta)}</strong></span>
                    </div>
                  </div>

                  <div class="report-card">
                    <div class="report-meta">
                      <span>Reserva ({cuadre.reserva_pct}%): <strong>{formatMoney(cuadre.reserva)}</strong></span>
                      <span>Dividendos: <strong>{formatMoney(cuadre.dividendos)}</strong></span>
                      <span>Por socio ({cuadre.socios}): <strong>{formatMoney(cuadre.por_socio)}</strong></span>
                    </div>
                  </div>

                  <div class="report-card">
                    <div class="report-meta">
                      <span>Extracciones: <strong>{formatMoney(cuadre.movimientos.extracciones)}</strong></span>
                      <span>Compras mercancía: <strong>{formatMoney(cuadre.movimientos.compras_mercancia)}</strong></span>
                      <span>Pagos de caja: <strong>{formatMoney(cuadre.movimientos.pagos_caja)}</strong></span>
                      <span>Deudas pagadas: <strong>{formatMoney(cuadre.movimientos.deudas_pagadas)}</strong></span>
                    </div>
                    <div class="report-meta">
                      <span>A pagar consignadores: <strong>{formatMoney(cuadre.consignadores_a_pagar)}</strong></span>
                      <span>Faltante/sobrante: <strong>{formatMoney(cuadre.faltante_sobrante)}</strong></span>
                      <span>Efectivo en caja: <strong>{formatMoney(cuadre.efectivo_caja)}</strong></span>
                    </div>
                  </div>
                </article>
              {/if}

              <article class="panel-card">
                <h2>Cierres guardados</h2>
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Período</th><th>Venta</th><th>Utilidad neta</th><th>Dividendos</th><th>Por socio</th><th>Cerrada</th><th>Acciones</th></tr>
                    </thead>
                    <tbody>
                      {#if !cierresList.length}
                        <tr class="table-empty-row"><td colspan="7"><div class="empty-state">No hay cierres guardados.</div></td></tr>
                      {:else}
                        {#each cierresList as c (c.id)}
                          <tr>
                            <td data-label="Período">{formatDate(c.fecha_inicio)} – {formatDate(c.fecha_fin)}</td>
                            <td data-label="Venta">{formatMoney(c.venta_total)}</td>
                            <td data-label="Utilidad neta">{formatMoney(c.utilidad_neta)}</td>
                            <td data-label="Dividendos">{formatMoney(c.dividendos)}</td>
                            <td data-label="Por socio">{formatMoney(c.por_socio)} ({c.socios})</td>
                            <td data-label="Cerrada">{formatDateTime(c.cerrada_en)}</td>
                            <td data-label="Acciones">
                              <div class="row-actions">
                                <button class="btn danger" onclick={() => deleteCierre(c)}>Eliminar</button>
                              </div>
                            </td>
                          </tr>
                        {/each}
                      {/if}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          {/if}

          {#if activeEconomia === 'historial'}
            <div class="econ-panel active">
              <article class="panel-card">
                <h2>Comparación multi-semana</h2>
                <p class="muted">Semanas cerradas y su unión (totales acumulados).</p>
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Período</th><th>Venta</th><th>Costo</th><th>Util. bruta</th>
                        <th>Pérdida</th><th>Gastos</th><th>Util. neta</th>
                        <th>Dividendos</th><th>Por socio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#if !resumen || !resumen.semanas.length}
                        <tr class="table-empty-row"><td colspan="9"><div class="empty-state">No hay semanas cerradas. Cierra una semana en la pestaña Cuadre.</div></td></tr>
                      {:else}
                        {#each resumen.semanas as s (s.id)}
                          <tr>
                            <td data-label="Período">{formatDate(s.fecha_inicio)} – {formatDate(s.fecha_fin)}</td>
                            <td data-label="Venta">{formatMoney(s.venta_total)}</td>
                            <td data-label="Costo">{formatMoney(s.venta_costo)}</td>
                            <td data-label="Util. bruta">{formatMoney(s.utilidad_bruta)}</td>
                            <td data-label="Pérdida">{formatMoney(s.perdida_ganancia)}</td>
                            <td data-label="Gastos">{formatMoney(s.gastos_operativos + s.onat_arrend + s.contador + s.estimulacion)}</td>
                            <td data-label="Util. neta">{formatMoney(s.utilidad_neta)}</td>
                            <td data-label="Dividendos">{formatMoney(s.dividendos)}</td>
                            <td data-label="Por socio">{formatMoney(s.por_socio)}</td>
                          </tr>
                        {/each}
                        <tr class="total-row">
                          <td data-label="Período"><strong>UNIÓN</strong></td>
                          <td data-label="Venta"><strong>{formatMoney(resumen.total.venta_total)}</strong></td>
                          <td data-label="Costo"><strong>{formatMoney(resumen.total.venta_costo)}</strong></td>
                          <td data-label="Util. bruta"><strong>{formatMoney(resumen.total.utilidad_bruta)}</strong></td>
                          <td data-label="Pérdida"><strong>{formatMoney(resumen.total.perdida_ganancia)}</strong></td>
                          <td data-label="Gastos"><strong>{formatMoney(resumen.total.gastos_operativos + resumen.total.onat_arrend + resumen.total.contador + resumen.total.estimulacion)}</strong></td>
                          <td data-label="Util. neta"><strong>{formatMoney(resumen.total.utilidad_neta)}</strong></td>
                          <td data-label="Dividendos"><strong>{formatMoney(resumen.total.dividendos)}</strong></td>
                          <td data-label="Por socio"><strong>{formatMoney(resumen.total.por_socio)}</strong></td>
                        </tr>
                      {/if}
                    </tbody>
                  </table>
                </div>
              </article>

              {#if resumen && resumen.semanas.length}
                <article class="panel-card">
                  <h2>Reparto acumulado</h2>
                  <div class="report-card">
                    <div class="report-meta">
                      <span>Utilidad neta total: <strong>{formatMoney(resumen.total.utilidad_neta)}</strong></span>
                      <span>Reserva acumulada: <strong>{formatMoney(resumen.total.reserva)}</strong></span>
                      <span>Dividendos totales: <strong>{formatMoney(resumen.total.dividendos)}</strong></span>
                      <span>Suma por socio: <strong>{formatMoney(resumen.total.por_socio)}</strong></span>
                    </div>
                  </div>
                </article>
              {/if}
            </div>
          {/if}
        </section>
      {/if}

      <!-- USUARIOS -->
      {#if activeTab === 'usuarios'}
        <section class="tab-panel active">
          <div class="panel-grid two-columns">
            <article class="panel-card">
              <h2>{editingUserId ? `Editar usuario #${editingUserId}` : 'Crear usuario'}</h2>
              <form class="form-grid" onsubmit={submitUser}>
                <label>Nombre<input type="text" bind:value={uName} required /></label>
                <label>Usuario (login)<input type="text" bind:value={uLogin} required /></label>
                <label>
                  Rol
                  <select bind:value={uRole}>
                    <option value="admin">Administrador</option>
                    <option value="cajero">Cajero</option>
                  </select>
                </label>
                <label>
                  Contraseña <span class="muted">{uPassHint}</span>
                  <input type="password" autocomplete="new-password" bind:value={uPass} />
                </label>
                <label>Repetir contraseña<input type="password" autocomplete="new-password" bind:value={uPassConfirm} /></label>
                {#if uError}<p class="form-error">{uError}</p>{/if}
                <div class="actions-row">
                  <button type="submit" class="btn primary">Guardar usuario</button>
                  <button type="button" class="btn" onclick={resetUserForm}>Cancelar edición</button>
                </div>
              </form>
            </article>

            <article class="panel-card">
              <h2>Lista de usuarios</h2>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>ID</th><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {#if !sortedUsuarios.length}
                      <tr class="table-empty-row"><td colspan="5"><div class="empty-state">No hay usuarios.</div></td></tr>
                    {:else}
                      {#each sortedUsuarios as u (u.id)}
                        <tr>
                          <td data-label="ID">#{u.id}</td>
                          <td data-label="Nombre">{u.nombre}</td>
                          <td data-label="Usuario">{u.usuario}</td>
                          <td data-label="Rol">{ROLE_LABELS[u.rol] || u.rol}</td>
                          <td data-label="Acciones">
                            <div class="row-actions">
                              <button class="btn" onclick={() => editUser(u.id)}>Editar</button>
                              <button class="btn danger" onclick={() => deleteUser(u.id)} disabled={u.rol === 'admin'}>Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      {/each}
                    {/if}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </section>
      {/if}
    </main>

    <!-- MODAL: detalle de venta -->
    {#if saleModal}
      <div class="modal show">
        <button class="modal-backdrop" aria-label="Cerrar" onclick={() => (saleModal = null)}></button>
        <div class="modal-card">
          <div class="modal-head">
            <h3>Detalle venta #{saleModal.id}</h3>
            <button class="btn" onclick={() => (saleModal = null)}>Cerrar</button>
          </div>
          <div class="modal-content">
            <div class="detail-item">
              <div class="muted">{formatDateTime(saleModal.fecha)}</div>
              <div>Tipo de pago: <strong>{TIPO_PAGO_LABELS[saleModal.tipo_pago] || saleModal.tipo_pago}</strong></div>
              <div>Efectivo: <strong>{formatMoney(saleModal.subtotal_efectivo)}</strong></div>
              <div>Transferencia: <strong>{formatMoney(saleModal.subtotal_transferencia)}</strong></div>
              <div>Total: <strong>{formatMoney(saleModal.total)}</strong></div>
            </div>
            {#each saleModal.items as item (item.id)}
              <div class="detail-item">
                <strong>{item.producto_nombre}</strong>
                <div class="muted">Categoría: {item.categoria_nombre || '-'}</div>
                <div>Cantidad: {item.cantidad} · Unitario: {formatMoney(item.precio_unitario)}</div>
                <div>Subtotal: <strong>{formatMoney(item.subtotal)}</strong></div>
                {#if item.es_consignacion}<span class="badge visible">Consignación</span>{/if}
              </div>
            {/each}
            <div class="row-actions" style="margin-top:12px;">
              <button class="btn danger" onclick={() => saleModal && deleteSale(saleModal)}>Eliminar venta</button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- MODAL: confirmación -->
    {#if confirmBox}
      <div class="modal show">
        <button class="modal-backdrop" aria-label="Cerrar" onclick={() => (confirmBox = null)}></button>
        <div class="modal-card confirm-card">
          <div class="modal-head">
            <h3>{confirmBox.title}</h3>
            <button class="btn" onclick={() => (confirmBox = null)}>Cerrar</button>
          </div>
          <div class="modal-content">
            <div class="confirm-box">
              <p class="muted">{confirmBox.text}</p>
              <div class="detail-actions">
                <button class="btn" onclick={() => (confirmBox = null)}>Cancelar</button>
                <button class="btn" class:danger={confirmBox.danger} onclick={doConfirm}>{confirmBox.okLabel}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- MODAL: registrar pago de deuda -->
    {#if payCuenta}
      <div class="modal show">
        <button class="modal-backdrop" aria-label="Cerrar" onclick={() => (payCuenta = null)}></button>
        <div class="modal-card confirm-card">
          <div class="modal-head">
            <h3>Pagar deuda · {payCuenta.proveedor}</h3>
            <button class="btn" onclick={() => (payCuenta = null)}>Cerrar</button>
          </div>
          <div class="modal-content">
            <div class="confirm-box">
              <p class="muted">Saldo actual: <strong>{formatMoney(payCuenta.saldo)}</strong></p>
              <label>
                Monto a pagar
                <input type="number" min="0" step="0.01" bind:value={payMonto} />
              </label>
              <label>
                Método de pago
                <select bind:value={payMetodo}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </label>
              <div class="detail-actions">
                <button class="btn" onclick={() => (payCuenta = null)}>Cancelar</button>
                <button class="btn primary" onclick={confirmPago}>Registrar pago</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if payCred}
      <div class="modal show">
        <button class="modal-backdrop" aria-label="Cerrar" onclick={() => (payCred = null)}></button>
        <div class="modal-card confirm-card">
          <div class="modal-head">
            <h3>Cobrar crédito · {payCred.cliente}</h3>
            <button class="btn" onclick={() => (payCred = null)}>Cerrar</button>
          </div>
          <div class="modal-content">
            <div class="confirm-box">
              <p class="muted">Saldo actual: <strong>{formatMoney(payCred.saldo)}</strong></p>
              <label>
                Monto a cobrar
                <input type="number" min="0" step="0.01" bind:value={payCredMonto} />
              </label>
              <label>
                Método de cobro
                <select bind:value={payCredMetodo}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </label>
              <div class="detail-actions">
                <button class="btn" onclick={() => (payCred = null)}>Cancelar</button>
                <button class="btn primary" onclick={confirmCobro}>Registrar cobro</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .admin {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(circle at 12% 10%, var(--bg-accent-1), transparent 42%),
      radial-gradient(circle at 90% 0%, var(--bg-accent-2), transparent 36%),
      var(--bg);
  }

  :global(body.modal-open) {
    overflow: hidden;
  }

  .top-header {
    padding: 18px 22px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  }
  .top-header h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 26px;
  }
  .header-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .main-tabs {
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
    padding: 12px 16px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 20;
    overflow-x: auto;
    scrollbar-width: thin;
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
  }

  .tab-button,
  .sub-tab-button,
  .btn {
    border: 1px solid var(--border);
    background: var(--surface-strong);
    color: var(--text);
    border-radius: 12px;
    padding: 10px 14px;
    cursor: pointer;
    font: inherit;
    font-weight: 600;
    white-space: nowrap;
    transition:
      transform var(--duration-fast) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth),
      background var(--duration-base) var(--ease-smooth),
      color var(--duration-base) var(--ease-smooth);
  }
  .tab-button:hover,
  .sub-tab-button:hover,
  .btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 20px rgba(15, 23, 42, 0.12);
  }
  .tab-button:active,
  .sub-tab-button:active,
  .btn:active {
    transform: translateY(0) scale(0.98);
  }
  .tab-button.active,
  .sub-tab-button.active,
  .btn.filter.active {
    background: linear-gradient(135deg, var(--primary), var(--primary-strong));
    color: #ffffff;
    border-color: transparent;
    box-shadow: 0 12px 24px rgba(15, 118, 110, 0.24);
  }
  .btn.primary {
    background: linear-gradient(135deg, var(--primary), var(--primary-strong));
    color: #ffffff;
    border-color: transparent;
  }
  .btn.danger {
    background: linear-gradient(135deg, var(--danger), #ef4444);
    color: #ffffff;
    border-color: transparent;
  }
  .btn:focus-visible,
  .tab-button:focus-visible,
  .sub-tab-button:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: none;
    box-shadow: var(--ring);
  }

  .main-content {
    padding: 16px;
    flex: 1;
  }
  .tab-panel.active {
    display: block;
    animation: fadeIn var(--duration-base) var(--ease-soft);
  }

  .panel-grid {
    display: grid;
    gap: 14px;
  }
  .panel-grid.two-columns {
    grid-template-columns: 1fr 1.3fr;
    /* header ~62px + tabs ~57px + padding 32px + gap 14px = ~165px */
    height: calc(100vh - 165px);
  }
  .panel-grid.single-column {
    grid-template-columns: 1fr;
  }
  /* Categorías: columna única con altura fija, formulario arriba + lista abajo */
  .panel-grid:not(.two-columns):not(.single-column) {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    height: calc(100vh - 165px);
  }
  .cat-form-grid {
    flex: none;
    overflow-y: visible;
  }

  .panel-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 12px;
    box-shadow: 0 18px 35px rgba(15, 23, 42, 0.08);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
    transition: box-shadow var(--duration-base) var(--ease-smooth);
  }
  .panel-card:hover {
    box-shadow: 0 22px 40px rgba(15, 23, 42, 0.12);
  }
  .panel-card h2 {
    margin: 0 0 12px;
    font-family: var(--font-display);
    font-size: 20px;
  }
  .card-head-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .card-head-row h2 {
    margin-bottom: 0;
  }

  .hidden {
    display: none !important;
  }

  .form-grid {
    display: grid;
    gap: 8px;
    align-content: start;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-right: 4px;
  }
  .form-grid label {
    display: grid;
    gap: 4px;
    font-size: 13px;
    font-weight: 600;
  }

  input,
  select {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px;
    font: inherit;
    background: var(--surface-strong);
    color: var(--text);
    transition:
      border-color var(--duration-base) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth),
      background var(--duration-base) var(--ease-smooth);
  }
  input[type='file'] {
    padding: 8px;
    cursor: pointer;
  }
  input[type='file']::file-selector-button {
    margin-right: 10px;
    border: 0;
    border-radius: 999px;
    padding: 8px 14px;
    font-weight: 700;
    background: var(--primary);
    color: #ffffff;
    cursor: pointer;
    transition:
      transform var(--duration-base) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth);
  }
  input[type='file']::file-selector-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
  }

  .inline-row {
    display: flex !important;
    align-items: center;
    gap: 8px;
  }
  .muted {
    color: var(--muted);
    font-weight: 400;
    font-size: 12px;
  }
  .form-error {
    margin: 4px 0 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(214, 69, 69, 0.12);
    color: var(--danger);
    font-size: 13px;
    font-weight: 600;
  }

  .image-preview {
    width: 100%;
    max-width: 220px;
    border-radius: 12px;
    border: 1px dashed var(--border);
    background: var(--surface-strong);
    padding: 8px;
    display: none;
    align-items: center;
    justify-content: center;
  }
  .image-preview.show {
    display: flex;
  }
  .image-preview img {
    width: 100%;
    height: 120px;
    object-fit: cover;
    border-radius: 10px;
  }
  .product-thumb {
    width: 44px;
    height: 44px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface-strong);
  }

  .cajas-filter {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface-strong);
    padding: 10px 14px 12px;
    margin: 0 0 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .cajas-filter > legend {
    padding: 0 8px;
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  .cajas-filter .btn {
    padding: 6px 12px;
    font-size: 13px;
    border-radius: 999px;
  }

  .cajas-config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 14px;
    margin-top: 8px;
  }
  .caja-config-card {
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface-strong);
    padding: 14px;
    display: grid;
    gap: 10px;
  }
  .caja-config-card h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 18px;
  }
  .caja-config-card .summary {
    font-size: 12px;
    color: var(--muted);
  }
  .categoria-checks {
    display: grid;
    gap: 6px;
    max-height: 240px;
    overflow: auto;
    padding: 6px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .categoria-checks label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 6px;
  }
  .categoria-checks label:hover {
    background: var(--surface-strong);
  }
  .categoria-checks input[type='checkbox'] {
    margin: 0;
  }
  .categoria-checks .cat-consignacion {
    color: var(--danger);
  }

  .actions-row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    flex-wrap: wrap;
  }

  .table-wrap {
    overflow: auto;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--surface);
    flex: 1;
    min-height: 0;
  }
  .product-filters {
    grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
    align-items: end;
    gap: 8px;
  }
  .product-filters label {
    width: 100%;
    font-size: 12px;
    gap: 4px;
  }
  .product-filters .search-filter {
    grid-column: 1 / -1;
  }
  .product-filters input,
  .product-filters select {
    width: 100%;
    padding: 8px 10px;
    border-radius: 8px;
  }
  .filter-actions {
    display: flex;
    align-items: flex-end;
    padding-bottom: 2px;
    grid-column: 1 / -1;
    justify-content: flex-end;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 880px;
  }
  thead th {
    background: var(--surface-strong);
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    text-align: center;
  }
  tbody td {
    text-align: center;
    vertical-align: middle;
  }
  tbody td :global(.badge) {
    display: inline-flex;
  }
  th,
  td {
    border-bottom: 1px solid var(--border);
    text-align: left;
    padding: 6px 8px;
    font-size: 13px;
    vertical-align: top;
  }
  tbody tr:hover {
    background: rgba(15, 118, 110, 0.06);
  }
  tbody tr {
    transition: background var(--duration-base) var(--ease-smooth);
  }
  .total-row td {
    background: var(--surface-strong);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 4px 8px;
    font-size: 12px;
    font-weight: 700;
  }
  .badge.visible {
    background: rgba(22, 163, 74, 0.14);
    color: var(--success);
  }
  .badge.hidden {
    background: rgba(220, 38, 38, 0.14);
    color: var(--danger);
  }

  .filters-grid {
    display: grid;
    gap: 10px;
    margin-bottom: 12px;
  }
  .quick-filters,
  .date-range,
  .sub-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .date-range label {
    min-width: 140px;
  }

  .daily-summary {
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface-strong);
    padding: 14px 16px;
    margin: 12px 0 16px;
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
  }
  .daily-summary-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .daily-summary-head strong {
    font-family: var(--font-display);
    font-size: 17px;
  }
  .daily-summary-head .muted {
    font-size: 12px;
  }
  .daily-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 10px;
  }
  .ds-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
  }
  .ds-label {
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .ds-value {
    font-size: 18px;
    font-weight: 700;
    font-family: var(--font-display);
  }

  .sales-list {
    display: grid;
    gap: 10px;
  }
  .sale-card {
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 12px;
    background: var(--surface-strong);
    display: grid;
    gap: 8px;
    transition:
      transform var(--duration-base) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth);
  }
  .sale-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 32px rgba(15, 23, 42, 0.12);
  }
  .report-list {
    display: grid;
    gap: 12px;
  }
  .report-card {
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 12px;
    background: var(--surface-strong);
    display: grid;
    gap: 8px;
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
    transition:
      transform var(--duration-base) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth);
    animation: fadeIn var(--duration-base) var(--ease-soft);
  }
  .report-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 32px rgba(15, 23, 42, 0.12);
  }
  .report-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .report-tag {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 700;
  }
  .report-tag.exit {
    background: rgba(220, 38, 38, 0.16);
    color: var(--danger);
  }
  .report-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    font-size: 13px;
    color: var(--muted);
  }
  .report-delta {
    font-weight: 700;
  }
  .report-delta.exit {
    color: var(--danger);
  }
  .sale-card-top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }
  .empty-state {
    padding: 16px;
    border: 1px dashed var(--border);
    border-radius: 12px;
    color: var(--muted);
    background: var(--surface-strong);
  }

  .modal {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 40;
  }
  .modal.show {
    display: block;
  }
  .modal.show .modal-card {
    animation: modalIn 0.22s ease;
  }
  .modal-backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    border: 0;
    padding: 0;
    cursor: default;
    background: rgba(2, 6, 23, 0.6);
  }
  .modal-card {
    position: relative;
    width: min(900px, 94vw);
    margin: 40px auto;
    background: var(--surface);
    border-radius: 18px;
    border: 1px solid var(--border);
    overflow: hidden;
    box-shadow: var(--shadow);
  }
  .modal-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 14px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-strong);
  }
  .modal-head h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 18px;
  }
  .modal-content {
    padding: 14px;
    max-height: 65vh;
    overflow: auto;
    display: grid;
    gap: 10px;
  }
  .confirm-card .modal-content {
    padding: 0;
  }
  .confirm-box {
    padding: 24px;
    display: grid;
    gap: 18px;
  }
  .confirm-box p {
    margin: 0;
    line-height: 1.6;
  }
  .detail-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }
  .detail-item {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px;
    background: var(--surface-strong);
    transition:
      transform var(--duration-base) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth);
  }
  .detail-item:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
  }
  .row-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
  }

  @media (max-width: 980px) {
    .panel-grid.two-columns,
    .panel-grid:not(.two-columns):not(.single-column) {
      grid-template-columns: 1fr;
      grid-template-rows: none;
      height: auto;
    }
    .panel-card {
      overflow: visible;
    }
    .form-grid {
      flex: none;
      overflow-y: visible;
    }
    .table-wrap {
      flex: none;
      overflow: auto;
      max-height: 420px;
    }
    table {
      min-width: 760px;
    }
  }

  @media (max-width: 760px) {
    .top-header {
      padding: 12px 14px;
    }
    .top-header h1 {
      font-size: 22px;
    }
    .main-tabs {
      padding: 10px;
      gap: 6px;
      flex-wrap: wrap;
      overflow-x: visible;
    }
    .main-tabs .tab-button {
      flex: 1 1 calc(50% - 6px);
      min-width: 0;
      min-height: 44px;
      white-space: normal;
      text-align: center;
      justify-content: center;
    }
    .main-content {
      padding: 10px;
    }
    .panel-card {
      padding: 12px;
      border-radius: 14px;
    }
    .card-head-row {
      flex-direction: column;
      align-items: stretch;
    }
    .card-head-row .btn {
      width: 100%;
    }
    .filters-grid {
      gap: 8px;
    }
    .sub-tabs,
    .actions-row,
    .row-actions,
    .date-range {
      flex-direction: column;
      align-items: stretch;
    }
    .quick-filters {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 6px;
    }
    .quick-filters .btn {
      flex: 1 1 auto;
      min-height: 44px;
    }
    .sub-tabs {
      flex-direction: row;
      flex-wrap: wrap;
    }
    .sub-tabs .sub-tab-button {
      flex: 1 1 calc(33.333% - 6px);
      min-width: 0;
      white-space: normal;
      text-align: center;
      justify-content: center;
    }
    .actions-row .btn,
    .row-actions .btn,
    .date-range .btn {
      width: 100%;
    }
    .date-range label {
      min-width: 0;
    }
    .table-wrap {
      overflow: visible;
      border: none;
      background: transparent;
    }
    table,
    thead,
    tbody,
    tr,
    th,
    td {
      display: block;
      width: 100%;
    }
    table {
      min-width: 0;
      border-collapse: separate;
      border-spacing: 0 10px;
    }
    thead {
      display: none;
    }
    tbody tr {
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--surface);
      overflow: hidden;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
    }
    tbody tr:hover {
      background: var(--surface);
    }
    tbody tr.table-empty-row {
      border: none;
      box-shadow: none;
    }
    th,
    td {
      border: none;
      padding: 6px 10px;
      font-size: 12px;
    }
    td {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: flex-start;
      text-align: right;
      border-bottom: 1px solid var(--border);
    }
    td::before {
      content: attr(data-label);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--muted);
      text-align: left;
      flex: 0 0 45%;
    }
    td[data-label='Acciones'] {
      display: block;
      text-align: left;
    }
    td[data-label='Acciones']::before {
      display: block;
      margin-bottom: 6px;
    }
    td[data-label='Acciones'] .row-actions {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 6px;
    }
    td[data-label='Acciones'] .row-actions .btn {
      flex: 1 1 calc(33.333% - 4px);
      width: auto;
      padding: 6px 8px;
      font-size: 12px;
    }
    td:last-child {
      border-bottom: none;
    }
    .sale-card-top {
      flex-direction: column;
      align-items: flex-start;
    }
    .modal-card {
      width: calc(100vw - 16px);
      margin: 8px;
      border-radius: 12px;
    }
    .modal-head,
    .modal-content {
      padding: 10px;
    }
    .modal-head {
      flex-direction: column;
      align-items: flex-start;
    }
    /* Mobile: todo scrollea naturalmente */
    .panel-grid.two-columns,
    .panel-grid:not(.two-columns):not(.single-column) {
      height: auto;
      grid-template-rows: none;
    }
    .panel-card {
      overflow: visible;
    }
    .form-grid {
      flex: none;
      overflow-y: visible;
    }
    .table-wrap {
      flex: none;
      overflow: auto;
      max-height: 350px;
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes modalIn {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.985);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
