/**
 * Tabla de rutas para svelte-spa-router (routing por hash, óptimo para PWA
 * offline: las rutas resuelven sin pedir nada al servidor).
 */
import type { Component } from 'svelte'
import Login from './routes/Login.svelte'
import Admin from './routes/Admin.svelte'
import Caja from './routes/Caja.svelte'

export const routes: Record<string, Component> = {
  '/': Login,
  '/login': Login,
  '/admin': Admin,
  '/caja': Caja,
  '*': Login,
}
