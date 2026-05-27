const products = [
    { id: 1, name: 'Hamburguesa Simple', price: 5000 },
    { id: 2, name: 'Papas Fritas', price: 2500 },
    { id: 3, name: 'Gaseosa Cola', price: 1500 },
    { id: 4, name: 'Helado Vainilla', price: 3000 },
    { id: 5, name: 'Pizza Muzzarella', price: 8000 },
    { id: 6, name: 'Cerveza Artesanal', price: 4000 }
];

let cart = [
    { id: 1, name: 'Hamburguesa Simple', price: 5000, qty: 1, payment: 'Mixto' },
    { id: 3, name: 'Gaseosa Cola', price: 1500, qty: 2, payment: 'Mixto' }
];

let historySales = [
    {
        id: 'CAJ-1001',
        dateTime: '2026-05-24T09:25:00',
        total: 11500,
        items: [
            { name: 'Hamburguesa Simple', qty: 1, price: 5000, payment: 'Efectivo' },
            { name: 'Papas Fritas', qty: 1, price: 2500, payment: 'Efectivo' },
            { name: 'Gaseosa Cola', qty: 2, price: 1500, payment: 'Efectivo' }
        ]
    },
    {
        id: 'CAJ-1002',
        dateTime: '2026-05-24T10:40:00',
        total: 8000,
        items: [
            { name: 'Pizza Muzzarella', qty: 1, price: 8000, payment: 'Transferencia' }
        ]
    }
];

let currentMode = 'sale';
let detailSaleId = null;
let productSearchTerm = '';
let pendingSale = null;
let isDraggingPaymentBar = false;
let orderSearchTerm = '';

function money(value) {
    return new Intl.NumberFormat('es-ES').format(value);
}

function normalizeQty(value) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
        return 1;
    }
    return parsed;
}

function formatDateTime(value) {
    return new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(new Date(value));
}

function renderProducts() {
    const grid = document.getElementById('products-grid');
    const filteredProducts = products.filter((product) =>
        product.name.toLowerCase().includes(productSearchTerm.toLowerCase())
    );

    grid.innerHTML = '';

    if (!filteredProducts.length) {
        grid.innerHTML = '<div class="empty-state product-empty">No se encontraron productos con esa búsqueda.</div>';
        return;
    }

    filteredProducts.forEach((product) => {
        const card = document.createElement('article');
        card.className = 'product-card';
        card.innerHTML = `
            <div>
                <h3>${product.name}</h3>
                <div class="price">$${money(product.price)}</div>
            </div>
            <div class="qty-control">
                <button type="button" onclick="changeProductQty(${product.id}, -1)">-</button>
                <input class="qty-input" id="qty-${product.id}" type="number" min="1" step="1" inputmode="numeric" value="1" onchange="setProductQty(${product.id}, this.value)">
                <button type="button" onclick="changeProductQty(${product.id}, 1)">+</button>
            </div>
            <button class="btn-primary" type="button" onclick="addToCart(${product.id})">Agregar a venta</button>
        `;
        grid.appendChild(card);
    });
}

function changeProductQty(productId, change) {
    const input = document.getElementById(`qty-${productId}`);
    const currentValue = normalizeQty(input.value);
    input.value = Math.max(1, currentValue + change);
}

function setProductQty(productId, value) {
    const input = document.getElementById(`qty-${productId}`);
    input.value = normalizeQty(value);
}

function addToCart(productId) {
    const product = products.find((item) => item.id === productId);
    const qty = normalizeQty(document.getElementById(`qty-${productId}`).value);
    const payment = 'Mixto';

    const existingIndex = cart.findIndex((item) => item.id === productId && item.payment === payment);
    if (existingIndex >= 0) {
        cart[existingIndex].qty += qty;
    } else {
        cart.push({ ...product, qty, payment });
    }

    document.getElementById(`qty-${productId}`).value = 1;
    renderRightPanel();
}

function changeCartQty(index, change) {
    cart[index].qty = Math.max(1, normalizeQty(cart[index].qty) + change);
    renderRightPanel();
}

