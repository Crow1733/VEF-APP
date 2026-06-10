<script lang="ts">
  import { onMount } from 'svelte'
  import { guard, logout } from '../lib/auth'
  import { syncState } from '../lib/stores'
  import POS from './caja/POS.svelte'
  import Operaciones from './caja/Operaciones.svelte'
  import CajaActual from './caja/CajaActual.svelte'
  import Compras from './caja/Compras.svelte'

  type View = 'pos' | 'cierre' | 'operaciones' | 'compras'
  let view = $state<View>('pos')
  let ok = $state(false)

  onMount(() => {
    ok = guard(['cajero'])
  })

  const badge = $derived.by(() => {
    const { status, pending } = $syncState
    let label = '⬤ Online'
    if (status === 'syncing') label = `↻ Sincronizando (${pending})`
    else if (status === 'offline') label = pending > 0 ? `⬤ Sin conexión (${pending})` : '⬤ Sin conexión'
    else if (status === 'partial') label = `⚠ ${pending} pendiente${pending !== 1 ? 's' : ''}`
    const cls = 'status-' + (status === 'online' ? 'synced' : status)
    return { label, cls }
  })

  const TABS: { id: View; label: string }[] = [
    { id: 'pos', label: 'Punto de venta' },
    { id: 'cierre', label: 'Caja actual' },
    { id: 'operaciones', label: 'Operaciones' },
    { id: 'compras', label: 'Compras' },
  ]
</script>

{#if ok}
  <div class="caja-shell">
    <div class="topbar">
      {#each TABS as t (t.id)}
        <button class="nav-tab" class:active={view === t.id} type="button" onclick={() => (view = t.id)}>
          {t.label}
        </button>
      {/each}
      <span class="sync-badge {badge.cls}" title="Estado de sincronización">{badge.label}</span>
      <button class="nav-tab logout" type="button" onclick={logout}>Cerrar sesión</button>
    </div>

    {#if view === 'pos'}
      <POS />
    {:else if view === 'cierre'}
      <CajaActual />
    {:else if view === 'operaciones'}
      <Operaciones />
    {:else if view === 'compras'}
      <Compras />
    {/if}
  </div>
{/if}

<style>
  .caja-shell {
    min-height: 100vh;
    background:
      radial-gradient(circle at 12% 10%, var(--bg-accent-1), transparent 38%),
      radial-gradient(circle at 88% 0%, var(--bg-accent-2), transparent 34%),
      var(--bg);
  }

  .topbar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 14px;
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--surface);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
    animation: slideDown var(--duration-base) var(--ease-soft);
  }

  .sync-badge {
    margin-left: auto;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 10px;
    border-radius: 999px;
    white-space: nowrap;
    border: 1px solid transparent;
    transition:
      background var(--duration-base),
      color var(--duration-base);
    cursor: default;
    user-select: none;
    align-self: center;
  }
  .sync-badge.status-synced {
    background: rgba(47, 158, 68, 0.14);
    color: #2f9e44;
    border-color: rgba(47, 158, 68, 0.25);
  }
  .sync-badge.status-offline {
    background: rgba(214, 69, 69, 0.14);
    color: #d64545;
    border-color: rgba(214, 69, 69, 0.25);
  }
  .sync-badge.status-syncing {
    background: rgba(244, 180, 0, 0.18);
    color: var(--primary-strong, #d48a00);
    border-color: rgba(244, 180, 0, 0.3);
    animation: pulse-badge 1s ease-in-out infinite;
  }
  .sync-badge.status-partial {
    background: rgba(244, 180, 0, 0.18);
    color: var(--primary-strong, #d48a00);
    border-color: rgba(244, 180, 0, 0.3);
  }
  @keyframes pulse-badge {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.55;
    }
  }

  .nav-tab {
    border: 1px solid var(--border);
    background: var(--surface-strong);
    color: var(--text);
    border-radius: 14px;
    padding: 12px 16px;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    white-space: nowrap;
    transition:
      transform var(--duration-fast) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth),
      background var(--duration-base) var(--ease-smooth),
      color var(--duration-base) var(--ease-smooth);
  }
  .nav-tab:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
  }
  .nav-tab:active {
    transform: translateY(0) scale(0.98);
  }
  .nav-tab.active {
    background: linear-gradient(135deg, var(--primary), var(--primary-strong));
    border-color: transparent;
    color: #ffffff;
  }
  .nav-tab.logout {
    background: linear-gradient(135deg, var(--danger), #ef4444);
    border-color: transparent;
    color: #ffffff;
  }
  .nav-tab:focus-visible {
    outline: none;
    box-shadow: var(--ring);
  }

  @media (max-width: 720px) {
    .topbar {
      padding: 10px;
      gap: 8px;
    }
    .nav-tab.logout {
      margin-left: 0;
      width: 100%;
      order: 99;
    }
    .nav-tab {
      flex: 1;
      min-width: 0;
      text-align: center;
      padding: 10px 8px;
      font-size: 13px;
      white-space: normal;
      overflow-wrap: break-word;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
  @media (max-width: 1024px) {
    .topbar {
      padding: 10px 12px;
      gap: 8px;
    }
    .nav-tab {
      padding: 10px 12px;
      font-size: 14px;
    }
  }
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
