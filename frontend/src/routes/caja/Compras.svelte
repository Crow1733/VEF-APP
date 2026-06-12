<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '../../lib/api'
  import { workingCaja } from '../../lib/stores'
  import { formatDateTime } from '../../lib/format'
  import type { Compra, Producto } from '../../lib/types'

  const money = (v: number | string) =>
    new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(Number(v) || 0)

  interface ItemRow {
    producto_id: number | ''
    cantidad: number | null
    costo_unitario: number | null
  }

  let productosCache = $state<Producto[]>([])
  let compras = $state<Compra[]>([])
  let items = $state<ItemRow[]>([])

  let procedencia = $state('')
  let metodo = $state('efectivo')
  let descuenta = $state(true)
  let obs = $state('')

  const comprables = $derived(productosCache.filter((p) => p.tipo_producto !== 'consignacion'))
  const total = $derived(
    items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.costo_unitario) || 0), 0),
  )
  const historico = $derived(compras.slice().sort((a, b) => b.id - a.id))

  function emptyRow(): ItemRow {
    return { producto_id: comprables[0]?.id ?? '', cantidad: 1, costo_unitario: 0 }
  }
  function addItem() {
    items.push(emptyRow())
  }
  function removeItem(idx: number) {
    items.splice(idx, 1)
  }

  async function refresh() {
    productosCache = await api.productos.listar()
    compras = await api.compras.listar()
    if (!items.length) items.push(emptyRow())
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    const valid = items.filter(
      (i) => i.producto_id && Number(i.cantidad) > 0 && Number(i.costo_unitario) >= 0,
    )
    if (!valid.length) {
      alert('Agrega al menos un item válido.')
      return
    }
    await api.compras.registrar({
      procedencia: procedencia.trim(),
      metodo_pago: metodo,
      descuenta_fondo: descuenta,
      observacion: obs.trim(),
      items: valid.map((i) => ({
        producto_id: Number(i.producto_id),
        cantidad: Number(i.cantidad),
        costo_unitario: Number(i.costo_unitario),
      })),
    })
    items = []
    procedencia = ''
    metodo = 'efectivo'
    descuenta = true
    obs = ''
    await refresh()
  }

  onMount(refresh)
</script>

