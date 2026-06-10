import { mount } from 'svelte'
import { registerSW } from 'virtual:pwa-register'
import './app.css'
import App from './App.svelte'
import { initSync } from './lib/sync'

// Registra el service worker (PWA). En dev queda inactivo (devOptions.enabled=false).
registerSW({ immediate: true })

// Arranca la detección online/offline y el procesado del outbox.
initSync()

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