function setCartQty(index, value) {
    cart[index].qty = normalizeQty(value);
    renderRightPanel();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderRightPanel();
}

function completeSale() {
    if (!cart.length) {
        alert('Agrega productos a la venta primero.');
        return;
    }

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    pendingSale = {
        id: `CAJ-${1000 + historySales.length + 1}`,
        dateTime: new Date().toISOString(),
        total,
        items: cart.map((item) => ({
            name: item.name,
            qty: item.qty,
            price: item.price,
            payment: item.payment
        }))
    };

    openPaymentModal(total);
}

function openSaleDetails(saleId) {
    detailSaleId = saleId;
    const sale = historySales.find((item) => item.id === saleId);
    if (!sale) {
        return;
    }

    document.getElementById('sale-details-title').textContent = `Detalle ${sale.id}`;
    document.getElementById('sale-details-meta').textContent = `${formatDateTime(sale.dateTime)} | Total $${money(sale.total)}`;

    const body = document.getElementById('sale-details-body');
    const paymentSummary = sale.paymentSummary
        ? `
            <div class="payment-summary">
                <span>Efectivo</span>
                <strong>$${money(sale.paymentSummary.cash)}</strong>
            </div>
            <div class="payment-summary">
                <span>Transferencia</span>
                <strong>$${money(sale.paymentSummary.transfer)}</strong>
            </div>
        `
        : '';

    body.innerHTML = `
        ${paymentSummary}
        <div class="sale-items">
            ${sale.items.map((item) => `
                <div class="sale-item">
                    <div class="sale-item-head">
                        <strong>${item.name}</strong>
                        <span class="small-chip">${item.payment}</span>
                    </div>
                    <div class="sale-meta">
                        <span class="muted">Cantidad: ${item.qty}</span>
                        <span class="muted">Unitario: $${money(item.price)}</span>
                        <strong>$${money(item.qty * item.price)}</strong>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    openModal('sale-details-modal');
}

function renderRightPanel() {
    const content = document.getElementById('order-modal-content');
    renderCartPanel(content);
}

function renderCartPanel(container) {
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const filteredCart = cart.filter((item) =>
        item.name.toLowerCase().includes(orderSearchTerm.toLowerCase())
    );

    container.innerHTML = `
        <div class="order-content-head compact">
            <div class="order-search-wrap">
                <input id="order-search" class="order-search" type="search" placeholder="Buscar en pedido..." aria-label="Buscar en pedido">
            </div>
        </div>
        <div class="cart-list">
            ${filteredCart.length ? filteredCart.map((item, index) => `
                <div class="cart-card">
                    <div class="card-top">
                        <div>
                            <strong>${item.name}</strong>
                            <span class="muted">${item.payment}</span>
                        </div>
                        <button class="btn-ghost" type="button" onclick="removeFromCart(${index})">Quitar</button>
                    </div>
                    <div class="cart-line">
                        <div class="qty-control">
                            <button type="button" onclick="changeCartQty(${index}, -1)">-</button>
                            <input class="qty-input" type="number" min="1" step="1" inputmode="numeric" value="${item.qty}" onchange="setCartQty(${index}, this.value)">
                            <button type="button" onclick="changeCartQty(${index}, 1)">+</button>
                        </div>
                        <div>
                            <div class="muted">Unitario: $${money(item.price)}</div>
                            <strong>Total: $${money(item.price * item.qty)}</strong>
                        </div>
                    </div>
                </div>
            `).join('') : '<div class="empty-state">No hay productos que coincidan con la búsqueda.</div>'}
        </div>
        <div class="total-box">
            <span>Total</span>
            <span>$${money(total)}</span>
        </div>
        <button class="btn-primary" type="button" onclick="completeSale()">Completar venta</button>
    `;

    const searchInput = document.getElementById('order-search');
    if (searchInput) {
        searchInput.value = orderSearchTerm;
        searchInput.addEventListener('input', (event) => {
            updateOrderSearch(event.target.value);
        }, { once: true });
    }
}

