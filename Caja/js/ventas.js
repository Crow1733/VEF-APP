let activeSales = [
    {
        id: 'V-1008',
        dateTime: '2026-05-24T12:15:00',
        total: 14500,
        items: [
            { name: 'Hamburguesa Simple', qty: 1, price: 5000, payment: 'Efectivo' },
            { name: 'Papas Fritas', qty: 1, price: 2500, payment: 'Efectivo' },
            { name: 'Gaseosa Cola', qty: 3, price: 1500, payment: 'Efectivo' }
        ]
    },
    {
        id: 'V-1009',
        dateTime: '2026-05-24T13:08:00',
        total: 11000,
        items: [
            { name: 'Pizza Muzzarella', qty: 1, price: 8000, payment: 'Transferencia' },
            { name: 'Helado Vainilla', qty: 1, price: 3000, payment: 'Transferencia' }
        ]
    },
    {
        id: 'V-1010',
        dateTime: '2026-05-24T14:02:00',
        total: 4000,
        items: [
            { name: 'Cerveza Artesanal', qty: 1, price: 4000, payment: 'Efectivo' }
        ]
    }
];

let canceledSales = [
    {
        id: 'V-0993',
        dateTime: '2026-05-24T10:22:00',
        total: 8000,
        canceledAt: '2026-05-24T10:31:00',
        items: [
            { name: 'Pizza Muzzarella', qty: 1, price: 8000, payment: 'Efectivo' }
        ]
    },
    {
        id: 'V-0998',
        dateTime: '2026-05-24T11:47:00',
        total: 6500,
        canceledAt: '2026-05-24T11:53:00',
        items: [
            { name: 'Hamburguesa Simple', qty: 1, price: 5000, payment: 'Transferencia' },
            { name: 'Gaseosa Cola', qty: 1, price: 1500, payment: 'Transferencia' }
        ]
    }
];

let selectedSale = null;
let selectedSaleSource = null;
let editingSaleId = null;
let saleToCancel = null;
let salesSearchTerm = '';
const WITHDRAWALS_KEY = 'directWithdrawals';
let activeSection = 'active';

function money(value) {
    return new Intl.NumberFormat('es-ES').format(value);
}

function formatDateTime(value) {
    return new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(new Date(value));
}

function normalizeText(value) {
    return value.toString().toLowerCase().trim();
}

function readSession() {
    try {
        const raw = localStorage.getItem('appSession');
        if (!raw) {
            return null;
        }
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') {
            return null;
        }
        return data;
    } catch (error) {
        return null;
    }
}

function loadWithdrawals() {
    try {
        const raw = localStorage.getItem(WITHDRAWALS_KEY);
        if (!raw) {
            return [];
        }
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        return [];
    }
}

function saveWithdrawals(list) {
    localStorage.setItem(WITHDRAWALS_KEY, JSON.stringify(list));
}

function renderWithdrawals() {
    const list = document.getElementById('withdrawal-list');
    if (!list) {
        return;
    }

    const withdrawals = loadWithdrawals();
    if (!withdrawals.length) {
        list.innerHTML = '<div class="empty-state">No hay extracciones registradas.</div>';
        return;
    }

    list.innerHTML = withdrawals
        .map((item) => `
            <article class="sale-card">
                <div class="sale-card-header">
                    <div>
                        <strong>${formatDateTime(item.createdAt)}</strong>
                        <span class="muted">${item.user || 'Caja'}</span>
                    </div>
                    <span class="pill">$${money(item.amount)}</span>
                </div>
                <div class="muted">${item.note || 'Sin motivo'}</div>
            </article>
        `)
        .join('');
}

function registerWithdrawal(event) {
    event.preventDefault();
    const amountInput = document.getElementById('withdrawal-amount');
    const noteInput = document.getElementById('withdrawal-note');
    const error = document.getElementById('withdrawal-error');

    const amount = Number(amountInput.value || 0);
    if (Number.isNaN(amount) || amount <= 0) {
        error.textContent = 'Ingresa un monto valido.';
        return;
    }

    const session = readSession();
    const withdrawals = loadWithdrawals();
    withdrawals.unshift({
        id: `EXT-${Date.now()}`,
        amount,
        note: noteInput.value.trim(),
        user: session?.displayName || session?.username || 'Caja',
        createdAt: new Date().toISOString()
    });

    saveWithdrawals(withdrawals);
    amountInput.value = '';
    noteInput.value = '';
    error.textContent = '';
    renderWithdrawals();
}

