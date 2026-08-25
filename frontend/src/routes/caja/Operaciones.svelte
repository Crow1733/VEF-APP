<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { api } from '../../lib/api'
  import { session } from '../../lib/auth'
  import { workingCaja } from '../../lib/stores'
  import { formatDateTime, TIPO_PAGO_LABELS } from '../../lib/format'
  import type { Movimiento, Venta, Baja, Producto } from '../../lib/types'

  const money = (v: number | string) =>
    new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(Number(v) || 0)

  type Section = 'active' | 'canceled' | 'withdrawals' | 'bajas'

  const RAZONES: { value: string; label: string }[] = [
    { value: 'merma', label: 'Merma' },
    { value: 'rotura', label: 'Rotura' },
    { value: 'vencimiento', label: 'Vencimiento' },
    { value: 'robo', label: 'Robo' },
    { value: 'otro', label: 'Otro' },
  ]

  let ventas = $state<Venta[]>([])
  let withdrawals = $state<Movimiento[]>([])
  let activeSection = $state<Section>('active')
  let salesSearch = $state('')

  // Modales
  let saleModal = $state<{ venta: Venta; source: Section } | null>(null)
  let cancelId = $state<number | null>(null)
  let bajaConfirmId = $state<number | null>(null)

  // Form extracción
  let wAmount = $state<number | null>(null)
  let wNote = $state('')
  let wError = $state('')

  // Bajas / mermas
  let bajasList = $state<Baja[]>([])
  let productos = $state<Producto[]>([])
  let bProductoId = $state<number | null>(null)
  let bCantidad = $state<number | null>(null)
  let bRazon = $state('merma')
  let bNota = $state('')
  let bError = $state('')

  async function refresh() {
    const wc = $workingCaja
    if (wc) {
      ventas = await api.ventas.listarPorCaja(wc.id)
      const movs = await api.movimientos.listar(wc.id)
      withdrawals = movs.filter((m) => m.es_extraccion)
    } else {
      ventas = []
      withdrawals = []
    }
    productos = (await api.productos.listar()).filter((p) => p.activa)
    bajasList = await api.bajas.listar()
  }

  async function submitBaja(e: SubmitEvent) {
    e.preventDefault()
    const pid = Number(bProductoId) || 0
    const cant = Number(bCantidad) || 0
    if (!pid) {
      bError = 'Selecciona un producto.'
      return
    }
    if (cant <= 0) {
      bError = 'Ingresa una cantidad válida.'
      return
    }
    await api.bajas.registrar({
      producto_id: pid,
      cantidad: cant,
      razon: bRazon,
      observacion: bNota.trim(),
    })
    bProductoId = null
    bCantidad = null
    bRazon = 'merma'
    bNota = ''
    bError = ''
    await refresh()
  }

  async function confirmDeleteBaja() {
    if (bajaConfirmId == null) return
    await api.bajas.eliminar(bajaConfirmId)
    bajaConfirmId = null
    await refresh()
  }

  function matches(v: Venta, term: string) {
    if (!term) return true
    const text = [
      v.id,
      v.total,
      formatDateTime(v.fecha),
      ...v.items.map((i) => i.producto_nombre || ''),
      TIPO_PAGO_LABELS[v.tipo_pago],
    ]
      .join(' ')
      .toLowerCase()
    return text.includes(term.toLowerCase())
  }

  const activas = $derived(ventas.filter((v) => v.estado !== 'cancelada' && matches(v, salesSearch)))
  const canceladas = $derived(ventas.filter((v) => v.estado === 'cancelada' && matches(v, salesSearch)))

  async function confirmCancel() {
    if (cancelId == null) return
    await api.ventas.cancelar(cancelId)
    cancelId = null
    saleModal = null
    await refresh()
  }

  async function registerWithdrawal(e: SubmitEvent) {
    e.preventDefault()
    const amount = Number(wAmount) || 0
    if (Number.isNaN(amount) || amount <= 0) {
      wError = 'Ingresa un monto válido.'
      return
    }
    if (!$workingCaja) {
      wError = "No hay caja seleccionada. Ve a 'Caja actual'."
      return
    }
    const s = get(session)
    const res = await api.movimientos.registrarExtraccion({
      monto: amount,
      concepto: wNote.trim() || 'Extracción de caja',
      responsable: s?.displayName || s?.username || null,
    })
    if (!res.ok) {
      wError = 'No se pudo registrar la extracción.'
      return
    }
    wAmount = null
    wNote = ''
    wError = ''
    await refresh()
  }

  $effect(() => {
    document.body.classList.toggle('modal-open', !!(saleModal || cancelId != null || bajaConfirmId != null))
  })

  onMount(refresh)
