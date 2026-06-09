function loadView(fileName, button) {
    const frame = document.getElementById('viewer-frame');
    const buttons = document.querySelectorAll('.nav-tab');

    frame.src = fileName;
    buttons.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
}

// ── Indicador de sincronización ──────────────────────────────────────────────
(function () {
    const badge = document.getElementById('sync-badge');
    if (!badge) return;

    const LABELS = {
        synced:  '⬤ Online',
        online:  '⬤ Online',
        syncing: '↻ Sincronizando…',
        offline: '⬤ Sin conexión',
        partial: '⚠ Pendiente',
    };

    function update({ status, pending = 0, synced = 0 }) {
        badge.className = 'sync-badge status-' + (status || 'synced');
        let label = LABELS[status] || '⬤ Online';
        if (status === 'offline' && pending > 0)  label = `⬤ Sin conexión (${pending})`;
        if (status === 'partial')                  label = `⚠ ${pending} pendiente${pending !== 1 ? 's' : ''}`;
        if (status === 'syncing')                  label = `↻ Sincronizando (${pending})`;
        badge.textContent = label;
    }

    // Eventos del iframe hijo via CustomEvent bubbling
    window.addEventListener('vef:sync-status', e => update(e.detail));

    // BroadcastChannel (por si el SW o el iframe emiten)
    if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel('vef-sync');
        ch.onmessage = e => update(e.data);
    }

    // Estado inicial basado en navigator.onLine
    update({ status: navigator.onLine ? 'synced' : 'offline' });
    window.addEventListener('online',  () => update({ status: 'synced' }));
    window.addEventListener('offline', () => update({ status: 'offline' }));
})();