const CACHE = 'vef-v2';

const STATIC = [
    '/',
    '/index.html',
    '/login/login.html',
    '/login/login.css',
    '/login/login.js',
    '/Administrador/administrador-manager.html',
    '/Administrador/css/administrador.css',
    '/Administrador/js/administrador.js',
    '/Caja/caja-manager.html',
    '/Caja/css/global.css',
    '/Caja/css/caja.css',
    '/Caja/css/ventas.css',
    '/Caja/css/cierre.css',
    '/Caja/vista-caja.html',
    '/Caja/vista-ventas.html',
    '/Caja/vista-cierre.html',
    '/Caja/vista-compras.html',
    '/Caja/js/global.js',
    '/Caja/js/caja.js',
    '/Caja/js/ventas.js',
    '/Caja/js/cierre.js',
    '/Caja/js/compras.js',
    '/js/offline-db.js',
    '/js/sync-manager.js',
    '/js/api.js',
    '/js/auth-guard.js',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/manifest.json',
];

// ── Instalación: cachea todos los assets estáticos ─────────────────────────
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(STATIC))
            .then(() => self.skipWaiting())
    );
});

// ── Activación: limpia cachés viejas ───────────────────────────────────────
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// ── Fetch: red para /api/, caché para el resto ─────────────────────────────
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // Llamadas API → siempre red (nunca cachear datos dinámicos)
    if (url.pathname.startsWith('/api/')) {
        e.respondWith(fetch(e.request));
        return;
    }

    // Assets estáticos → caché primero, red de respaldo
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(res => {
                if (res && res.status === 200 && res.type !== 'opaque') {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return res;
            }).catch(() => caches.match('/login/login.html'));
        })
    );
});

// ── Background Sync: procesa el outbox cuando el navegador recupera red ────
self.addEventListener('sync', e => {
    if (e.tag === 'vef-sync-ops') {
        e.waitUntil(syncOutboxFromSW());
    }
});

async function syncOutboxFromSW() {
    // Abre IndexedDB directamente desde el SW
    const db = await openDB();
    const ops = await getAllOutbox(db);
    if (!ops.length) return;

    for (const op of ops) {
        let url;
        if      (op.op === 'venta')      url = '/api/ventas';
        else if (op.op === 'extraccion') url = '/api/movimientos/extraccion';
        else if (op.op === 'pago')       url = '/api/movimientos/pago';
        else { await delOutbox(db, op.id); continue; }

        try {
            const res = await fetch(url, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(op.payload),
            });
            if (res.ok || (res.status >= 400 && res.status < 500)) {
                await delOutbox(db, op.id);
            }
        } catch (_) {
            // Sigue con la siguiente; la cola persiste
        }
    }

    // Notifica a todos los clientes abiertos
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => c.postMessage({ type: 'SW_SYNC_COMPLETE' }));
}

// ── IndexedDB helpers mínimos para el SW ───────────────────────────────────
function openDB() {
    return new Promise((res, rej) => {
        const r = indexedDB.open('vef-offline', 1);
        r.onsuccess = e => res(e.target.result);
        r.onerror   = () => rej(r.error);
        r.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('outbox')) {
                db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

function getAllOutbox(db) {
    return new Promise((res, rej) => {
        const r = db.transaction('outbox', 'readonly').objectStore('outbox').getAll();
        r.onsuccess = () => res(r.result);
        r.onerror   = () => rej(r.error);
    });
}

function delOutbox(db, id) {
    return new Promise((res, rej) => {
        const r = db.transaction('outbox', 'readwrite').objectStore('outbox').delete(id);
        r.onsuccess = () => res();
        r.onerror   = () => rej(r.error);
    });
}