function openModal(id) {
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');
    document.getElementById('backdrop').classList.add('show');
    document.getElementById(id).classList.add('show');
    document.getElementById(id).setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
    document.getElementById('backdrop').classList.remove('show');
    document.getElementById(id).classList.remove('show');
    document.getElementById(id).setAttribute('aria-hidden', 'true');
    if (!document.getElementById('payment-modal').classList.contains('show')) {
        document.body.classList.remove('modal-open');
        document.documentElement.classList.remove('modal-open');
    }
}

function openOrderModal() {
    renderRightPanel();
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');
    document.getElementById('backdrop').classList.add('show');
    const modal = document.getElementById('order-modal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

function closeOrderModal() {
    const modal = document.getElementById('order-modal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    if (!document.getElementById('payment-modal').classList.contains('show')) {
        document.getElementById('backdrop').classList.remove('show');
        document.body.classList.remove('modal-open');
        document.documentElement.classList.remove('modal-open');
    }
}

function openPaymentModal(total) {
    const cashInput = document.getElementById('payment-cash');
    const transferInput = document.getElementById('payment-transfer');
    const totalLabel = document.getElementById('payment-total');
    const assignedLabel = document.getElementById('payment-assigned');
    const error = document.getElementById('payment-error');
    const modal = document.getElementById('payment-modal');

    if (cashInput) {
        cashInput.value = total.toFixed(2);
        cashInput.max = total.toFixed(2);
    }
    if (transferInput) {
        transferInput.value = '0.00';
        transferInput.max = total.toFixed(2);
    }
    if (totalLabel) {
        totalLabel.textContent = `$${money(total)}`;
    }
    if (assignedLabel) {
        assignedLabel.textContent = `$${money(total)}`;
    }
    if (error) {
        error.textContent = '';
    }

    modal.dataset.total = String(total);
    updateAssignedPayment();
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');
    document.getElementById('backdrop').classList.add('show');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    if (!document.getElementById('sale-details-modal').classList.contains('show')) {
        document.getElementById('backdrop').classList.remove('show');
        document.body.classList.remove('modal-open');
        document.documentElement.classList.remove('modal-open');
    }
    pendingSale = null;
}

function updateAssignedPayment() {
    const cashInput = document.getElementById('payment-cash');
    const transferInput = document.getElementById('payment-transfer');
    const assignedLabel = document.getElementById('payment-assigned');
    const error = document.getElementById('payment-error');
    const cashBar = document.getElementById('payment-bar-cash');
    const transferBar = document.getElementById('payment-bar-transfer');
    const handle = document.getElementById('payment-bar-handle');
    const modal = document.getElementById('payment-modal');

    const cash = Number(cashInput.value || 0);
    const transfer = Number(transferInput.value || 0);
    const assigned = cash + transfer;
    const total = Number(modal.dataset.total || 0);
    const safeTotal = total > 0 ? total : 1;
    const cashRatio = Math.max(0, Math.min(1, cash / safeTotal));
    const transferRatio = Math.max(0, Math.min(1, transfer / safeTotal));
    const normalized = cashRatio + transferRatio || 1;
    const cashWidth = (cashRatio / normalized) * 100;
    const transferWidth = (transferRatio / normalized) * 100;

    if (assignedLabel) {
        assignedLabel.textContent = `$${money(assigned)}`;
    }
    if (error) {
        error.textContent = '';
    }
    if (cashBar) {
        cashBar.style.width = `${cashWidth}%`;
    }
    if (transferBar) {
        transferBar.style.width = `${transferWidth}%`;
    }
    if (handle) {
        handle.style.left = `${cashWidth}%`;
    }
}

function roundMoney(value) {
    return Math.round(value * 100) / 100;
}

function clampMoney(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function syncPaymentInputs(source) {
    const cashInput = document.getElementById('payment-cash');
    const transferInput = document.getElementById('payment-transfer');
    const modal = document.getElementById('payment-modal');
    if (!cashInput || !transferInput || !modal) {
        return;
    }

    const total = Number(modal.dataset.total || 0);
    const sourceInput = source === 'cash' ? cashInput : transferInput;
    const targetInput = source === 'cash' ? transferInput : cashInput;
    const rawValue = sourceInput.value;

    if (rawValue === '' || rawValue.endsWith('.') || rawValue === '-') {
        updateAssignedPayment();
        return;
    }

    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) {
        return;
    }

    const clamped = clampMoney(parsed, 0, total);
    if (parsed !== clamped) {
        sourceInput.value = clamped.toFixed(2);
    }

    const other = roundMoney(total - clamped);
    targetInput.value = other.toFixed(2);
    updateAssignedPayment();
}

function updatePaymentFromBar(clientX) {
    const track = document.getElementById('payment-bar-track');
    const modal = document.getElementById('payment-modal');
    const cashInput = document.getElementById('payment-cash');
    const transferInput = document.getElementById('payment-transfer');
    if (!track || !modal || !cashInput || !transferInput) {
        return;
    }

    const total = Number(modal.dataset.total || 0);
    if (total <= 0) {
        return;
    }

    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const step = 10;
    const steppedCash = Math.round((total * ratio) / step) * step;
    const cash = roundMoney(Math.min(total, Math.max(0, steppedCash)));
    const transfer = roundMoney(total - cash);

    cashInput.value = cash.toFixed(2);
    transferInput.value = transfer.toFixed(2);
    updateAssignedPayment();
}

function confirmPaymentSplit() {
    if (!pendingSale) {
        closePaymentModal();
        return;
    }

    const cashInput = document.getElementById('payment-cash');
    const transferInput = document.getElementById('payment-transfer');
    const error = document.getElementById('payment-error');

    const cash = Number(cashInput.value || 0);
    const transfer = Number(transferInput.value || 0);
    const assigned = cash + transfer;
    const total = pendingSale.total;
    const diff = Math.abs(Math.round((assigned - total) * 100) / 100);

    if (cash < 0 || transfer < 0 || diff > 0.01) {
        if (error) {
            error.textContent = 'La suma de efectivo y transferencia debe coincidir con el total.';
        }
        return;
    }

    const sale = {
        ...pendingSale,
        paymentSummary: {
            cash,
            transfer
        }
    };

    historySales.unshift(sale);
    cart = [];
    pendingSale = null;
    closePaymentModal();
    renderRightPanel();
}

function updateProductSearch(value) {
    productSearchTerm = value.trim();
    renderProducts();
}

function updateOrderSearch(value) {
    orderSearchTerm = value.trim();
    renderRightPanel();
}

document.addEventListener('DOMContentLoaded', () => {
    renderProducts();
    renderRightPanel();
    const orderToggle = document.getElementById('order-toggle');
    if (orderToggle) {
        orderToggle.addEventListener('click', openOrderModal);
    }
    document.getElementById('backdrop').addEventListener('click', () => {
        if (document.getElementById('order-modal').classList.contains('show')) {
            closeOrderModal();
            return;
        }
        if (document.getElementById('payment-modal').classList.contains('show')) {
            closePaymentModal();
            return;
        }
        closeModal('sale-details-modal');
    });
    document.getElementById('product-search').addEventListener('input', (event) => {
        updateProductSearch(event.target.value);
    });
    document.getElementById('payment-cash').addEventListener('input', () => syncPaymentInputs('cash'));
    document.getElementById('payment-transfer').addEventListener('input', () => syncPaymentInputs('transfer'));
    const paymentTrack = document.getElementById('payment-bar-track');
    if (paymentTrack) {
        paymentTrack.addEventListener('pointerdown', (event) => {
            isDraggingPaymentBar = true;
            paymentTrack.setPointerCapture(event.pointerId);
            updatePaymentFromBar(event.clientX);
        });
        paymentTrack.addEventListener('pointermove', (event) => {
            if (!isDraggingPaymentBar) {
                return;
            }
            updatePaymentFromBar(event.clientX);
        });
        paymentTrack.addEventListener('pointerup', (event) => {
            isDraggingPaymentBar = false;
            paymentTrack.releasePointerCapture(event.pointerId);
        });
        paymentTrack.addEventListener('pointerleave', () => {
            isDraggingPaymentBar = false;
        });
    }
});