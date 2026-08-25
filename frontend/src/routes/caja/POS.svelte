<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '../../lib/api'
  import { workingCaja } from '../../lib/stores'
  import type { CajaConfig, Categoria, Producto } from '../../lib/types'

  interface CartItem {
    producto_id: number
    nombre: string
    precio_unitario: number
    cantidad: number
    es_consignacion: boolean
    /** Precio normal de venta del producto (no editable por el cajero). */
    precio_lista: number
    /** Costo del producto: precio al que se vende si se marca "a precio de costo". */
    costo: number
    /** Si está marcado, esta línea se vende al costo (queda registrado como
     *  pérdida de ganancia en la venta). */
    al_costo: boolean
  }

  const money = (v: number | string) =>
    new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(Number(v) || 0)
  const normalizeQty = (v: unknown) => {
    const p = parseInt(String(v), 10)
    return Number.isNaN(p) || p < 1 ? 1 : p
  }
  const roundMoney = (v: number) => Math.round(v * 100) / 100
  const clampMoney = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

  let productos = $state<Producto[]>([])
  let categorias = $state<Categoria[]>([])
  let cajasConfig = $state<CajaConfig[]>([])
  let cart = $state<CartItem[]>([])
  let qtys = $state<Record<number, number>>({})
  let productSearch = $state('')
  let orderSearch = $state('')
  let activeCat = $state<'all' | number>('all')

  // Modales
  let showOrder = $state(false)
  let showPayment = $state(false)

  // Pago
  let pendingSale = $state<{ total: number; items: CartItem[] } | null>(null)
  let payCash = $state('0')
  let payTransfer = $state('0')
  let payTotal = $state(0)
  let payError = $state('')
  /** Cerrojo mientras se envía la venta: evita registrarla dos veces. */
  let enviandoVenta = $state(false)
  let stockError = $state('')
  // Venta a crédito / libreta (fiado)
  let payCredito = $state(false)
  let creditoCliente = $state('')
  let trackEl = $state<HTMLDivElement>()
  let dragging = false

  async function refreshData() {
    ;[productos, categorias, cajasConfig] = await Promise.all([
      api.productos.listar(),
      api.categorias.listar(),
      api.cajas_config.listar(),
    ])
  }

  // Categorías permitidas en la caja de trabajo (las que el admin marcó para
  // esa registradora). Si no hay caja seleccionada, no se permite ninguna.
  const allowedCatIds = $derived.by(() => {
    const wc = $workingCaja
    if (!wc || wc.numero == null) return new Set<number>()
    const cfg = cajasConfig.find((c) => c.id === wc.numero)
    return new Set<number>(cfg?.categorias_ids ?? [])
  })

  // Si la categoría seleccionada deja de estar permitida (el admin la desmarcó),
  // vuelve a "Todas".
  $effect(() => {
    if (activeCat !== 'all' && !allowedCatIds.has(activeCat)) activeCat = 'all'
  })

  const catChips = $derived([
    { id: 'all' as const, nombre: 'Todas', es_consignacion: 0 },
    ...categorias.filter((c) => c.activa && allowedCatIds.has(c.id)),
  ])

  const filteredProducts = $derived(
    productos
      .filter((p) => {
        if (!allowedCatIds.has(p.categoria_id)) return false
        if (activeCat !== 'all' && p.categoria_id !== activeCat) return false
        if (productSearch && !p.nombre.toLowerCase().includes(productSearch.toLowerCase())) return false
        return p.activa
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base', numeric: true })),
  )

  const cartTotal = $derived(cart.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0))
  // Líneas vendidas a precio de costo y la ganancia que se deja de ganar por ellas.
  const lineasAlCosto = $derived(cart.filter((i) => i.al_costo))
  const perdidaAlCosto = $derived(
    lineasAlCosto.reduce((s, i) => s + (i.precio_lista - i.costo) * i.cantidad, 0),
  )
  const filteredCart = $derived(
    cart.filter((i) => i.nombre.toLowerCase().includes(orderSearch.toLowerCase())),
  )

  const statusLine = $derived(
    $workingCaja
      ? `Trabajando en Caja ${$workingCaja.numero}.`
      : "Selecciona una caja en 'Caja actual' para empezar a vender.",
  )

  function getQty(id: number) {
    return qtys[id] ?? 1
  }
  function changeProductQty(id: number, delta: number) {
    qtys[id] = Math.max(1, normalizeQty(getQty(id)) + delta)
  }
  function setProductQty(id: number, value: string) {
    qtys[id] = normalizeQty(value)
  }

  function addToCart(id: number) {
    if (!$workingCaja) {
      alert("Selecciona una caja en 'Caja actual' para registrar ventas.")
      return
    }
    const prod = productos.find((p) => p.id === id)
    if (!prod) return
    const qty = normalizeQty(getQty(id))
    const existing = cart.find((item) => item.producto_id === id)
    const cartQty = existing ? existing.cantidad : 0
    if (cartQty + qty > prod.stock_actual) {
      stockError = `Stock insuficiente para "${prod.nombre}": disponible ${prod.stock_actual}, en carrito ${cartQty}.`
      return
    }
    stockError = ''
    if (existing) {
      existing.cantidad += qty
    } else {
      cart.push({
        producto_id: id,
        nombre: prod.nombre,
        precio_unitario: prod.precio_venta,
        cantidad: qty,
        es_consignacion: prod.tipo_producto === 'consignacion',
        precio_lista: prod.precio_venta,
        costo: prod.costo,
        al_costo: false,
      })
    }
    qtys[id] = 1
  }

  function changeCartQty(idx: number, delta: number) {
    cart[idx].cantidad = Math.max(1, normalizeQty(cart[idx].cantidad) + delta)
  }
  function setCartQty(idx: number, value: string) {
    cart[idx].cantidad = normalizeQty(value)
  }
  /** Alterna una línea entre precio normal y precio de costo. El cajero no puede
   *  escribir un precio libre: solo elegir entre estos dos. */
  function toggleAlCosto(idx: number, alCosto: boolean) {
    const item = cart[idx]
    item.al_costo = alCosto
    item.precio_unitario = alCosto ? item.costo : item.precio_lista
  }
  function removeFromCart(idx: number) {
    cart.splice(idx, 1)
  }

  function completeSale() {
    if (!cart.length) return
    if (!$workingCaja) {
      alert("Selecciona una caja en 'Caja actual' para registrar ventas.")
      return
    }
    pendingSale = { total: cartTotal, items: cart.slice() }
    openPayment(cartTotal)
  }

  function openPayment(total: number) {
    payTotal = total
    payCash = total.toFixed(2)
    payTransfer = '0.00'
    payError = ''
    payCredito = false
    creditoCliente = ''
    showPayment = true
  }
  function closePayment() {
    pendingSale = null
    showPayment = false
  }
  function closeOrder() {
    showOrder = false
  }

  const assigned = $derived((Number(payCash) || 0) + (Number(payTransfer) || 0))
  const bar = $derived.by(() => {
    const safe = payTotal || 1
    const cw = Math.max(0, Math.min(1, (Number(payCash) || 0) / safe))
    const tw = Math.max(0, Math.min(1, (Number(payTransfer) || 0) / safe))
    const norm = cw + tw || 1
    const pct = (cw / norm) * 100
    return { cash: pct, transfer: (tw / norm) * 100, handle: pct }
  })

  function syncFromCash() {
    if (payCash === '' || payCash.endsWith('.')) return
    const parsed = Number(payCash)
    if (Number.isNaN(parsed)) return
    const clamped = clampMoney(parsed, 0, payTotal)
    if (parsed !== clamped) payCash = clamped.toFixed(2)
    payTransfer = roundMoney(payTotal - clamped).toFixed(2)
  }
  function syncFromTransfer() {
    if (payTransfer === '' || payTransfer.endsWith('.')) return
    const parsed = Number(payTransfer)
    if (Number.isNaN(parsed)) return
    const clamped = clampMoney(parsed, 0, payTotal)
    if (parsed !== clamped) payTransfer = clamped.toFixed(2)
    payCash = roundMoney(payTotal - clamped).toFixed(2)
  }

  function updateFromBar(clientX: number) {
    if (!trackEl || payTotal <= 0) return
    const rect = trackEl.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const step = 10
    const cash = roundMoney(Math.min(payTotal, Math.max(0, Math.round((payTotal * ratio) / step) * step)))
    payCash = cash.toFixed(2)
    payTransfer = roundMoney(payTotal - cash).toFixed(2)
  }
  function onTrackPointerDown(e: PointerEvent) {
    dragging = true
    trackEl?.setPointerCapture(e.pointerId)
    updateFromBar(e.clientX)
  }
  function onTrackPointerMove(e: PointerEvent) {
    if (dragging) updateFromBar(e.clientX)
  }
  function onTrackPointerUp(e: PointerEvent) {
    dragging = false
    trackEl?.releasePointerCapture(e.pointerId)
  }

  async function confirmPayment() {
    if (!pendingSale) {
      closePayment()
      return
    }
    // Sin este cerrojo, un doble toque en "Confirmar venta" registraba la venta
    // dos veces (el botón también queda deshabilitado mientras se envía).
    if (enviandoVenta) return

    const items = pendingSale.items.map((i) => ({
      producto_id: i.producto_id,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
    }))
    if (payCredito && !creditoCliente.trim()) {
      payError = 'Indica el nombre del cliente para la venta a crédito.'
      return
    }
    const cash = Number(payCash) || 0
    const transfer = Number(payTransfer) || 0
    if (!payCredito) {
      const diff = Math.abs(roundMoney(cash + transfer - pendingSale.total))
      if (cash < 0 || transfer < 0 || diff > 0.01) {
        payError = 'Efectivo + transferencia debe coincidir con el total.'
        return
      }
    }

    enviandoVenta = true
    payError = ''
    try {
      if (payCredito) {
        await api.creditos.registrar({ cliente: creditoCliente.trim(), items })
      } else {
        await api.ventas.registrar({
          items,
          subtotal_efectivo: cash,
          subtotal_transferencia: transfer,
        })
      }
    } catch (e) {
      // Antes el fallo se propagaba sin avisar: el modal quedaba abierto, sin
      // mensaje, y el cajero no sabía si la venta había quedado registrada.
      payError = (e as Error).message || 'No se pudo registrar la venta. Intenta de nuevo.'
      return
    } finally {
      enviandoVenta = false
    }

    cart = []
    pendingSale = null
    closePayment()
    closeOrder()
    await refreshData()
  }

  function onBackdrop() {
    if (showPayment) closePayment()
    else if (showOrder) closeOrder()
  }

  $effect(() => {
    const open = showOrder || showPayment
    document.body.classList.toggle('modal-open', open)
    document.documentElement.classList.toggle('modal-open', open)
  })

  onMount(refreshData)
</script>

<div class="page">
  <header class="header">
    <div>
      <h1>Punto de venta</h1>
      <p class="muted">{statusLine}</p>
    </div>
    <div class="header-actions">
      <span class="pill">{$workingCaja ? `Caja ${$workingCaja.numero} · abierta` : 'Sin caja seleccionada'}</span>
    </div>
  </header>

  <main class="layout">
    <section class="panel products-panel">
      <div class="panel-header">
        <div>
          <h2>Productos disponibles</h2>
          <p>Filtra por categoría y busca por nombre. Las consignaciones se marcan en rojo.</p>
        </div>
        <div class="search-box">
          <input
            class="search-input"
            type="search"
            placeholder="Buscar producto..."
            aria-label="Buscar producto"
            bind:value={productSearch}
          />
        </div>
      </div>
      <div class="category-filter">
        <select class="category-select" aria-label="Filtrar por categoría" bind:value={activeCat}>
          {#each catChips as c (c.id)}
            <option value={c.id} style={c.es_consignacion ? 'color: var(--danger)' : ''}>
              {c.nombre}{c.es_consignacion ? ' ◇' : ''}
            </option>
          {/each}
        </select>
      </div>
      {#if stockError}
        <p class="payment-error" role="alert" style="margin: 8px 0;">{stockError}</p>
      {/if}
      <div class="products-grid">
        {#if !filteredProducts.length}
          <div class="empty-state product-empty">
            {$workingCaja
              ? 'No hay productos para este filtro.'
              : "Selecciona una caja en 'Caja actual' para ver sus productos."}
          </div>
        {:else}
          {#each filteredProducts as p (p.id)}
            <article class="product-card" class:consignacion={p.tipo_producto === 'consignacion'}>
              <div class="product-card-top">
                {#if p.imagen}
                  <img class="product-image" src={p.imagen} alt={p.nombre} loading="lazy" />
                {:else}
                  <div class="product-image product-image-placeholder">Sin foto</div>
                {/if}
                <div class="product-info">
                  <h3>{p.nombre}</h3>
                  <div class="muted small">
                    {p.categoria_nombre}{p.tipo_producto === 'consignacion' ? ' · Consignación' : ''}
                  </div>
                  <div class="price">${money(p.precio_venta)}</div>
                  <div class="stock">Stock: {p.stock_actual}</div>
                </div>
              </div>
              <div class="product-actions">
                <div class="qty-control">
                  <button type="button" onclick={() => changeProductQty(p.id, -1)}>-</button>
                  <input
                    class="qty-input"
                    type="number"
                    min="1"
                    step="1"
                    inputmode="numeric"
                    value={getQty(p.id)}
                    onchange={(e) => setProductQty(p.id, e.currentTarget.value)}
                  />
                  <button type="button" onclick={() => changeProductQty(p.id, 1)}>+</button>
                </div>
                <button
                  class="btn-primary"
                  type="button"
                  onclick={() => addToCart(p.id)}
                  disabled={!$workingCaja || p.stock_actual <= 0}
                  title={!$workingCaja ? "Selecciona una caja en 'Caja actual'" : p.stock_actual <= 0 ? 'Sin stock' : ''}>Agregar a venta</button
                >
              </div>
            </article>
          {/each}
        {/if}
      </div>
    </section>

    <section class="panel order-panel">
      <button class="panel-header order-toggle" type="button" onclick={() => (showOrder = true)}>
        <span class="order-toggle-label">Pedido actual</span>
        <span class="order-toggle-icon">▾</span>
      </button>
    </section>
  </main>
</div>

<button
  class="backdrop"
  class:show={showOrder || showPayment}
  aria-label="Cerrar"
  onclick={onBackdrop}
></button>

<!-- Modal pedido -->
<div class="modal" class:show={showOrder}>
  <div class="modal-card">
    <div class="modal-head">
      <div>
        <h2>Pedido actual</h2>
        <p class="muted">Revisa y ajusta los productos agregados.</p>
      </div>
      <button class="btn-outline" type="button" onclick={closeOrder}>Cerrar</button>
    </div>
    <div class="modal-body">
      <div class="order-content-head compact">
        <div class="order-search-wrap">
          <input
            class="order-search"
            type="search"
            placeholder="Buscar en pedido..."
            aria-label="Buscar en pedido"
            bind:value={orderSearch}
          />
        </div>
      </div>
      <div class="cart-list">
        {#if !filteredCart.length}
          <div class="empty-state">No hay productos en el pedido.</div>
        {:else}
          {#each filteredCart as item (item.producto_id)}
            {@const idx = cart.indexOf(item)}
            <div class="cart-card">
              <div class="card-top">
                <div>
                  <strong>{item.nombre}</strong>
                  {#if item.es_consignacion}<span class="muted">Consignación</span>{/if}
                </div>
                <button class="btn-ghost" type="button" onclick={() => removeFromCart(idx)}>Quitar</button>
              </div>
              <div class="cart-line">
                <div class="qty-control">
                  <button type="button" onclick={() => changeCartQty(idx, -1)}>-</button>
                  <input
                    class="qty-input"
                    type="number"
                    min="1"
                    step="1"
                    inputmode="numeric"
                    value={item.cantidad}
                    onchange={(e) => setCartQty(idx, e.currentTarget.value)}
                  />
                  <button type="button" onclick={() => changeCartQty(idx, 1)}>+</button>
                </div>
                <div class="line-price">
                  <label class="costo-toggle" class:activo={item.al_costo}>
                    <input
                      type="checkbox"
                      checked={item.al_costo}
                      onchange={(e) => toggleAlCosto(idx, e.currentTarget.checked)}
                    />
                    A precio de costo
                  </label>
                  <span class="price-shown">
                    Precio: <strong>${money(item.precio_unitario)}</strong>
                    {#if item.al_costo}
                      <span class="costo-badge">costo (normal ${money(item.precio_lista)})</span>
                    {/if}
                  </span>
                  <strong>Total: ${money(item.precio_unitario * item.cantidad)}</strong>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
      <div class="total-box">
        <span>Total</span>
        <span>${money(cartTotal)}</span>
      </div>
      <button class="btn-primary" type="button" onclick={completeSale} disabled={!cart.length}>
        Completar venta
      </button>
    </div>
  </div>
</div>

<!-- Modal pago -->
<div class="modal" class:show={showPayment}>
  <div class="modal-card">
    <div class="modal-head">
      <div>
        <h2>Finalizar pago</h2>
        <p class="muted">Indica el reparto entre efectivo y transferencia.</p>
      </div>
      <button class="btn-outline" type="button" onclick={closePayment}>Cerrar</button>
    </div>
    <div class="modal-body">
      <label class="credit-toggle">
        <input type="checkbox" bind:checked={payCredito} />
        <span>Venta a crédito (libreta) — cobra después</span>
      </label>

      {#if lineasAlCosto.length}
        <div class="costo-resumen">
          <strong>{lineasAlCosto.length} producto(s) a precio de costo</strong>
          <ul>
            {#each lineasAlCosto as l (l.producto_id)}
              <li>{l.nombre} — {l.cantidad} × ${money(l.costo)} (normal ${money(l.precio_lista)})</li>
            {/each}
          </ul>
          <span class="muted">
            Se registrará como pérdida de ganancia: <strong>${money(perdidaAlCosto)}</strong>
          </span>
        </div>
      {/if}

      {#if payCredito}
        <label class="payment-row">
          Cliente
          <input
            class="edit-input"
            type="text"
            maxlength="80"
            placeholder="Nombre del cliente"
            bind:value={creditoCliente}
          />
        </label>
      {:else}
      <div class="payment-bar" aria-hidden="true">
        <div
          class="payment-bar-track"
          role="slider"
          tabindex="0"
          aria-label="Reparto efectivo / transferencia"
          aria-valuemin="0"
          aria-valuemax={payTotal}
          aria-valuenow={Number(payCash) || 0}
          bind:this={trackEl}
          onpointerdown={onTrackPointerDown}
          onpointermove={onTrackPointerMove}
          onpointerup={onTrackPointerUp}
          onpointerleave={() => (dragging = false)}
        >
          <div class="payment-bar-cash" style="width:{bar.cash}%"></div>
          <div class="payment-bar-transfer" style="width:{bar.transfer}%"></div>
          <div class="payment-bar-handle" style="left:{bar.handle}%"></div>
        </div>
        <div class="payment-bar-legend">
          <span>Efectivo</span>
          <span>Transferencia</span>
        </div>
      </div>
      <div class="payment-grid">
        <label class="payment-row">
          Efectivo
          <input
            class="edit-input"
            type="text"
            inputmode="decimal"
            bind:value={payCash}
            oninput={syncFromCash}
          />
        </label>
        <label class="payment-row">
          Transferencia
          <input
            class="edit-input"
            type="text"
            inputmode="decimal"
            bind:value={payTransfer}
            oninput={syncFromTransfer}
          />
        </label>
      </div>
      {/if}
      <div class="payment-summary">
        <span>{payCredito ? 'Total a crédito' : 'Total venta'}</span>
        <strong>${money(payTotal)}</strong>
      </div>
      {#if !payCredito}
        <div class="payment-summary muted">
          <span>Asignado</span>
          <strong>${money(assigned)}</strong>
        </div>
      {/if}
      <div class="payment-error" role="alert">{payError}</div>
      <div class="footer-actions">
        <button class="btn-ghost" type="button" onclick={closePayment} disabled={enviandoVenta}>Cancelar</button>
        <button class="btn-primary" type="button" onclick={confirmPayment} disabled={enviandoVenta}>
          {#if enviandoVenta}
            Registrando…
          {:else}
            {payCredito ? 'Registrar crédito' : 'Confirmar venta'}
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  :global(body.modal-open),
  :global(html.modal-open) {
    overflow: hidden;
    height: 100%;
  }

  .page {
    min-height: calc(100vh - 64px);
    padding: 18px;
    max-width: 1320px;
    margin: 0 auto;
  }

  .header {
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    border-radius: var(--radius-lg);
    padding: 18px 20px;
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
    margin-bottom: 18px;
  }
  .header h1,
  .header p {
    margin: 0;
  }
  .header h1 {
    font-family: var(--font-display);
    font-size: 28px;
  }
  .header > div {
    min-width: 0;
  }
  .header h1 {
    overflow-wrap: anywhere;
  }
  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-shrink: 0;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 700;
    background: var(--bg-accent-1);
    color: var(--primary-strong);
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
    min-height: calc(100vh - 186px);
    padding-bottom: 140px;
  }

  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
    animation: fadeIn var(--duration-base) var(--ease-soft);
    transition:
      transform var(--duration-base) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth);
  }
  .products-panel {
    background: linear-gradient(180deg, rgba(15, 118, 110, 0.06), var(--surface));
    border-color: rgba(15, 118, 110, 0.22);
    box-shadow:
      inset 0 0 0 1px rgba(15, 118, 110, 0.05),
      var(--shadow);
    overflow: visible;
  }
  .order-panel {
    position: fixed;
    left: 18px;
    right: 18px;
    bottom: max(18px, env(safe-area-inset-bottom));
    z-index: 60;
    background: transparent;
    border: 0;
    box-shadow: none;
    overflow: visible;
  }
  .panel:hover {
    transform: translateY(-2px);
    box-shadow: 0 26px 60px rgba(15, 23, 42, 0.12);
  }

  .panel-header {
    padding: 18px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    background: var(--surface-strong);
    position: static;
  }
  .products-panel .panel-header {
    background: var(--surface);
    box-shadow: 0 8px 18px rgba(31, 31, 31, 0.08);
    position: sticky;
    top: 0;
    z-index: 2;
    border-top-left-radius: var(--radius-lg);
    border-top-right-radius: var(--radius-lg);
  }
  .panel-header h2,
  .panel-header p {
    margin: 0;
  }
  .panel-header p {
    color: var(--muted);
    margin-top: 4px;
    font-size: 14px;
  }
  .panel-header > div {
    min-width: 0;
  }

  .search-box {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex: 1;
  }
  .search-input {
    width: min(100%, 320px);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 11px 16px;
    font: inherit;
    background: var(--surface);
    color: var(--text);
    transition:
      border-color var(--duration-base) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth),
      background var(--duration-base) var(--ease-smooth);
  }
  .search-input::placeholder {
    color: var(--muted);
  }
  .search-input:focus-visible {
    outline: none;
    box-shadow: var(--ring);
  }

  .products-grid {
    padding: 18px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 14px;
    align-content: start;
  }

  .product-card,
  .cart-card {
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--surface);
    padding: 16px;
    box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
    transition:
      transform var(--duration-base) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth);
  }
  .product-card:hover,
  .cart-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 32px rgba(15, 23, 42, 0.12);
  }
  .product-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .product-card-top {
    display: grid;
    grid-template-columns: 72px 1fr;
    gap: 12px;
    align-items: center;
  }
  .product-image {
    width: 72px;
    height: 72px;
    border-radius: 16px;
    object-fit: cover;
    background: var(--surface-strong);
    border: 1px solid var(--border);
  }
  .product-info {
    display: grid;
    gap: 4px;
    min-width: 0;
  }
  .product-actions {
    display: grid;
    gap: 10px;
  }
  .product-card h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 18px;
    overflow-wrap: anywhere;
  }
  .product-info .muted.small,
  .product-info .price,
  .product-info .stock {
    overflow-wrap: anywhere;
  }
  .product-card .price {
    color: var(--primary);
    font-weight: 800;
    font-size: 18px;
  }
  .product-card .stock {
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
    margin-top: 4px;
  }
  .product-image-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-size: 11px;
    text-align: center;
  }
  .product-card.consignacion {
    border-color: #d64545;
    background: #fff5f5;
  }
  .product-card.consignacion .price {
    color: #d64545;
  }
  .muted.small {
    font-size: 12px;
  }

  .category-filter {
    display: flex;
    padding: 0 18px 10px;
  }
  .category-select {
    width: min(100%, 280px);
    max-width: 100%;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 14px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    transition:
      border-color var(--duration-base) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth);
  }
  .category-select:hover {
    border-color: var(--primary);
  }
  .category-select:focus-visible {
    outline: none;
    box-shadow: var(--ring);
  }

  .qty-input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 12px;
    font: inherit;
    background: var(--surface-strong);
    color: var(--text);
    text-align: center;
  }
  .line-price {
    display: grid;
    gap: 6px;
    justify-items: end;
  }
  .price-label {
    display: grid;
    gap: 4px;
    font-size: 12px;
    color: var(--muted);
    font-weight: 600;
    justify-items: end;
  }
  /* Selector "a precio de costo": reemplaza el campo de precio libre. */
  .costo-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 999px;
    cursor: pointer;
    background: var(--surface-strong);
    white-space: nowrap;
  }
  .costo-toggle.activo {
    background: #fef9c3;
    color: #854d0e;
    border-color: #facc15;
  }
  .costo-toggle input {
    margin: 0;
  }
  .price-shown {
    font-size: 13px;
    color: var(--muted);
  }
  .costo-badge {
    display: inline-block;
    margin-left: 6px;
    font-size: 11px;
    font-weight: 700;
    color: #854d0e;
    background: #fef9c3;
    border-radius: 999px;
    padding: 2px 8px;
  }
  .costo-resumen {
    border: 1px solid #facc15;
    background: #fefce8;
    color: #854d0e;
    border-radius: 12px;
    padding: 12px 14px;
    margin-bottom: 12px;
    display: grid;
    gap: 6px;
    font-size: 13px;
  }
  .costo-resumen ul {
    margin: 0;
    padding-left: 18px;
  }
  .credit-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface-strong);
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
  }
  .credit-toggle input {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
  .payment-grid {
    display: grid;
    gap: 16px;
  }
  .payment-row {
    display: grid;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
  }
  .payment-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface-strong);
  }
  .payment-summary + .payment-summary {
    margin-top: 4px;
  }
  .payment-bar {
    display: grid;
    gap: 10px;
  }
  .payment-bar-track {
    display: flex;
    width: 100%;
    height: 14px;
    border-radius: 999px;
    background: var(--surface-strong);
    border: 1px solid var(--border);
    overflow: hidden;
    position: relative;
    cursor: pointer;
    touch-action: none;
  }
  .payment-bar-cash {
    background: linear-gradient(135deg, var(--primary), var(--primary-strong));
    width: 50%;
    transition: width var(--duration-base) var(--ease-smooth);
  }
  .payment-bar-transfer {
    background: linear-gradient(135deg, var(--secondary), #fbbf24);
    width: 50%;
    transition: width var(--duration-base) var(--ease-smooth);
  }
  .payment-bar-handle {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--surface);
    border: 2px solid var(--primary-strong);
    transform: translate(-50%, -50%);
    box-shadow: 0 6px 14px rgba(15, 23, 42, 0.16);
    transition: left var(--duration-base) var(--ease-smooth);
    pointer-events: none;
  }
  .payment-bar-legend {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
  }
  .payment-error {
    min-height: 18px;
    color: var(--danger);
    font-weight: 700;
    font-size: 13px;
  }

  .qty-control {
    display: grid;
    grid-template-columns: 40px 1fr 40px;
    gap: 8px;
    align-items: center;
  }
  .qty-control button,
  .btn-primary,
  .btn-ghost,
  .btn-outline {
    border-radius: 12px;
    border: 1px solid transparent;
    cursor: pointer;
    font-weight: 700;
    transition:
      transform var(--duration-fast) var(--ease-smooth),
      background var(--duration-fast) var(--ease-smooth),
      opacity var(--duration-fast) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth);
  }
  .qty-control button:active,
  .btn-primary:active,
  .btn-ghost:active,
  .btn-outline:active {
    transform: translateY(0) scale(0.98);
  }
  .qty-control button {
    height: 40px;
    background: var(--surface-strong);
    color: var(--primary-strong);
    border: 1px solid var(--border);
  }
  .qty-control button:hover {
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
  }
  .btn-primary {
    background: linear-gradient(135deg, var(--primary), var(--primary-strong));
    color: #fff;
    padding: 12px 14px;
    border-color: transparent;
    box-shadow: 0 12px 24px rgba(15, 118, 110, 0.22);
  }
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-outline {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text);
    padding: 11px 14px;
  }
  .btn-ghost {
    background: var(--surface-strong);
    color: var(--text);
    padding: 10px 14px;
    border: 1px solid var(--border);
  }
  .btn-primary:hover,
  .btn-outline:hover,
  .btn-ghost:hover {
    transform: translateY(-1px);
  }

  .order-toggle {
    width: 100%;
    text-align: left;
    border: 0;
    background: linear-gradient(135deg, var(--primary), var(--primary-strong));
    color: #ffffff;
    cursor: pointer;
    border-radius: var(--radius-lg);
    padding: 16px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    box-shadow: 0 16px 30px rgba(212, 138, 0, 0.28);
    transition:
      transform var(--duration-fast) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth);
  }
  .order-toggle-icon {
    font-size: 18px;
    font-weight: 900;
    color: #ffffff;
  }
  .order-toggle-label {
    font-family: var(--font-display);
    font-size: 18px;
    letter-spacing: -0.2px;
  }
  .order-toggle:hover {
    transform: translateY(-1px);
    box-shadow: 0 20px 36px rgba(212, 138, 0, 0.32);
  }
  .order-toggle:focus-visible {
    outline: none;
    box-shadow: var(--ring);
  }

  .order-content-head {
    display: grid;
    gap: 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .order-content-head.compact {
    padding-top: 6px;
  }
  .order-search-wrap {
    display: flex;
  }
  .order-search {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 8px 12px;
    font: inherit;
    font-size: 13px;
    background: var(--surface-strong);
    color: var(--text);
  }
  .order-search:focus-visible {
    outline: none;
    box-shadow: var(--ring);
  }

  .cart-list {
    display: grid;
    gap: 12px;
  }
  .cart-card {
    display: grid;
    gap: 12px;
  }
  .card-top {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }
  .card-top > div {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .muted {
    color: var(--muted);
  }
  .cart-line {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
  }
  .total-box {
    margin-top: 4px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    font-size: 20px;
    font-weight: 900;
  }
  .empty-state {
    padding: 30px 18px;
    text-align: center;
    color: var(--muted);
    border: 1px dashed var(--border);
    border-radius: 18px;
    background: var(--surface-strong);
  }
  .product-empty {
    grid-column: 1 / -1;
  }

  .modal,
  .backdrop {
    position: fixed;
    inset: 0;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition:
      opacity var(--duration-base) var(--ease-smooth),
      visibility var(--duration-base) var(--ease-smooth);
  }
  .modal.show,
  .backdrop.show {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }
  .backdrop {
    background: rgba(2, 6, 23, 0.68);
    z-index: 60;
    border: 0;
    padding: 0;
    width: 100%;
    cursor: default;
  }
  .modal {
    z-index: 70;
    overflow: auto;
    padding: 24px;
  }
  .modal-card {
    max-width: 980px;
    margin: 48px auto;
    background: var(--surface);
    border-radius: 28px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    overflow: hidden;
    transform: translateY(14px) scale(0.985);
    transition: transform var(--duration-slow) var(--ease-soft);
  }
  .modal.show .modal-card {
    transform: translateY(0) scale(1);
  }
  .modal-head {
    padding: 20px 22px;
    background: var(--surface-strong);
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }
  .modal-head h2 {
    margin: 0;
    font-family: var(--font-display);
  }
  .modal-body {
    padding: 26px 26px 28px;
    display: grid;
    gap: 16px;
  }
  .footer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 10px;
  }
  .edit-input {
    width: 100%;
    border-radius: 12px;
    border: 1px solid var(--border);
    padding: 10px 12px;
    font: inherit;
    background: var(--surface-strong);
    color: var(--text);
  }
  .edit-input:focus-visible,
  .qty-input:focus-visible {
    outline: none;
    box-shadow: var(--ring);
  }

  @media (max-width: 1080px) {
    .layout {
      grid-template-columns: 1fr;
      min-height: auto;
      padding-bottom: 128px;
    }
  }
  @media (max-width: 760px) {
    .page {
      padding: 10px;
    }
    .header {
      padding: 14px;
      border-radius: 14px;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 22px;
    }
    .header,
    .panel-header,
    .card-top {
      flex-direction: column;
      align-items: flex-start;
    }
    /* En móvil el encabezado no debe quedar fijo: si no, el buscador flota
       superpuesto sobre los productos al hacer scroll. Que fluya normal,
       con el buscador debajo del título "Productos disponibles". */
    .products-panel .panel-header {
      position: static;
    }
    /* .cart-line es grid: se apila cambiando a una columna, no con flex-direction. */
    .cart-line {
      grid-template-columns: 1fr;
      gap: 14px;
    }
    .line-price {
      justify-items: stretch;
      width: 100%;
    }
    .price-label {
      justify-items: start;
    }
    .costo-toggle {
      width: 100%;
      justify-content: center;
    }
    .search-box {
      width: 100%;
      justify-content: stretch;
      margin-top: 8px;
    }
    .search-input {
      width: 100%;
      max-width: none;
    }
    .order-panel {
      left: 10px;
      right: 10px;
      bottom: max(10px, env(safe-area-inset-bottom));
    }
    .product-card-top {
      grid-template-columns: 64px 1fr;
    }
    .product-image {
      width: 64px;
      height: 64px;
      border-radius: 14px;
    }
    .order-toggle {
      border-radius: 16px;
      padding: 12px 14px;
    }
    .order-toggle-label {
      font-size: 16px;
    }
    .product-card,
    .cart-card {
      border-radius: 14px;
    }
    .total-box {
      margin-top: 0;
      padding-top: 8px;
      font-size: 16px;
    }
    .layout {
      padding-bottom: 112px;
    }
    .panel-header,
    .products-grid,
    .modal-body,
    .modal-head {
      padding: 12px;
    }
    .products-grid {
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 10px;
    }
    .product-card h3 {
      font-size: 15px;
    }
    .qty-control {
      grid-template-columns: 36px 1fr 36px;
      gap: 6px;
    }
    .btn-primary,
    .btn-ghost,
    .btn-outline {
      width: 100%;
      min-height: 44px;
    }
    .qty-control button {
      min-height: 44px;
    }
    .modal {
      padding: 10px;
    }
    .modal-card {
      margin: 0;
      max-width: 100%;
      border-radius: 14px;
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
</style>
