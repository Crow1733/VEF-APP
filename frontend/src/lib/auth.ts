/**
 * Sesión y guardas de ruta. Port de auth-guard.js + la parte de sesión de
 * login.js. La sesión vive en localStorage (clave `appSession`) y además en
 * un store reactivo para que la UI reaccione a login/logout.
 */
import { writable } from 'svelte/store'
import { replace } from 'svelte-spa-router'
import type { Rol, Session } from './types'

const SESSION_KEY = 'appSession'

/** Ruta-home por rol (en el router por hash, sin extensión .html). */
export const ROLE_HOME: Record<Rol, string> = {
  admin: '/admin',
  cajero: '/caja',
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data && typeof data === 'object' ? (data as Session) : null
  } catch {
    return null
  }
}

export const session = writable<Session | null>(readSession())

export function login(user: { id: number; usuario: string; rol: Rol; nombre: string }): Session {
  const role: Rol = user.rol === 'admin' ? 'admin' : 'cajero'
  const data: Session = {
    id: user.id,
    username: user.usuario,
    role,
    displayName: user.nombre,
    home: ROLE_HOME[role],
    loggedAt: new Date().toISOString(),
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(data))
  session.set(data)
  return data
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY)
  session.set(null)
  replace('/login')
}

/**
 * Guarda de ruta para svelte-spa-router. Devuelve true si el usuario actual
 * puede acceder; si no, redirige (a /login o a su propio home) y devuelve false.
 */
export function guard(roles: Rol[]): boolean {
  const s = readSession()
  if (!s) {
    replace('/login')
    return false
  }
  if (roles.length && !roles.includes(s.role)) {
    replace(s.home || '/login')
    return false
  }
  return true
}