function saleMatchesSearch(sale, searchTerm) {
    if (!searchTerm) {
        return true;
    }

    const normalizedSearch = normalizeText(searchTerm);
    const formattedDateTime = normalizeText(formatDateTime(sale.dateTime));
    const saleTime = new Date(sale.dateTime).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
    });
    const canceledTime = sale.canceledAt ? new Date(sale.canceledAt).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
    }) : '';
    const searchableText = [
        sale.id,
        sale.total,
        sale.canceledAt ? formatDateTime(sale.canceledAt) : '',
        saleTime,
        canceledTime,
        ...sale.items.flatMap((item) => [item.name, item.price, item.qty * item.price, item.payment])
    ]
        .join(' ')
        .toLowerCase();
    const digitsOnlySearch = normalizedSearch.replace(/\D/g, '');

    if (formattedDateTime.includes(normalizedSearch) || saleTime.toLowerCase().includes(normalizedSearch) || canceledTime.toLowerCase().includes(normalizedSearch)) {
        return true;
    }

    if (searchableText.includes(normalizedSearch)) {
        return true;
    }

    if (digitsOnlySearch) {
        return searchableText.replace(/\D/g, '').includes(digitsOnlySearch);
    }

    return false;
}

function renderLists() {
    renderActiveSales();
    renderCanceledSales();
}

