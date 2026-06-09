/**
 * VEF Sync Manager
 * - Detecta online/offline
 * - Procesa la cola (outbox) cuando hay conexión
 * - Emite eventos de estado vía BroadcastChannel y CustomEvent
 * - Expone: window.vefSync
 */
(function () {
    const ch = typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('vef-sync') : null;

    // ── Emitir estado al topbar del frame padre ────────────────────────────
    function emit(status, extra = {}) {
        const detail = { status, ...extra };
        if (ch) ch.postMessage(detail);
        window.dispatchEvent(new CustomEvent('vef:sync-status', { detail }));
        // También notifica al frame padre si estamos en un iframe
        try {
            if (window.parent !== window)
                window.parent.dispatchEvent(new CustomEvent('vef:sync-status', { detail }));
        } catch (_) {}
    }

    // ── Procesar la cola de operaciones pendientes ─────────────────────────
    let _syncing = false;

    async function processOutbox() {
        if (_syncing) return;
        _syncing = true;

        const ops = await window.vefDB.getAllOutbox().catch(() => []);
        if (!ops.length) {
            emit('synced', { pending: 0 });
            _syncing = false;
            return;
        }

        emit('syncing', { pending: ops.length });

        let synced = 0;
        for (const op of ops) {
            try {
                let url, body;
                if      (op.op === 'venta')      { url = '/api/ventas';                      body = op.payload; }
                else if (op.op === 'extraccion') { url = '/api/movimientos/extraccion';      body = op.payload; }
                else if (op.op === 'pago')       { url = '/api/movimientos/pago';            body = op.payload; }
                else { await window.vefDB.delOutbox(op.id); synced++; continue; }

                const res = await fetch(url, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(body),
                });

                if (res.ok) {
                    await window.vefDB.delOutbox(op.id);
                    synced++;
                } else {
                    // Error de servidor (400/422/etc) — la op es inválida, descartar
                    if (res.status >= 400 && res.status < 500) {
                        await window.vefDB.delOutbox(op.id);
                    }
                    // 5xx: dejar en cola, intentar en próximo ciclo
                }
            } catch {
                // Error de red: seguimos para ver si las siguientes van
                // (puede que solo falle una)
            }
        }

        const remaining = await window.vefDB.countOutbox().catch(() => 0);

        // Refresca productos desde el servidor para stock autoritativo
        if (synced > 0) {
            try {
                const prods = await fetch('/api/productos').then(r => r.json());
                await window.vefDB.putAll('productos', prods);
            } catch (_) {}
        }

        emit(remaining === 0 ? 'synced' : 'partial', { pending: remaining, synced });

        if (synced > 0)
            window.dispatchEvent(new CustomEvent('vef:sync-complete', { detail: { synced } }));

        _syncing = false;
    }

    // ── Online / Offline ───────────────────────────────────────────────────
    window.addEventListener('online', async () => {
        const pending = await window.vefDB.countOutbox().catch(() => 0);
        emit('online', { pending });
        setTimeout(processOutbox, 600);
    });

    window.addEventListener('offline', async () => {
        const pending = await window.vefDB.countOutbox().catch(() => 0);
        emit('offline', { pending });
    });

    // ── Estado inicial ─────────────────────────────────────────────────────
    (async () => {
        const pending = await window.vefDB.countOutbox().catch(() => 0);
        if (navigator.onLine) {
            if (pending > 0) setTimeout(processOutbox, 1200);
            else emit('synced', { pending: 0 });
        } else {
            emit('offline', { pending });
        }
    })();

    // ── Chequeo periódico cada 30 s ────────────────────────────────────────
    setInterval(async () => {
        if (!navigator.onLine) return;
        const pending = await window.vefDB.countOutbox().catch(() => 0);
        if (pending > 0) processOutbox();
    }, 30_000);

    // ── Background Sync (donde esté disponible) ────────────────────────────
    if ('serviceWorker' in navigator) {
        window.addEventListener('vef:queue-op', async () => {
            try {
                const reg = await navigator.serviceWorker.ready;
                if ('sync' in reg) reg.sync.register('vef-sync-ops');
            } catch (_) {}
        });
    }

    // Mensaje del Service Worker cuando termina un sync en background
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', e => {
            if (e.data?.type === 'SW_SYNC_COMPLETE') {
                window.dispatchEvent(new CustomEvent('vef:sync-complete', { detail: { synced: true } }));
                processOutbox();
            }
        });
    }

    window.vefSync = { processOutbox };
})();
