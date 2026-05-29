// Punto de venta. Consume window.api para todo.
let productos = [];
let categorias = [];
let cajaActual = null;
let cart = [];
let productSearchTerm = '';
let orderSearchTerm = '';
let activeCategoryFilter = 'all';
let pendingSale = null;
let isDraggingPaymentBar = false;

function money(value) {
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function normalizeQty(value) {
    const parsed = parseInt(value, 10);
    return (Number.isNaN(parsed) || parsed < 1) ? 1 : parsed;
}

function roundMoney(value) {
    return Math.round(value * 100) / 100;
}

function clampMoney(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

async function refreshData() {
    [productos, categorias, cajaActual] = await Promise.all([
        window.api.productos.listar(),
        window.api.categorias.listar(),
        window.api.cajas.actual()
    ]);
    renderCajaStatus();
}

function renderCajaStatus() {
    const pill = document.getElementById('caja-pill');
    const statusLine = document.getElementById('caja-status-line');
    if (cajaActual) {
        pill.textContent = `Caja #${cajaActual.id} · abierta`;
        statusLine.textContent = `Caja abierta desde ${new Date(cajaActual.fecha_apertura).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}.`;
    } else {
        pill.textContent = 'Caja cerrada';
        statusLine.textContent = 'No hay caja abierta. Ve a Apertura/Cierre para abrirla antes de vender.';
    }
}

function renderCategoryFilter() {
    const container = document.getElementById('category-filter');
    if (!container) return;
    const all = [{ id: 'all', nombre: 'Todas' }].concat(categorias.filter((c) => c.activa));
    container.innerHTML = all.map((c) => `
        <button class="cat-chip ${String(activeCategoryFilter) === String(c.id) ? 'active' : ''} ${c.es_consignacion ? 'consignacion' : ''}" data-id="${c.id}" type="button">
            ${c.nombre}${c.es_consignacion ? ' ◇' : ''}
        </button>
    `).join('');
    container.querySelectorAll('.cat-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
            activeCategoryFilter = btn.dataset.id === 'all' ? 'all' : Number(btn.dataset.id);
            renderCategoryFilter();
            renderProducts();
        });
    });
}

function renderProducts() {
    const grid = document.getElementById('products-grid');
    const filtered = productos.filter((p) => {
        if (activeCategoryFilter !== 'all' && p.categoria_id !== activeCategoryFilter) return false;
        if (productSearchTerm && !p.nombre.toLowerCase().includes(productSearchTerm.toLowerCase())) return false;
        return p.activa;
    });
    if (!filtered.length) {
        grid.innerHTML = '<div class="empty-state product-empty">No se encontraron productos.</div>';
        return;
    }
    grid.innerHTML = filtered.map((p) => `
        <article class="product-card ${p.tipo_producto === 'consignacion' ? 'consignacion' : ''}">
            <div class="product-card-top">
                ${p.imagen ? `<img class="product-image" src="${p.imagen}" alt="${p.nombre}" loading="lazy">` : '<div class="product-image product-image-placeholder">Sin foto</div>'}
                <div class="product-info">
                    <h3>${p.nombre}</h3>
                    <div class="muted small">${p.categoria_nombre}${p.tipo_producto === 'consignacion' ? ' · Consignación' : ''}</div>
                    <div class="price">$${money(p.precio_venta)}</div>
                    <div class="stock">Stock: ${p.stock_actual}</div>
                </div>
            </div>
            <div class="product-actions">
                <div class="qty-control">
                    <button type="button" onclick="changeProductQty(${p.id}, -1)">-</button>
                    <input class="qty-input" id="qty-${p.id}" type="number" min="1" step="1" inputmode="numeric" value="1" onchange="setProductQty(${p.id}, this.value)">
                    <button type="button" onclick="changeProductQty(${p.id}, 1)">+</button>
                </div>
                <button class="btn-primary" type="button" onclick="addToCart(${p.id})" ${!cajaActual ? 'disabled title="Abre una caja para vender"' : ''}>Agregar a venta</button>
            </div>
        </article>
    `).join('');
}

function changeProductQty(id, delta) {
    const input = document.getElementById(`qty-${id}`);
    input.value = Math.max(1, normalizeQty(input.value) + delta);
}

function setProductQty(id, value) {
    const input = document.getElementById(`qty-${id}`);
    input.value = normalizeQty(value);
}

