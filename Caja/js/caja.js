const products = [
    { id: 1, name: 'Hamburguesa Simple', price: 5000 },
    { id: 2, name: 'Papas Fritas', price: 2500 },
    { id: 3, name: 'Gaseosa Cola', price: 1500 },
    { id: 4, name: 'Helado Vainilla', price: 3000 },
    { id: 5, name: 'Pizza Muzzarella', price: 8000 },
    { id: 6, name: 'Cerveza Artesanal', price: 4000 }
];

let cart = [
    { id: 1, name: 'Hamburguesa Simple', price: 5000, qty: 1, payment: 'Efectivo' },
    { id: 3, name: 'Gaseosa Cola', price: 1500, qty: 2, payment: 'Transferencia' }
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
let orderPanelSize = 'large';

function toggleTheme() {
    const html = document.documentElement;
    const isDarkMode = html.classList.contains('dark-mode');

    if (isDarkMode) {
        html.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
        updateThemeIcon(false);
    } else {
        html.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
        updateThemeIcon(true);
    }
}

function updateThemeIcon(isDarkMode) {
    const icon = document.querySelector('.theme-icon');
    if (icon) {
        icon.textContent = isDarkMode ? '☀️' : '🌙';
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const html = document.documentElement;

    if (savedTheme === 'dark') {
        html.classList.add('dark-mode');
        updateThemeIcon(true);
    } else {
        html.classList.remove('dark-mode');
        updateThemeIcon(false);
    }
}

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
            <select class="payment-type" id="payment-${product.id}">
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
            </select>
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
    const payment = document.getElementById(`payment-${productId}`).value;

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
    const sale = {
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

    historySales.unshift(sale);
    cart = [];
    renderRightPanel();
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
    body.innerHTML = `
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
    const content = document.getElementById('right-content');
    renderCartPanel(content);
}

function renderCartPanel(container) {
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    container.innerHTML = `
        <div class="order-content-head">
            <h3>Pedido Actual</h3>
            <p class="muted">Revisa y ajusta los productos agregados.</p>
        </div>
        <div class="cart-list">
            ${cart.length ? cart.map((item, index) => `
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
            `).join('') : '<div class="empty-state">No hay productos cargados en la venta actual.</div>'}
        </div>
        <div class="total-box">
            <span>Total</span>
            <span>$${money(total)}</span>
        </div>
        <button class="btn-primary" type="button" onclick="completeSale()">Completar venta</button>
    `;
}

function toggleOrderPanelSize(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    orderPanelSize = orderPanelSize === 'large' ? 'compact' : 'large';
    const panel = document.querySelector('.right-panel');
    if (!panel) {
        return;
    }

    panel.classList.toggle('size-compact', orderPanelSize === 'compact');
    panel.classList.toggle('size-large', orderPanelSize === 'large');

    const button = document.querySelector('.order-size-btn');
    if (button) {
        button.textContent = orderPanelSize === 'compact' ? 'Más grande' : 'Más pequeño';
    }
}

function syncOrderPanelSizeButton() {
    const button = document.querySelector('.order-size-btn');
    if (button) {
        button.textContent = orderPanelSize === 'compact' ? 'Más grande' : 'Más pequeño';
    }
}

function openModal(id) {
    document.getElementById('backdrop').classList.add('show');
    document.getElementById(id).classList.add('show');
    document.getElementById(id).setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
    document.getElementById('backdrop').classList.remove('show');
    document.getElementById(id).classList.remove('show');
    document.getElementById(id).setAttribute('aria-hidden', 'true');
}

function updateProductSearch(value) {
    productSearchTerm = value.trim();
    renderProducts();
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderProducts();
    renderRightPanel();
    const panel = document.querySelector('.right-panel');
    if (panel) {
        const isMobile = window.matchMedia('(max-width: 760px)').matches;
        orderPanelSize = isMobile ? 'compact' : 'large';
        panel.classList.add(isMobile ? 'size-compact' : 'size-large');
    }
    syncOrderPanelSizeButton();
    document.getElementById('backdrop').addEventListener('click', () => closeModal('sale-details-modal'));
    document.getElementById('product-search').addEventListener('input', (event) => {
        updateProductSearch(event.target.value);
    });
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
});