function setActiveSection(section) {
    activeSection = section;
    document.querySelectorAll('.op-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.section === section);
        tab.setAttribute('aria-selected', tab.dataset.section === section ? 'true' : 'false');
    });
    document.querySelectorAll('.op-section').forEach((panel) => {
        const isActive = panel.dataset.section === section;
        panel.classList.toggle('active', isActive);
        panel.hidden = !isActive;
        panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
}

function renderActiveSales() {
    const container = document.getElementById('active-sales-list');
    const filteredSales = activeSales.filter((sale) => saleMatchesSearch(sale, salesSearchTerm));

    container.innerHTML = filteredSales.length ? filteredSales.map((sale) => `
        <article class="sale-card">
            <div class="sale-card-header">
                <div>
                    <strong>${formatDateTime(sale.dateTime)}</strong>
                    <span class="muted">${sale.id}</span>
                </div>
                <span class="pill">$${money(sale.total)}</span>
            </div>
            <div class="muted">${sale.items.length} producto(s) vendidos</div>
            <button class="btn-outline" onclick="openSaleDetails('${sale.id}', 'active')">Detalles</button>
        </article>
    `).join('') : '<div class="empty-state">No hay ventas activas para mostrar.</div>';
}

function renderCanceledSales() {
    const container = document.getElementById('canceled-sales-list');
    const filteredSales = canceledSales.filter((sale) => saleMatchesSearch(sale, salesSearchTerm));

    container.innerHTML = filteredSales.length ? filteredSales.map((sale) => `
        <article class="sale-card">
            <div class="sale-card-header">
                <div>
                    <strong>${formatDateTime(sale.dateTime)}</strong>
                    <span class="muted">${sale.id}</span>
                </div>
                <span class="pill danger">$${money(sale.total)}</span>
            </div>
            <div class="muted">Cancelada el ${formatDateTime(sale.canceledAt)}</div>
            <button class="btn-outline" onclick="openSaleDetails('${sale.id}', 'canceled')">Detalles</button>
        </article>
    `).join('') : '<div class="empty-state">No hay ventas canceladas.</div>';
}

function updateSalesSearch(value) {
    salesSearchTerm = value.trim();
    renderLists();
}

function findSale(saleId, source) {
    const list = source === 'canceled' ? canceledSales : activeSales;
    return list.find((sale) => sale.id === saleId);
}

function openSaleDetails(saleId, source) {
    selectedSale = findSale(saleId, source);
    selectedSaleSource = source;
    editingSaleId = null;

    if (!selectedSale) {
        return;
    }

    document.getElementById('sale-modal-title').textContent = `Detalle ${selectedSale.id}`;
    const extraMeta = source === 'canceled'
        ? ` | Cancelada el ${formatDateTime(selectedSale.canceledAt)}`
        : '';
    document.getElementById('sale-modal-meta').textContent = `${formatDateTime(selectedSale.dateTime)} | Total $${money(selectedSale.total)}${extraMeta}`;

    renderSaleModalBody();
    openModal('sale-modal');
}

function renderSaleModalBody() {
    const body = document.getElementById('sale-modal-body');
    if (!selectedSale) {
        body.innerHTML = '';
        return;
    }

    const isEditable = selectedSaleSource === 'active';
    const isEditing = isEditable && editingSaleId === selectedSale.id;

    body.innerHTML = `
        ${isEditable ? `
            <div class="detail-actions" style="justify-content:flex-start;">
                <button class="btn-primary" onclick="toggleEditSale()">${isEditing ? 'Guardar cambios' : 'Editar'}</button>
                <button class="btn-danger" onclick="openCancelModal()">Cancelar venta</button>
            </div>
        ` : ''}
        <div class="sale-list">
            ${selectedSale.items.map((item, index) => `
                <div class="product-item">
                    <div class="product-item-head">
                        <strong>${item.name}</strong>
                        <span class="pill gray">${item.payment}</span>
                    </div>
                    ${isEditing ? `
                        <div class="detail-row" style="grid-template-columns:1fr 140px;">
                            <div>
                                <div class="muted">Unitario: $${money(item.price)}</div>
                                <div class="muted">Subtotal actual: $${money(item.qty * item.price)}</div>
                            </div>
                            <div>
                                <label class="muted" for="edit-qty-${index}">Cantidad</label>
                                <input class="edit-input" id="edit-qty-${index}" type="number" min="1" value="${item.qty}">
                            </div>
                        </div>
                        <div class="detail-row" style="grid-template-columns:1fr 140px;">
                            <div>
                                <div class="muted">Metodo de pago</div>
                            </div>
                            <div>
                                <label class="muted" for="edit-payment-${index}">Pago</label>
                                <select class="edit-input" id="edit-payment-${index}">
                                    <option value="Efectivo" ${item.payment === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
                                    <option value="Transferencia" ${item.payment === 'Transferencia' ? 'selected' : ''}>Transferencia</option>
                                </select>
                            </div>
                        </div>
                    ` : `
                        <div class="detail-row">
                            <div>
                                <div class="muted">Cantidad: ${item.qty}</div>
                                <div class="muted">Unitario: $${money(item.price)}</div>
                            </div>
                            <strong>$${money(item.qty * item.price)}</strong>
                        </div>
                    `}
                </div>
            `).join('')}
        </div>
        ${isEditing ? `
            <div class="detail-actions" style="justify-content:flex-end;">
                <button class="btn-soft" onclick="cancelEditSale()">Cancelar edicion</button>
                <button class="btn-primary" onclick="saveEditedSale()">Guardar cambios</button>
            </div>
        ` : ''}
    `;
}

function toggleEditSale() {
    if (!selectedSale || selectedSaleSource !== 'active') {
        return;
    }

    if (editingSaleId === selectedSale.id) {
        saveEditedSale();
        return;
    }

    editingSaleId = selectedSale.id;
    renderSaleModalBody();
}

function cancelEditSale() {
    editingSaleId = null;
    renderSaleModalBody();
}

function saveEditedSale() {
    if (!selectedSale || selectedSaleSource !== 'active') {
        return;
    }

    const updatedItems = selectedSale.items.map((item, index) => {
        const input = document.getElementById(`edit-qty-${index}`);
        const qty = Math.max(1, parseInt(input.value, 10) || 1);
        const paymentInput = document.getElementById(`edit-payment-${index}`);
        const payment = paymentInput ? paymentInput.value : item.payment;
        return { ...item, qty, payment };
    });

    const updatedTotal = updatedItems.reduce((sum, item) => sum + (item.qty * item.price), 0);

    selectedSale.items = updatedItems;
    selectedSale.total = updatedTotal;

    const saleIndex = activeSales.findIndex((sale) => sale.id === selectedSale.id);
    if (saleIndex >= 0) {
        activeSales[saleIndex] = { ...selectedSale };
    }

    editingSaleId = null;
    renderLists();
    openSaleDetails(selectedSale.id, 'active');
}

function openCancelModal() {
    if (!selectedSale || selectedSaleSource !== 'active') {
        return;
    }

    saleToCancel = selectedSale.id;
    document.getElementById('cancel-modal-text').textContent = `La venta ${selectedSale.id} pasara al listado de canceladas con todos sus productos.`;
    openModal('cancel-modal');
}

function confirmCancelSale() {
    if (!saleToCancel) {
        return;
    }

    const saleIndex = activeSales.findIndex((sale) => sale.id === saleToCancel);
    if (saleIndex < 0) {
        closeCancelModal();
        return;
    }

    const [sale] = activeSales.splice(saleIndex, 1);
    canceledSales.unshift({
        ...sale,
        canceledAt: new Date().toISOString()
    });

    saleToCancel = null;
    closeCancelModal();
    closeSaleModal();
    renderLists();
}

function openModal(id) {
    document.body.classList.add('modal-open');
    document.getElementById('backdrop').classList.add('show');
    document.getElementById(id).classList.add('show');
    document.getElementById(id).setAttribute('aria-hidden', 'false');
}

function closeSaleModal() {
    document.getElementById('sale-modal').classList.remove('show');
    document.getElementById('sale-modal').setAttribute('aria-hidden', 'true');
    if (!document.getElementById('cancel-modal').classList.contains('show')) {
        document.getElementById('backdrop').classList.remove('show');
        document.body.classList.remove('modal-open');
    }
}

function closeCancelModal() {
    document.getElementById('cancel-modal').classList.remove('show');
    document.getElementById('cancel-modal').setAttribute('aria-hidden', 'true');
    saleToCancel = null;
    if (!document.getElementById('sale-modal').classList.contains('show')) {
        document.getElementById('backdrop').classList.remove('show');
        document.body.classList.remove('modal-open');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderLists();
    renderWithdrawals();
    setActiveSection(activeSection);
    document.querySelectorAll('.op-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            setActiveSection(tab.dataset.section);
        });
    });
    const form = document.getElementById('withdrawal-form');
    if (form) {
        form.addEventListener('submit', registerWithdrawal);
    }
    document.getElementById('backdrop').addEventListener('click', () => {
        closeSaleModal();
        closeCancelModal();
    });
    document.getElementById('sales-search').addEventListener('input', (event) => {
        updateSalesSearch(event.target.value);
    });
});