function addToCart(id) {
    if (!cajaActual) {
        alert('Abre la caja antes de registrar ventas.');
        return;
    }
    const prod = productos.find((p) => p.id === id);
    if (!prod) return;
    const qty = normalizeQty(document.getElementById(`qty-${id}`).value);
    const existing = cart.find((item) => item.producto_id === id);
    if (existing) {
        existing.cantidad += qty;
    } else {
        cart.push({
            producto_id: id,
            nombre: prod.nombre,
            precio_unitario: prod.precio_venta,
            cantidad: qty,
            es_consignacion: prod.tipo_producto === 'consignacion'
        });
    }
    document.getElementById(`qty-${id}`).value = 1;
    renderCartPanel();
}

function changeCartQty(idx, delta) {
    cart[idx].cantidad = Math.max(1, normalizeQty(cart[idx].cantidad) + delta);
    renderCartPanel();
}

function setCartQty(idx, value) {
    cart[idx].cantidad = normalizeQty(value);
    renderCartPanel();
}

function removeFromCart(idx) {
    cart.splice(idx, 1);
    renderCartPanel();
}

function renderCartPanel() {
    const container = document.getElementById('order-modal-content');
    if (!container) return;
    const total = cart.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
    const filtered = cart.filter((i) => i.nombre.toLowerCase().includes(orderSearchTerm.toLowerCase()));
    container.innerHTML = `
        <div class="order-content-head compact">
            <div class="order-search-wrap">
                <input id="order-search" class="order-search" type="search" placeholder="Buscar en pedido..." aria-label="Buscar en pedido" value="${orderSearchTerm}">
            </div>
        </div>
        <div class="cart-list">
            ${filtered.length ? filtered.map((item) => {
                const idx = cart.indexOf(item);
                return `
                <div class="cart-card">
                    <div class="card-top">
                        <div>
                            <strong>${item.nombre}</strong>
                            ${item.es_consignacion ? '<span class="muted">Consignación</span>' : ''}
                        </div>
                        <button class="btn-ghost" type="button" onclick="removeFromCart(${idx})">Quitar</button>
                    </div>
                    <div class="cart-line">
                        <div class="qty-control">
                            <button type="button" onclick="changeCartQty(${idx}, -1)">-</button>
                            <input class="qty-input" type="number" min="1" step="1" inputmode="numeric" value="${item.cantidad}" onchange="setCartQty(${idx}, this.value)">
                            <button type="button" onclick="changeCartQty(${idx}, 1)">+</button>
                        </div>
                        <div>
                            <div class="muted">Unitario: $${money(item.precio_unitario)}</div>
                            <strong>Total: $${money(item.precio_unitario * item.cantidad)}</strong>
                        </div>
                    </div>
                </div>
                `;
            }).join('') : '<div class="empty-state">No hay productos en el pedido.</div>'}
        </div>
        <div class="total-box">
            <span>Total</span>
            <span>$${money(total)}</span>
        </div>
        <button class="btn-primary" type="button" onclick="completeSale()" ${!cart.length ? 'disabled' : ''}>Completar venta</button>
    `;
    const searchInput = document.getElementById('order-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            orderSearchTerm = e.target.value.trim();
            renderCartPanel();
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
    document.getElementById(id).classList.remove('show');
    document.getElementById(id).setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal.show')) {
        document.getElementById('backdrop').classList.remove('show');
        document.body.classList.remove('modal-open');
        document.documentElement.classList.remove('modal-open');
    }
}

function openOrderModal() {
    renderCartPanel();
    openModal('order-modal');
}

function closeOrderModal() {
    closeModal('order-modal');
}

function completeSale() {
    if (!cart.length) return;
    if (!cajaActual) {
        alert('Abre la caja antes de registrar ventas.');
        return;
    }
    const total = cart.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
    pendingSale = { total, items: cart.slice() };
    openPaymentModal(total);
}

function openPaymentModal(total) {
    const cashInput = document.getElementById('payment-cash');
    const transferInput = document.getElementById('payment-transfer');
    const modal = document.getElementById('payment-modal');
    cashInput.value = total.toFixed(2);
    transferInput.value = '0.00';
    cashInput.max = total.toFixed(2);
    transferInput.max = total.toFixed(2);
    document.getElementById('payment-total').textContent = `$${money(total)}`;
    document.getElementById('payment-assigned').textContent = `$${money(total)}`;
    document.getElementById('payment-error').textContent = '';
    modal.dataset.total = String(total);
    updateAssignedPayment();
    openModal('payment-modal');
}

function closePaymentModal() {
    pendingSale = null;
    closeModal('payment-modal');
}