</script>

<div class="page">
  <header class="header">
    <div>
      <h1>Operaciones</h1>
      <p class="muted">Ventas registradas, canceladas y extracciones del turno.</p>
    </div>
    <span class="pill">{$workingCaja ? `Caja ${$workingCaja.numero} abierta` : 'Sin caja seleccionada'}</span>
  </header>

  <div class="op-tabs">
    {#each [['active', 'Ventas realizadas'], ['canceled', 'Ventas canceladas'], ['withdrawals', 'Extracciones directas'], ['bajas', 'Bajas / mermas']] as [s, label] (s)}
      <button
        class="op-tab"
        class:active={activeSection === s}
        type="button"
        onclick={() => (activeSection = s as Section)}>{label}</button
      >
    {/each}
  </div>

  <main class="layout">
    {#if activeSection === 'active'}
      <section class="panel op-section active">
        <div class="panel-header">
          <div><h2>Ventas realizadas</h2></div>
          <div class="search-box">
            <input
              class="search-input"
              type="search"
              placeholder="Buscar por id, producto o monto"
              aria-label="Buscar ventas"
              bind:value={salesSearch}
            />
          </div>
        </div>
        <div class="list">
          {#if !activas.length}
            <div class="empty-state">No hay ventas activas en esta caja.</div>
          {:else}
            {#each activas as v (v.id)}
              <article class="sale-card">
                <div class="sale-card-header">
                  <div>
                    <strong>Venta #{v.numero_dia ?? v.id}</strong>
                    <span class="muted">{formatDateTime(v.fecha)}</span>
                  </div>
                  <span class="pill">${money(v.total)}</span>
                </div>
                <div class="muted">
                  {v.items.length} producto(s) · {TIPO_PAGO_LABELS[v.tipo_pago] || v.tipo_pago} · Efectivo
                  ${money(v.subtotal_efectivo)} · Transf. ${money(v.subtotal_transferencia)}
                  {#if v.es_consignacion}· <span class="pill danger">Consignación</span>{/if}
                </div>
                <button class="btn-outline" type="button" onclick={() => (saleModal = { venta: v, source: 'active' })}>
                  Detalles
                </button>
              </article>
            {/each}
          {/if}
        </div>
      </section>
    {/if}

    {#if activeSection === 'canceled'}
      <section class="panel op-section active">
        <div class="panel-header">
          <div><h2>Ventas canceladas</h2></div>
          <span class="pill danger">Canceladas</span>
        </div>
        <div class="list">
          {#if !canceladas.length}
            <div class="empty-state">No hay ventas canceladas.</div>
          {:else}
            {#each canceladas as v (v.id)}
              <article class="sale-card">
                <div class="sale-card-header">
                  <div>
                    <strong>Venta #{v.numero_dia ?? v.id}</strong>
                    <span class="muted">{formatDateTime(v.fecha)}</span>
                  </div>
                  <span class="pill danger">${money(v.total)}</span>
                </div>
                <div class="muted">
                  {v.items.length} producto(s) · {TIPO_PAGO_LABELS[v.tipo_pago] || v.tipo_pago} · Efectivo
                  ${money(v.subtotal_efectivo)} · Transf. ${money(v.subtotal_transferencia)}
                  {#if v.es_consignacion}· <span class="pill danger">Consignación</span>{/if}
                </div>
                <button class="btn-outline" type="button" onclick={() => (saleModal = { venta: v, source: 'canceled' })}>
                  Detalles
                </button>
              </article>
            {/each}
          {/if}
        </div>
      </section>
    {/if}

    {#if activeSection === 'withdrawals'}
      <section class="panel op-section active">
        <div class="panel-header">
          <div>
            <h2>Extracciones directas</h2>
            <p class="muted">Retiros de caja del turno actual.</p>
          </div>
        </div>
        <div class="list">
          <form class="withdrawal-form" onsubmit={registerWithdrawal}>
            <label>
              Monto
              <input class="edit-input" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" bind:value={wAmount} />
            </label>
            <label>
              Motivo (opcional)
              <input class="edit-input" type="text" maxlength="120" placeholder="Ej: retiro propietario" bind:value={wNote} />
            </label>
            <div class="withdrawal-actions">
              <button class="btn-primary" type="submit">Registrar extracción</button>
            </div>
            <div class="form-error" role="alert">{wError}</div>
          </form>
          <div class="withdrawal-list">
            {#if !$workingCaja}
              <div class="empty-state">
                No hay caja seleccionada. Elige una en 'Caja actual' para registrar extracciones.
              </div>
            {:else if !withdrawals.length}
              <div class="empty-state">Sin extracciones en esta caja.</div>
            {:else}
              {#each withdrawals as m (m.id)}
                <article class="sale-card">
                  <div class="sale-card-header">
                    <div>
                      <strong>{formatDateTime(m.fecha)}</strong>
                      <span class="muted">{m.responsable || 'Caja'}</span>
                    </div>
                    <span class="pill">${money(m.monto)}</span>
                  </div>
                  <div class="muted">{m.concepto}</div>
                </article>
              {/each}
            {/if}
          </div>
        </div>
      </section>
    {/if}

    {#if activeSection === 'bajas'}
      <section class="panel op-section active">
        <div class="panel-header">
          <div>
            <h2>Bajas / mermas</h2>
            <p class="muted">Roturas, pérdidas o retiros que descuentan stock.</p>
          </div>
        </div>
        <div class="list">
          <form class="withdrawal-form" onsubmit={submitBaja}>
            <label>
              Producto
              <select class="edit-input" bind:value={bProductoId}>
                <option value={null} disabled selected>Selecciona un producto…</option>
                {#each productos as p (p.id)}
                  <option value={p.id}>{p.nombre} (stock {p.stock_actual})</option>
                {/each}
              </select>
            </label>
            <label>
              Cantidad
              <input class="edit-input" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" bind:value={bCantidad} />
            </label>
            <label>
              Razón
              <select class="edit-input" bind:value={bRazon}>
                {#each RAZONES as r (r.value)}
                  <option value={r.value}>{r.label}</option>
                {/each}
              </select>
            </label>
            <label>
              Observación (opcional)
              <input class="edit-input" type="text" maxlength="120" placeholder="Detalle de la baja" bind:value={bNota} />
            </label>
            <div class="withdrawal-actions">
              <button class="btn-primary" type="submit">Registrar baja</button>
            </div>
            <div class="form-error" role="alert">{bError}</div>
          </form>
          <div class="withdrawal-list">
            {#if !bajasList.length}
              <div class="empty-state">Sin bajas registradas.</div>
            {:else}
              {#each bajasList as b (b.id)}
                <article class="sale-card">
                  <div class="sale-card-header">
                    <div>
                      <strong>{b.producto_nombre || `Producto #${b.producto_id}`}</strong>
                      <span class="muted">{formatDateTime(b.fecha)}</span>
                    </div>
                    <span class="pill danger">-{b.cantidad}</span>
                  </div>
                  <div class="muted">
                    {b.razon}{b.observacion ? ` · ${b.observacion}` : ''}
                  </div>
                  {#if typeof b.id === 'number'}
                    <button class="btn-outline" type="button" onclick={() => (bajaConfirmId = b.id!)}>Eliminar (restaura stock)</button>
                  {/if}
                </article>
              {/each}
            {/if}
          </div>
        </div>
      </section>
    {/if}
  </main>
</div>

<button class="backdrop" class:show={saleModal || cancelId != null || bajaConfirmId != null} aria-label="Cerrar" onclick={() => { saleModal = null; cancelId = null; bajaConfirmId = null }}></button>

<!-- Modal detalle de venta -->
<div class="modal" class:show={saleModal}>
  {#if saleModal}
    {@const sale = saleModal.venta}
    <div class="modal-card">
      <div class="modal-head">
        <div>
          <h2>Venta #{sale.numero_dia ?? sale.id}</h2>
          <p class="muted">{formatDateTime(sale.fecha)} · Total ${money(sale.total)}</p>
        </div>
        <button class="btn-outline" type="button" onclick={() => (saleModal = null)}>Cerrar</button>
      </div>
      <div class="modal-body">
        <div class="product-item">
          <div>Tipo de pago: <strong>{TIPO_PAGO_LABELS[sale.tipo_pago] || sale.tipo_pago}</strong></div>
          <div>Efectivo: <strong>${money(sale.subtotal_efectivo)}</strong></div>
          <div>Transferencia: <strong>${money(sale.subtotal_transferencia)}</strong></div>
        </div>
        <div class="sale-list">
          {#each sale.items as item (item.id)}
            <div class="product-item">
              <div class="product-item-head">
                <strong>{item.producto_nombre}</strong>
                {#if item.es_consignacion}<span class="pill danger">Consignación</span>{/if}
              </div>
              <div class="detail-row">
                <div>
                  <div class="muted">Cantidad: {item.cantidad}</div>
                  <div class="muted">Unitario: ${money(item.precio_unitario)}</div>
                </div>
                <strong>${money(item.subtotal)}</strong>
              </div>
            </div>
          {/each}
        </div>
        {#if saleModal.source === 'active'}
          <div class="detail-actions">
            <button class="btn-danger" type="button" onclick={() => (cancelId = Number(sale.id))}>Cancelar venta</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<!-- Modal confirmación de eliminación de baja -->
<div class="modal" class:show={bajaConfirmId != null}>
  <div class="modal-card big">
    <div class="modal-body">
      <div class="confirm-box">
        <h2>¿Eliminar esta baja?</h2>
        <p class="muted" style="line-height:1.6;">
          Se eliminará el registro y se restaurará el stock del producto.
        </p>
        <div class="detail-actions" style="margin-top:18px; justify-content:flex-end;">
          <button class="btn-soft" type="button" onclick={() => (bajaConfirmId = null)}>Cancelar</button>
          <button class="btn-danger" type="button" onclick={confirmDeleteBaja}>Sí, eliminar</button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Modal confirmación de cancelación -->
<div class="modal" class:show={cancelId != null}>
  <div class="modal-card big">
    <div class="modal-body">
      <div class="confirm-box">
        <div class="pill danger" style="margin-bottom:12px;">Acción irreversible</div>
        <h2>¿Cancelar esta venta?</h2>
        <p class="muted" style="line-height:1.6;">
          La venta #{cancelId} pasará al listado de canceladas y se devolverá el stock.
        </p>
        <div class="detail-actions" style="margin-top:18px; justify-content:flex-end;">
          <button class="btn-soft" type="button" onclick={() => (cancelId = null)}>No, volver</button>
          <button class="btn-danger" type="button" onclick={confirmCancel}>Sí, cancelar venta</button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  :global(body.modal-open) {
    overflow: hidden;
  }

  .page {
    min-height: calc(100vh - 64px);
    padding: 18px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    padding: 18px 20px;
    margin-bottom: 18px;
  }
  .header h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 28px;
    overflow-wrap: anywhere;
  }
  .header p {
    margin: 0;
  }
  .header > div {
    min-width: 0;
  }
  .pill {
    flex-shrink: 0;
  }

  .layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 18px;
    min-height: calc(100vh - 234px);
  }

  .op-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 18px;
  }
  .op-tab {
    border: 1px solid var(--border);
    background: var(--surface-strong);
    color: var(--text);
    border-radius: 999px;
    padding: 10px 16px;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    transition:
      transform var(--duration-fast) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth),
      background var(--duration-base) var(--ease-smooth),
      color var(--duration-base) var(--ease-smooth);
  }
  .op-tab:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 20px rgba(31, 31, 31, 0.12);
  }
  .op-tab.active {
    background: linear-gradient(135deg, var(--primary), var(--primary-strong));
    color: #ffffff;
    border-color: transparent;
    box-shadow: 0 12px 24px rgba(212, 138, 0, 0.28);
  }
  .op-tab:focus-visible {
    outline: none;
    box-shadow: var(--ring);
  }

  .op-section {
    animation: fadeIn var(--duration-base) var(--ease-soft);
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
  .panel:hover {
    transform: translateY(-2px);
    box-shadow: 0 26px 60px rgba(15, 23, 42, 0.12);
  }
  .panel-header {
    padding: 18px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-strong);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .panel-header > div {
    min-width: 0;
  }
  .panel-header h2 {
    margin: 0;
    font-family: var(--font-display);
  }
  .panel-header p {
    margin: 0;
  }

  .search-box {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex: 1;
  }
  .search-input {
    width: min(100%, 360px);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 11px 16px;
    font: inherit;
    background: var(--surface);
    color: var(--text);
  }
  .search-input::placeholder {
    color: var(--muted);
  }
  .search-input:focus-visible {
    outline: none;
    box-shadow: var(--ring);
  }

  .list {
    padding: 18px 20px 20px;
    overflow: auto;
    display: grid;
    gap: 12px;
  }
  .withdrawal-form {
    display: grid;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--surface-strong);
  }
  .withdrawal-form label {
    display: grid;
    gap: 6px;
    font-weight: 600;
    font-size: 14px;
  }
  .withdrawal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .withdrawal-list {
    display: grid;
    gap: 10px;
  }
  .form-error {
    min-height: 18px;
    color: var(--danger);
    font-weight: 700;
    font-size: 13px;
  }

  .sale-card {
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 16px;
    background: var(--surface);
    display: grid;
    gap: 12px;
    box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
    transition:
      transform var(--duration-base) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth);
  }
  .sale-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 32px rgba(15, 23, 42, 0.12);
  }
  .sale-card-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }
  .sale-card-header > div {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .muted {
    color: var(--muted);
  }
  .pill {
    display: inline-flex;
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 700;
    background: var(--bg-accent-1);
    color: var(--primary-strong);
  }
  .pill.danger {
    background: rgba(220, 38, 38, 0.16);
    color: var(--danger);
  }

  .btn-primary,
  .btn-outline,
  .btn-danger,
  .btn-soft {
    border: 0;
    border-radius: 14px;
    padding: 11px 14px;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    transition:
      transform var(--duration-fast) var(--ease-smooth),
      opacity var(--duration-fast) var(--ease-smooth),
      background var(--duration-fast) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth);
  }
  .btn-primary:active,
  .btn-outline:active,
  .btn-danger:active,
  .btn-soft:active {
    transform: translateY(0) scale(0.98);
  }
  .btn-primary {
    background: linear-gradient(135deg, var(--primary), var(--primary-strong));
    color: #fff;
    box-shadow: 0 12px 24px rgba(15, 118, 110, 0.22);
  }
  .btn-outline {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
  }
  .btn-danger {
    background: linear-gradient(135deg, var(--danger), #ef4444);
    color: #fff;
  }
  .btn-soft {
    background: var(--surface-strong);
    color: var(--text);
    border: 1px solid var(--border);
  }
  .btn-primary:hover,
  .btn-outline:hover,
  .btn-danger:hover,
  .btn-soft:hover {
    transform: translateY(-1px);
  }

  .sale-list {
    display: grid;
    gap: 10px;
  }
  .detail-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    border: 1px solid var(--border);
    background: var(--surface-strong);
    border-radius: 16px;
    padding: 13px;
  }
  .detail-row > div {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .modal,
  .backdrop {
    position: fixed;
    inset: 0;
    display: none;
  }
  .modal.show,
  .backdrop.show {
    display: block;
  }
  .backdrop {
    background: rgba(2, 6, 23, 0.66);
    z-index: 70;
    border: 0;
    padding: 0;
    width: 100%;
    cursor: default;
  }
  .modal {
    z-index: 80;
    overflow: auto;
    padding: 22px;
  }
  .modal-card {
    max-width: 980px;
    margin: 34px auto;
    background: var(--surface);
    border-radius: 28px;
    box-shadow: var(--shadow);
    border: 1px solid var(--border);
    overflow: hidden;
    animation: modalIn var(--duration-base) var(--ease-soft);
  }
  .modal-card.big {
    max-width: 760px;
  }
  .modal-head {
    padding: 20px 22px;
    background: var(--surface-strong);
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .modal-head h2 {
    margin: 0;
    font-family: var(--font-display);
  }
  .modal-head p {
    margin: 0;
  }
  .modal-body {
    padding: 20px 22px 22px;
    display: grid;
    gap: 14px;
  }
  .product-item {
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 14px;
    background: var(--surface-strong);
    display: grid;
    gap: 8px;
  }
  .product-item-head {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
  }
  .product-item-head strong {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .detail-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .confirm-box {
    padding: 24px;
    border-radius: 24px;
    border: 1px solid rgba(245, 158, 11, 0.28);
    background: linear-gradient(180deg, rgba(245, 158, 11, 0.14), var(--surface));
  }
  .confirm-box h2 {
    margin: 0 0 10px;
    font-size: 30px;
    font-family: var(--font-display);
  }
  .edit-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    font: inherit;
    background: var(--surface-strong);
    color: var(--text);
  }
  .edit-input:focus-visible {
    outline: none;
    box-shadow: var(--ring);
  }
  .empty-state {
    padding: 24px;
    border: 1px dashed var(--border);
    border-radius: 18px;
    color: var(--muted);
    background: var(--surface-strong);
    text-align: center;
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
    .sale-card-header,
    .product-item-head {
      flex-direction: column;
      align-items: flex-start;
    }
    /* .detail-row es grid: se apila pasando a una sola columna. */
    .detail-row {
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .panel,
    .sale-card,
    .product-item,
    .empty-state,
    .confirm-box {
      border-radius: 14px;
    }
    .search-box {
      width: 100%;
      justify-content: stretch;
    }
    .search-input {
      width: 100%;
    }
    .panel-header,
    .list,
    .modal-head,
    .modal-body {
      padding: 12px;
    }
    .detail-actions {
      width: 100%;
    }
    .op-tab {
      flex: 1 1 auto;
      min-height: 44px;
      text-align: center;
    }
    .modal {
      padding: 10px;
    }
    .modal-card,
    .modal-card.big {
      margin: 0;
      max-width: 100%;
      border-radius: 14px;
    }
    .confirm-box h2 {
      font-size: 24px;
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
