<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { replace } from 'svelte-spa-router'
  import { api } from '../lib/api'
  import { login, session } from '../lib/auth'

  let usuario = $state('')
  let clave = $state('')
  let error = $state('')
  let busy = $state(false)

  onMount(() => {
    // Si ya hay sesión, ir directo al home del rol.
    const s = get(session)
    if (s && s.home) replace(s.home)
  })

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault()
    error = ''
    if (!usuario.trim() || !clave) {
      error = 'Completa usuario y contraseña.'
      return
    }
    busy = true
    try {
      const user = await api.usuarios.autenticar(usuario.trim(), clave)
      if (!user) {
        error = 'Credenciales inválidas.'
        return
      }
      const s = login(user)
      replace(s.home)
    } catch {
      error = 'No se pudo validar el usuario.'
    } finally {
      busy = false
    }
  }
</script>

<div class="login-page">
  <div class="page">
    <header class="hero">
      <span class="chip">Acceso seguro</span>
      <h1>Sistema VEF</h1>
      <p>Inicia sesión para abrir el panel correspondiente a tu rol.</p>
    </header>

    <main class="card">
      <div class="card-head">
        <h2>Iniciar sesión</h2>
      </div>
      <form class="form" onsubmit={onSubmit}>
        <label>
          Usuario
          <input type="text" autocomplete="username" bind:value={usuario} required />
        </label>
        <label>
          Contraseña
          <input type="password" autocomplete="current-password" bind:value={clave} required />
        </label>
        <button class="btn" type="submit" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <div class="error" role="alert">{error}</div>
      </form>
    </main>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 24px;
    background:
      radial-gradient(circle at 10% 15%, var(--bg-accent-1), transparent 46%),
      radial-gradient(circle at 90% 5%, var(--bg-accent-2), transparent 40%),
      var(--bg);
  }

  .page {
    width: min(980px, 100%);
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
    gap: 24px;
    align-items: center;
  }

  .hero {
    display: grid;
    gap: 12px;
    padding: 22px;
    border-radius: var(--radius-lg);
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    transition:
      transform var(--duration-base) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth);
  }

  .hero:hover {
    transform: translateY(-2px);
    box-shadow: 0 26px 70px rgba(15, 23, 42, 0.16);
  }

  .hero h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 34px;
    letter-spacing: -0.5px;
  }

  .hero p {
    margin: 0;
    color: var(--muted);
    line-height: 1.6;
  }

  .chip {
    width: fit-content;
    padding: 6px 14px;
    border-radius: 999px;
    background: var(--bg-accent-1);
    color: var(--primary-strong);
    font-weight: 700;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow);
    display: grid;
    gap: 18px;
    animation: riseIn var(--duration-slow) var(--ease-soft);
    transition:
      transform var(--duration-base) var(--ease-smooth),
      box-shadow var(--duration-base) var(--ease-smooth);
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 26px 70px rgba(15, 23, 42, 0.16);
  }

  .card-head h2 {
    margin: 0 0 6px;
    font-family: var(--font-display);
    font-size: 24px;
  }

  .form {
    display: grid;
    gap: 12px;
  }

  .error {
    min-height: 18px;
    color: var(--danger);
    font-weight: 700;
    font-size: 13px;
  }

  @keyframes riseIn {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 840px) {
    .login-page {
      padding: 16px;
    }
    .page {
      grid-template-columns: 1fr;
    }
    .hero {
      padding: 18px;
      border-radius: var(--radius-md);
    }
    .card {
      border-radius: var(--radius-md);
    }
  }
</style>