function updateAssignedPayment() {
    const cash = Number(document.getElementById('payment-cash').value || 0);
    const transfer = Number(document.getElementById('payment-transfer').value || 0);
    const total = Number(document.getElementById('payment-modal').dataset.total || 0);
    document.getElementById('payment-assigned').textContent = `$${money(cash + transfer)}`;
    document.getElementById('payment-error').textContent = '';
    const safe = total || 1;
    const cw = Math.max(0, Math.min(1, cash / safe));
    const tw = Math.max(0, Math.min(1, transfer / safe));
    const norm = cw + tw || 1;
    document.getElementById('payment-bar-cash').style.width = `${(cw / norm) * 100}%`;
    document.getElementById('payment-bar-transfer').style.width = `${(tw / norm) * 100}%`;
    document.getElementById('payment-bar-handle').style.left = `${(cw / norm) * 100}%`;
}

function syncPaymentInputs(source) {
    const cashInput = document.getElementById('payment-cash');
    const transferInput = document.getElementById('payment-transfer');
    const total = Number(document.getElementById('payment-modal').dataset.total || 0);
    const src = source === 'cash' ? cashInput : transferInput;
    const dst = source === 'cash' ? transferInput : cashInput;
    if (src.value === '' || src.value.endsWith('.')) { updateAssignedPayment(); return; }
    const parsed = Number(src.value);
    if (Number.isNaN(parsed)) return;
    const clamped = clampMoney(parsed, 0, total);
    if (parsed !== clamped) src.value = clamped.toFixed(2);
    dst.value = roundMoney(total - clamped).toFixed(2);
    updateAssignedPayment();
}

function updatePaymentFromBar(clientX) {
    const track = document.getElementById('payment-bar-track');
    const total = Number(document.getElementById('payment-modal').dataset.total || 0);
    if (total <= 0) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const step = 10;
    const cash = roundMoney(Math.min(total, Math.max(0, Math.round((total * ratio) / step) * step)));
    document.getElementById('payment-cash').value = cash.toFixed(2);
    document.getElementById('payment-transfer').value = roundMoney(total - cash).toFixed(2);
    updateAssignedPayment();
}

async function confirmPaymentSplit() {
    if (!pendingSale) { closePaymentModal(); return; }
    const cash = Number(document.getElementById('payment-cash').value || 0);
    const transfer = Number(document.getElementById('payment-transfer').value || 0);
    const diff = Math.abs(roundMoney(cash + transfer - pendingSale.total));
    if (cash < 0 || transfer < 0 || diff > 0.01) {
        document.getElementById('payment-error').textContent = 'Efectivo + transferencia debe coincidir con el total.';
        return;
    }
    await window.api.ventas.registrar({
        items: pendingSale.items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad, precio_unitario: i.precio_unitario })),
        subtotal_efectivo: cash,
        subtotal_transferencia: transfer
    });
    cart = [];
    pendingSale = null;
    closePaymentModal();
    closeOrderModal();
    await refreshData();
    renderProducts();
    renderCartPanel();
}

document.addEventListener('DOMContentLoaded', async () => {
    await refreshData();
    renderCategoryFilter();
    renderProducts();
    renderCartPanel();

    document.getElementById('order-toggle').addEventListener('click', openOrderModal);
    document.getElementById('backdrop').addEventListener('click', () => {
        if (document.getElementById('payment-modal').classList.contains('show')) {
            closePaymentModal();
        } else if (document.getElementById('order-modal').classList.contains('show')) {
            closeOrderModal();
        }
    });
    document.getElementById('product-search').addEventListener('input', (e) => {
        productSearchTerm = e.target.value.trim();
        renderProducts();
    });
    document.getElementById('payment-cash').addEventListener('input', () => syncPaymentInputs('cash'));
    document.getElementById('payment-transfer').addEventListener('input', () => syncPaymentInputs('transfer'));

    const track = document.getElementById('payment-bar-track');
    if (track) {
        track.addEventListener('pointerdown', (e) => {
            isDraggingPaymentBar = true;
            track.setPointerCapture(e.pointerId);
            updatePaymentFromBar(e.clientX);
        });
        track.addEventListener('pointermove', (e) => {
            if (isDraggingPaymentBar) updatePaymentFromBar(e.clientX);
        });
        track.addEventListener('pointerup', (e) => {
            isDraggingPaymentBar = false;
            track.releasePointerCapture(e.pointerId);
        });
        track.addEventListener('pointerleave', () => { isDraggingPaymentBar = false; });
    }
});

// Expose for inline handlers
window.changeProductQty = changeProductQty;
window.setProductQty = setProductQty;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.changeCartQty = changeCartQty;
window.setCartQty = setCartQty;
window.completeSale = completeSale;
window.openOrderModal = openOrderModal;
window.closeOrderModal = closeOrderModal;
window.closePaymentModal = closePaymentModal;
window.confirmPaymentSplit = confirmPaymentSplit;
