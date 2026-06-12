<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { api } from '../../lib/api'
  import { workingCaja } from '../../lib/stores'
  import { formatDateTime } from '../../lib/format'
  import type { Caja, CajaEstado, Desglose } from '../../lib/types'

  const money = (v: number | string) =>
    new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(Number(v) || 0)

  let estado = $state<CajaEstado[]>([])

  // Modal: abrir caja
  let openNumero = $state<number | null>(null)
  let aperturaEfectivo = $state<number | null>(50000)

  // Modal: detalle + cierre de una caja abierta
  let detail = $state<Caja | null>(null)
  let desglose = $state<Desglose | null>(null)
  let cierreContado = $state<number | null>(null)
  let cierreObs = $state('')
  let confirmCierre = $state(false)

  async function refresh() {
    estado = await api.cajas.estado()
    // Sincroniza la caja de trabajo con el estado real (por si la cerraron).
    const wc = get(workingCaja)
    if (wc) {
      const found = estado.find((e) => e.caja?.id === wc.id)
      workingCaja.set(found?.caja ?? null)
    }
  }

  async function trabajar(caja: Caja) {
    workingCaja.set(caja)
    detail = caja
    desglose = await api.cajas.desgloseEfectivo(caja.id)
    cierreContado = desglose.efectivo_esperado
    cierreObs = ''
  }

  function pedirApertura(numero: number) {
    openNumero = numero
    aperturaEfectivo = 50000
  }

  async function abrir(e: SubmitEvent) {
    e.preventDefault()
    if (openNumero == null) return
    try {
      const caja = await api.cajas.abrir(openNumero, Number(aperturaEfectivo) || 0)
      openNumero = null
      workingCaja.set(caja)
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo abrir la caja.')
      await refresh()
    }
  }

  async function reabrir(caja: Caja) {
    try {
      const abierta = await api.cajas.reabrir(caja.id)
      workingCaja.set(abierta)
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo reabrir la caja.')
      await refresh()
    }
  }

  function pedirCierre(e: SubmitEvent) {
    e.preventDefault()
    confirmCierre = true
  }

  async function cerrar() {
    if (!detail) return
    const contado = Number(cierreContado) || 0
    const result = await api.cajas.cerrar(detail.id, contado, cierreObs.trim())
    if (result) {
      const diff = result.caja.diferencia ?? 0
      if (Math.abs(diff) >= 1) {
        alert(`Caja cerrada. Diferencia: $${money(diff)} ${diff < 0 ? '(faltante)' : '(sobrante)'}`)
      }
    }
    if (get(workingCaja)?.id === detail.id) workingCaja.set(null)
    confirmCierre = false
    detail = null
    desglose = null
    await refresh()
  }

  $effect(() => {
    document.body.classList.toggle('modal-open', openNumero != null || !!detail || confirmCierre)
  })

  onMount(refresh)
</script>

