let cajaActual = null;
let ventas = [];
let activeSection = 'active';
let salesSearchTerm = '';
let pendingCancelId = null;

const TIPO_PAGO_LABELS = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    mixto: 'Mixto'
};

function money(v) {
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(Number(v) || 0);
}

function formatDateTime(v) {
    if (!v) return '-';
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v));
}

function readSession() {
    try {
        const raw = localStorage.getItem('appSession');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

async function refresh() {
    cajaActual = await window.api.cajas.actual();
    document.getElementById('caja-pill').textContent = cajaActual ? `Caja #${cajaActual.id} abierta` : 'Sin caja abierta';

    if (cajaActual) {
        ventas = await window.api.ventas.listarPorCaja(cajaActual.id);
    } else {
        ventas = [];
    }
    renderLists();
    renderWithdrawals();
}

function setActiveSection(section) {
    activeSection = section;
    document.querySelectorAll('.op-tab').forEach((t) => t.classList.toggle('active', t.dataset.section === section));
    document.querySelectorAll('.op-section').forEach((p) => {
        const active = p.dataset.section === section;
        p.classList.toggle('active', active);
        p.hidden = !active;
    });
}

function saleMatchesSearch(v, term) {
    if (!term) return true;
    const text = [
        v.id,
        v.total,
        formatDateTime(v.fecha),
        ...v.items.map((i) => i.producto_nombre || ''),
        TIPO_PAGO_LABELS[v.tipo_pago]
    ].join(' ').toLowerCase();
    return text.includes(term.toLowerCase());
}

function renderLists() {
    const activas = ventas.filter((v) => v.estado !== 'cancelada' && saleMatchesSearch(v, salesSearchTerm));
    const canceladas = ventas.filter((v) => v.estado === 'cancelada' && saleMatchesSearch(v, salesSearchTerm));

    const activeList = document.getElementById('active-sales-list');
    activeList.innerHTML = activas.length ? activas.map((v) => saleCard(v, 'active')).join('')
        : '<div class="empty-state">No hay ventas activas en esta caja.</div>';

    const cancList = document.getElementById('canceled-sales-list');
    cancList.innerHTML = canceladas.length ? canceladas.map((v) => saleCard(v, 'canceled')).join('')
        : '<div class="empty-state">No hay ventas canceladas.</div>';
}

function saleCard(v, source) {
    return `
        <article class="sale-card">
            <div class="sale-card-header">
                <div>
                    <strong>Venta #${v.id}</strong>
                    <span class="muted">${formatDateTime(v.fecha)}</span>
                </div>
                <span class="pill ${source === 'canceled' ? 'danger' : ''}">$${money(v.total)}</span>
            </div>
            <div class="muted">
                ${v.items.length} producto(s) · ${TIPO_PAGO_LABELS[v.tipo_pago] || v.tipo_pago}
                · Efectivo $${money(v.subtotal_efectivo)} · Transf. $${money(v.subtotal_transferencia)}
                ${v.es_consignacion ? '· <span class="pill danger">Consignación</span>' : ''}
            </div>
            <button class="btn-outline" type="button" onclick="openSaleDetails(${v.id}, '${source}')">Detalles</button>
        </article>
    `;
}

function findSale(id) {
    return ventas.find((v) => v.id === id);
}

function openSaleDetails(id, source) {
    const sale = findSale(id);
    if (!sale) return;
    document.getElementById('sale-modal-title').textContent = `Venta #${sale.id}`;
    document.getElementById('sale-modal-meta').textContent = `${formatDateTime(sale.fecha)} · Total $${money(sale.total)}`;

    const cancelable = source === 'active';
    const itemsHtml = sale.items.map((item) => `
        <div class="product-item">
            <div class="product-item-head">
                <strong>${item.producto_nombre}</strong>
                ${item.es_consignacion ? '<span class="pill danger">Consignación</span>' : ''}
            </div>
            <div class="detail-row">
                <div>
                    <div class="muted">Cantidad: ${item.cantidad}</div>
                    <div class="muted">Unitario: $${money(item.precio_unitario)}</div>
                </div>
                <strong>$${money(item.subtotal)}</strong>
            </div>
        </div>
    `).join('');

    document.getElementById('sale-modal-body').innerHTML = `
        <div class="product-item">
            <div>Tipo de pago: <strong>${TIPO_PAGO_LABELS[sale.tipo_pago] || sale.tipo_pago}</strong></div>
            <div>Efectivo: <strong>$${money(sale.subtotal_efectivo)}</strong></div>
            <div>Transferencia: <strong>$${money(sale.subtotal_transferencia)}</strong></div>
        </div>
        <div class="sale-list">${itemsHtml}</div>
        ${cancelable ? `
            <div class="detail-actions">
                <button class="btn-danger" type="button" onclick="openCancelModal(${sale.id})">Cancelar venta</button>
            </div>
        ` : ''}
    `;
    openModal('sale-modal');
}

function openCancelModal(id) {
    pendingCancelId = id;
    document.getElementById('cancel-modal-text').textContent = `La venta #${id} pasará al listado de canceladas y se devolverá el stock.`;
    openModal('cancel-modal');
}

async function confirmCancelSale() {
    if (!pendingCancelId) return;
    await window.api.ventas.cancelar(pendingCancelId);
    pendingCancelId = null;
    closeCancelModal();
    closeSaleModal();
    await refresh();
}

function openModal(id) {
    document.body.classList.add('modal-open');
    document.getElementById('backdrop').classList.add('show');
    document.getElementById(id).classList.add('show');
    document.getElementById(id).setAttribute('aria-hidden', 'false');
}

function closeSaleModal() {
    document.getElementById('sale-modal').classList.remove('show');
    if (!document.getElementById('cancel-modal').classList.contains('show')) {
        document.getElementById('backdrop').classList.remove('show');
        document.body.classList.remove('modal-open');
    }
}

function closeCancelModal() {
    document.getElementById('cancel-modal').classList.remove('show');
    pendingCancelId = null;
    if (!document.getElementById('sale-modal').classList.contains('show')) {
        document.getElementById('backdrop').classList.remove('show');
        document.body.classList.remove('modal-open');
    }
}

// === Extracciones ==========================================================
async function renderWithdrawals() {
    const list = document.getElementById('withdrawal-list');
    if (!cajaActual) {
        list.innerHTML = '<div class="empty-state">No hay caja abierta. Las extracciones se registran sobre la caja activa.</div>';
        return;
    }
    const movs = await window.api.movimientos.listar(cajaActual.id);
    const extracciones = movs.filter((m) => m.es_extraccion);
    if (!extracciones.length) {
        list.innerHTML = '<div class="empty-state">Sin extracciones en esta caja.</div>';
        return;
    }
    list.innerHTML = extracciones.map((m) => `
        <article class="sale-card">
            <div class="sale-card-header">
                <div>
                    <strong>${formatDateTime(m.fecha)}</strong>
                    <span class="muted">${m.responsable || 'Caja'}</span>
                </div>
                <span class="pill">$${money(m.monto)}</span>
            </div>
            <div class="muted">${m.concepto}</div>
        </article>
    `).join('');
}

async function registerWithdrawal(e) {
    e.preventDefault();
    const amount = Number(document.getElementById('withdrawal-amount').value || 0);
    const note = document.getElementById('withdrawal-note').value.trim();
    const error = document.getElementById('withdrawal-error');
    if (Number.isNaN(amount) || amount <= 0) {
        error.textContent = 'Ingresa un monto válido.';
        return;
    }
    if (!cajaActual) {
        error.textContent = 'No hay caja abierta.';
        return;
    }
    const session = readSession();
    const res = await window.api.movimientos.registrarExtraccion({
        monto: amount,
        concepto: note || 'Extracción de caja',
        responsable: session?.displayName || session?.username || null
    });
    if (!res.ok) {
        error.textContent = 'No se pudo registrar la extracción.';
        return;
    }
    document.getElementById('withdrawal-amount').value = '';
    document.getElementById('withdrawal-note').value = '';
    error.textContent = '';
    renderWithdrawals();
}

document.addEventListener('DOMContentLoaded', async () => {
    await refresh();
    setActiveSection('active');
    document.querySelectorAll('.op-tab').forEach((t) => {
        t.addEventListener('click', () => setActiveSection(t.dataset.section));
    });
    document.getElementById('withdrawal-form').addEventListener('submit', registerWithdrawal);
    document.getElementById('backdrop').addEventListener('click', () => {
        closeSaleModal();
        closeCancelModal();
    });
    document.getElementById('sales-search').addEventListener('input', (e) => {
        salesSearchTerm = e.target.value.trim();
        renderLists();
    });
});

window.openSaleDetails = openSaleDetails;
window.openCancelModal = openCancelModal;
window.confirmCancelSale = confirmCancelSale;
window.closeSaleModal = closeSaleModal;
window.closeCancelModal = closeCancelModal;