<div class="page">
  <header class="header">
    <div>
      <h1>Compras de mercancía</h1>
      <p class="muted">
        Las compras descuentan del fondo de caja y reponen stock. No son gasto operativo.
      </p>
    </div>
    <span class="pill">{$workingCaja ? `Caja ${$workingCaja.numero} abierta` : 'Sin caja seleccionada'}</span>
  </header>

  <main class="layout single">
    <section class="panel">
      <div class="panel-header"><h2>Nueva compra</h2></div>
      <form class="cierre-form" onsubmit={submit}>
        <label>
          Procedencia (texto libre)
          <input type="text" placeholder="Ej: mayorista del centro" bind:value={procedencia} />
        </label>
        <label>
          Método de pago
          <select bind:value={metodo}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </label>
        <label class="inline-row">
          <input type="checkbox" bind:checked={descuenta} />
          Descuenta del fondo de caja
        </label>
        <label>
          Observación
          <input type="text" bind:value={obs} />
        </label>

        <div class="cp-items">
          {#each items as item, idx (idx)}
            <div class="desglose-card">
              <label>
                Producto
                <select bind:value={item.producto_id}>
                  {#each comprables as p (p.id)}
                    <option value={p.id}>{p.nombre} (stock {p.stock_actual})</option>
                  {/each}
                </select>
              </label>
              <label>
                Cantidad
                <input type="number" min="1" step="1" bind:value={item.cantidad} />
              </label>
              <label>
                Costo unitario
                <input type="number" min="0" step="0.01" bind:value={item.costo_unitario} />
              </label>
              <div>
                <button type="button" class="btn-ghost" onclick={() => removeItem(idx)}>Quitar item</button>
              </div>
            </div>
          {/each}
        </div>

        <div>
          <button type="button" class="btn-outline" onclick={addItem}>+ Agregar item</button>
        </div>
        <div class="total-box">
          <span>Total</span>
          <span>${money(total)}</span>
        </div>
        <div>
          <button class="btn-primary" type="submit">Registrar compra</button>
        </div>
      </form>
    </section>

    <section class="panel">
      <div class="panel-header"><h2>Historial de compras</h2></div>
      <div class="list">
        {#if !historico.length}
          <div class="empty-state">Sin compras registradas.</div>
        {:else}
          {#each historico as c (c.id)}
            <article class="history-card">
              <div class="sale-card-header">
                <div>
                  <strong>Compra #{c.id}</strong>
                  <span class="muted">{formatDateTime(c.fecha)}</span>
                </div>
                <span class="pill">${money(c.total)}</span>
              </div>
              <div class="meta">
                <span>Procedencia: {c.procedencia || '-'}</span>
                <span>Método: {c.metodo_pago}</span>
                <span>{c.descuenta_fondo ? 'Descuenta del fondo' : 'No descuenta del fondo'}</span>
              </div>
              <div class="muted">
                {#each c.items as i, k (i.id ?? k)}
                  · {i.producto_nombre} × {i.cantidad} a ${money(i.costo_unitario)}<br />
                {/each}
              </div>
              {#if c.observacion}<div class="muted">{c.observacion}</div>{/if}
            </article>
          {/each}
        {/if}
      </div>
    </section>
  </main>
</div>

<style>
  .page {
    min-height: calc(100vh - 64px);
    padding: 18px;
    max-width: 1320px;
    margin: 0 auto;
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
  .muted {
    color: var(--muted);
  }
  .pill {
    display: inline-flex;
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 700;
    background: var(--bg-accent-1);
    color: var(--primary-strong);
  }

  .layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: fadeIn var(--duration-base) var(--ease-soft);
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
  .panel-header h2 {
    margin: 0;
    font-family: var(--font-display);
  }

  .btn-primary,
  .btn-outline,
  .btn-ghost {
    border: 1px solid transparent;
    border-radius: 14px;
    padding: 11px 14px;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    transition:
      transform var(--duration-fast) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth);
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
  .btn-ghost {
    background: var(--surface-strong);
    color: var(--text);
    border: 1px solid var(--border);
  }
  .btn-primary:hover,
  .btn-outline:hover,
  .btn-ghost:hover {
    transform: translateY(-1px);
  }

  input,
  select {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px;
    font: inherit;
    background: var(--surface);
    color: var(--text);
  }
  select {
    /* Evita que un nombre de producto largo ensanche el select y desborde la tarjeta. */
    text-overflow: ellipsis;
  }
  input:focus-visible,
  select:focus-visible {
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

  /* cierre.css base */
  .cierre-form {
    display: grid;
    gap: 12px;
    padding: 16px;
  }
  .cierre-form label {
    display: grid;
    gap: 4px;
    font-weight: 600;
  }
  .cp-items {
    display: grid;
    gap: 12px;
  }
  .desglose-card {
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
    padding: 14px;
    display: grid;
    gap: 8px;
  }
  .inline-row {
    display: flex !important;
    flex-direction: row !important;
    align-items: center;
    gap: 8px;
  }
  .inline-row input[type='checkbox'] {
    width: auto;
    margin: 0;
  }
  .total-box {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    font-weight: 700;
  }
  .list {
    padding: 16px;
    display: grid;
    gap: 12px;
  }
  .history-card {
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 14px;
    background: var(--surface);
    display: grid;
    gap: 6px;
  }
  .history-card .meta {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    color: var(--muted);
    font-size: 13px;
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
  .pill {
    flex-shrink: 0;
  }
  .desglose-card {
    min-width: 0;
  }

  @media (max-width: 760px) {
    .page {
      padding: 10px;
    }
    .header {
      padding: 14px;
      border-radius: 14px;
      margin-bottom: 12px;
      flex-direction: column;
      align-items: flex-start;
    }
    .header h1 {
      font-size: 22px;
    }
    .cierre-form .btn-primary,
    .cierre-form .btn-outline,
    .cierre-form .btn-ghost {
      width: 100%;
      min-height: 44px;
    }
    .sale-card-header {
      flex-direction: column;
      align-items: flex-start;
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