<div class="page">
  <header class="header">
    <div>
      <h1>Caja actual</h1>
      <p class="muted">Elige en qué registradora vas a trabajar. Cada caja se abre una vez al día (se puede reabrir si hace falta) y se cierra sola a medianoche.</p>
    </div>
  </header>

  <!-- Cuadro de caja de trabajo -->
  <div class="work-box" class:active={$workingCaja}>
    {#if $workingCaja}
      <span class="dot"></span>
      <div>
        Trabajando en <strong>Caja {$workingCaja.numero}</strong>
        <div class="muted">
          Abrió {$workingCaja.abierta_por || '—'} · ${money($workingCaja.efectivo_inicial)} ·
          {formatDateTime($workingCaja.fecha_apertura)}
        </div>
      </div>
    {:else}
      <strong>Selecciona una caja para trabajar</strong>
    {/if}
  </div>

  <!-- Las 3 registradoras -->
  <div class="cajas-grid">
    {#each estado as e (e.numero)}
      {#if e.abierta && e.caja}
        {@const c = e.caja}
        <button
          class="caja-card abierta"
          class:trabajando={$workingCaja?.id === c.id}
          type="button"
          onclick={() => trabajar(c)}
        >
          <div class="caja-card-head">
            <h3>{e.nombre}</h3>
            <span class="estado abierta">Abierta</span>
          </div>
          <div class="caja-info">
            <div>Abierta con <strong>${money(c.efectivo_inicial)}</strong></div>
            <div>Hora: <strong>{formatDateTime(c.fecha_apertura)}</strong></div>
            <div>Por: <strong>{c.abierta_por || '—'}</strong></div>
          </div>
          <span class="caja-action">
            {$workingCaja?.id === c.id ? 'Ver / cerrar' : 'Trabajar aquí'}
          </span>
        </button>
      {:else if e.caja_hoy}
        {@const h = e.caja_hoy}
        <button class="caja-card cerrada" type="button" onclick={() => reabrir(h)}>
          <div class="caja-card-head">
            <h3>{e.nombre}</h3>
            <span class="estado abrir">Reabrir</span>
          </div>
          <div class="caja-info">
            <div>Abrió <strong>{h.abierta_por || '—'}</strong> con <strong>${money(h.efectivo_inicial)}</strong></div>
            <div>Cerrada: <strong>{formatDateTime(h.fecha_cierre)}</strong></div>
            {#if h.observacion}<div>{h.observacion}</div>{/if}
          </div>
          <p class="muted">Ya se abrió hoy. Pulsa para reabrir el turno.</p>
          <span class="caja-action abrir">Reabrir caja</span>
        </button>
      {:else}
        <button class="caja-card cerrada" type="button" onclick={() => pedirApertura(e.numero)}>
          <div class="caja-card-head">
            <h3>{e.nombre}</h3>
            <span class="estado abrir">Abrir</span>
          </div>
          <p class="muted">Cerrada. Pulsa para abrirla.</p>
          <span class="caja-action abrir">Abrir caja</span>
        </button>
      {/if}
    {/each}
  </div>
</div>

<!-- Modal: abrir caja -->
<button class="backdrop" class:show={openNumero != null} aria-label="Cerrar" onclick={() => (openNumero = null)}></button>
<div class="modal" class:show={openNumero != null}>
  {#if openNumero != null}
    <div class="modal-card big">
      <div class="modal-head">
        <h2>Abriendo caja {openNumero}</h2>
        <button class="btn-outline" type="button" onclick={() => (openNumero = null)}>Cerrar</button>
      </div>
      <div class="modal-body">
        <form class="cierre-form" onsubmit={abrir}>
          <label>
            Efectivo inicial
            <input type="number" min="0" step="0.01" bind:value={aperturaEfectivo} required />
          </label>
          <div class="footer-actions">
            <button class="btn-soft" type="button" onclick={() => (openNumero = null)}>Cancelar</button>
            <button class="btn-primary" type="submit">Abrir caja {openNumero}</button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<!-- Modal: detalle + cierre -->
<button class="backdrop" class:show={detail} aria-label="Cerrar" onclick={() => (detail = null)}></button>
<div class="modal" class:show={detail}>
  {#if detail && desglose}
    <div class="modal-card">
      <div class="modal-head">
        <div>
          <h2>Caja {detail.numero}</h2>
          <p class="muted">Abierta el {formatDateTime(detail.fecha_apertura)} por {detail.abierta_por || '—'}</p>
        </div>
        <button class="btn-outline" type="button" onclick={() => (detail = null)}>Cerrar</button>
      </div>
      <div class="modal-body">
        <div class="desglose-grid">
          <div class="desglose-card"><div class="label">Efectivo inicial</div><div class="value">${money(desglose.efectivo_inicial)}</div></div>
          <div class="desglose-card entry"><div class="label">+ Ventas efectivo</div><div class="value">${money(desglose.ventas_efectivo)}</div></div>
          <div class="desglose-card"><div class="label">Ventas transferencia</div><div class="value">${money(desglose.ventas_transferencia)}</div></div>
          <div class="desglose-card exit"><div class="label">− Extracciones</div><div class="value">${money(desglose.extracciones)}</div></div>
          <div class="desglose-card exit"><div class="label">− Compras mercancía</div><div class="value">${money(desglose.compras_mercancia)}</div></div>
          <div class="desglose-card exit"><div class="label">− Pagos varios</div><div class="value">${money(desglose.pagos_varios)}</div></div>
          <div class="desglose-card total"><div class="label">= Efectivo esperado</div><div class="value">${money(desglose.efectivo_esperado)}</div></div>
        </div>
        <form class="cierre-form" onsubmit={pedirCierre}>
          <label>
            Efectivo contado al cierre
            <input type="number" min="0" step="0.01" bind:value={cierreContado} />
          </label>
          <label>
            Observación
            <input type="text" placeholder="Ej: diferencia por vuelto" bind:value={cierreObs} />
          </label>
          <div class="footer-actions">
            <button class="btn-danger" type="submit">Cerrar caja {detail.numero}</button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<!-- Modal: confirmar cierre -->
<button class="backdrop confirm-layer" class:show={confirmCierre} aria-label="Cerrar" onclick={() => (confirmCierre = false)}></button>
<div class="modal confirm-layer" class:show={confirmCierre}>
  {#if confirmCierre && detail && desglose}
    <div class="modal-card big">
      <div class="modal-body">
        <div class="confirm-box">
          <h2>¿Cerrar la Caja {detail.numero}?</h2>
          <p class="muted">
            Efectivo esperado <strong>${money(desglose.efectivo_esperado)}</strong> · contado
            <strong>${money(Number(cierreContado) || 0)}</strong>. Se cerrará el turno de esta caja.
          </p>
          <div class="footer-actions">
            <button class="btn-soft" type="button" onclick={() => (confirmCierre = false)}>Cancelar</button>
            <button class="btn-success" type="button" onclick={cerrar}>Sí, cerrar caja {detail.numero}</button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(body.modal-open) {
    overflow: hidden;
  }

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

  .work-box {
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px dashed var(--border);
    background: var(--surface-strong);
    border-radius: var(--radius-md);
    padding: 16px 18px;
    margin-bottom: 18px;
    font-size: 16px;
    color: var(--muted);
  }
  .work-box.active {
    border-style: solid;
    border-color: var(--success);
    background: rgba(47, 158, 68, 0.08);
    color: var(--text);
  }
  .work-box .dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: var(--success);
    flex-shrink: 0;
  }

  .cajas-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
    margin-bottom: 18px;
  }
  .caja-card {
    text-align: left;
    cursor: pointer;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow);
    padding: 18px;
    display: grid;
    gap: 12px;
    font: inherit;
    color: var(--text);
    transition:
      transform var(--duration-fast) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth),
      border-color var(--duration-base) var(--ease-smooth);
  }
  .caja-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 22px 40px rgba(15, 23, 42, 0.14);
  }
  .caja-card:focus-visible {
    outline: none;
    box-shadow: var(--ring);
  }
  .caja-card.abierta {
    border-color: rgba(47, 158, 68, 0.5);
  }
  .caja-card.trabajando {
    border-color: var(--success);
    box-shadow: 0 0 0 2px rgba(47, 158, 68, 0.35);
  }
  .caja-card-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .caja-card-head h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 20px;
  }
  .estado {
    font-weight: 800;
    font-size: 14px;
  }
  .estado.abierta {
    color: var(--success);
  }
  .estado.abrir {
    color: var(--danger);
  }
  .caja-info {
    display: grid;
    gap: 4px;
    font-size: 14px;
    color: var(--muted);
  }
  .caja-info strong {
    color: var(--text);
  }
  .caja-action {
    justify-self: start;
    border-radius: 12px;
    padding: 8px 14px;
    font-weight: 700;
    font-size: 14px;
    background: linear-gradient(135deg, var(--primary), var(--primary-strong));
    color: #fff;
  }
  .caja-action.abrir {
    background: linear-gradient(135deg, var(--danger), #ef4444);
  }

  /* Formularios */
  .cierre-form {
    display: grid;
    gap: 12px;
  }
  .cierre-form label {
    display: grid;
    gap: 4px;
    font-weight: 600;
  }
  input {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px;
    font: inherit;
    background: var(--surface);
    color: var(--text);
    width: 100%;
  }
  input:focus-visible {
    outline: none;
    box-shadow: var(--ring);
  }
  .desglose-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }
  .desglose-card {
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface-strong);
    padding: 14px;
    display: grid;
    gap: 4px;
  }
  .desglose-card .label {
    font-size: 12px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .desglose-card .value {
    font-size: 20px;
    font-weight: 700;
  }
  .desglose-card.entry .value {
    color: var(--success);
  }
  .desglose-card.exit .value {
    color: var(--danger);
  }
  .desglose-card.total .value {
    color: var(--primary);
  }

  .btn-primary,
  .btn-danger,
  .btn-outline,
  .btn-soft,
  .btn-success {
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
  }
  .btn-danger {
    background: linear-gradient(135deg, var(--danger), #ef4444);
    color: #fff;
  }
  .btn-success {
    background: linear-gradient(135deg, var(--success), #37b24d);
    color: #fff;
    box-shadow: 0 12px 24px rgba(47, 158, 68, 0.24);
  }
  .btn-outline {
    background: transparent;
    border-color: var(--border);
    color: var(--text);
  }
  .btn-soft {
    background: var(--surface-strong);
    border-color: var(--border);
    color: var(--text);
  }
  .btn-primary:hover,
  .btn-danger:hover,
  .btn-outline:hover,
  .btn-soft:hover,
  .btn-success:hover {
    transform: translateY(-1px);
  }

  .confirm-box {
    padding: 24px;
    display: grid;
    gap: 14px;
  }
  .confirm-box h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 24px;
  }
  .confirm-box p {
    margin: 0;
    line-height: 1.6;
  }
  .footer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  /* Modales */
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
  /* El modal de confirmación va por encima del de detalle. */
  .backdrop.confirm-layer {
    z-index: 85;
  }
  .modal.confirm-layer {
    z-index: 90;
  }
  .modal-card {
    max-width: 720px;
    margin: 34px auto;
    background: var(--surface);
    border-radius: 24px;
    box-shadow: var(--shadow);
    border: 1px solid var(--border);
    overflow: hidden;
    animation: modalIn var(--duration-base) var(--ease-soft);
  }
  .modal-card.big {
    max-width: 520px;
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
    gap: 16px;
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
    .modal {
      padding: 10px;
    }
    .modal-card,
    .modal-card.big {
      margin: 0;
      max-width: 100%;
      border-radius: 14px;
    }
    .footer-actions .btn-primary,
    .footer-actions .btn-danger,
    .footer-actions .btn-soft,
    .footer-actions .btn-success {
      width: 100%;
      min-height: 44px;
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
