const state = {
    activeTab: 'productos',
    activeCaja: 1,
    activeFilter: 'today',
    customRange: null,
    editingProductId: null,
    editingUserId: null,
    productFormVisible: true,
    productFilters: {
        category: 'all',
        priceMin: null,
        priceMax: null,
        stockMin: null,
        stockMax: null,
        salesMin: null,
        salesMax: null
    }
};

let products = [
    {
        id: 'PRD-1001',
        name: 'Hamburguesa Doble',
        category: 'Hamburguesas',
        purchasePrice: 4500,
        salePrice: 7900,
        discountPrice: 6900,
        stock: 32,
        sales: 128,
        visibleInStore: true,
        createdAt: '2026-05-10T08:30:00',
        updatedAt: '2026-05-22T11:15:00'
    },
    {
        id: 'PRD-1002',
        name: 'Papas Grandes',
        category: 'Guarniciones',
        purchasePrice: 1600,
        salePrice: 3200,
        discountPrice: null,
        stock: 54,
        sales: 74,
        visibleInStore: false,
        createdAt: '2026-05-11T10:00:00',
        updatedAt: '2026-05-21T17:50:00'
    }
];

let users = [
    { id: 'USR-1', name: 'admin', role: 'admin', createdAt: '2026-01-01T08:00:00' },
    { id: 'USR-2', name: 'Lucia Perez', role: 'cajero', createdAt: '2026-03-05T12:30:00' },
    { id: 'USR-3', name: 'Carlos Mora', role: 'supervisor', createdAt: '2026-04-12T16:10:00' }
];

let sales = [
    {
        id: 'V-5001',
        caja: 1,
        dateTime: '2026-05-24T00:30:00',
        total: 12800,
        items: [
            { name: 'Hamburguesa Doble', qty: 1, unitPrice: 7900 },
            { name: 'Papas Grandes', qty: 1, unitPrice: 3200 },
            { name: 'Gaseosa', qty: 1, unitPrice: 1700 }
        ]
    },
    {
        id: 'V-5002',
        caja: 1,
        dateTime: '2026-05-24T10:35:00',
        total: 15800,
        items: [
            { name: 'Hamburguesa Doble', qty: 2, unitPrice: 7900 }
        ]
    },
    {
        id: 'V-5003',
        caja: 2,
        dateTime: '2026-05-23T13:20:00',
        total: 9600,
        items: [
            { name: 'Pizza Muzzarella', qty: 1, unitPrice: 9600 }
        ]
    },
    {
        id: 'V-5004',
        caja: 2,
        dateTime: '2026-05-19T18:10:00',
        total: 11100,
        items: [
            { name: 'Milanesa Completa', qty: 1, unitPrice: 8500 },
            { name: 'Gaseosa', qty: 1, unitPrice: 2600 }
        ]
    },
    {
        id: 'V-5005',
        caja: 3,
        dateTime: '2026-05-04T14:15:00',
        total: 7800,
        items: [
            { name: 'Ensalada Cesar', qty: 1, unitPrice: 7800 }
        ]
    },
    {
        id: 'V-5006',
        caja: 3,
        dateTime: '2026-04-28T21:05:00',
        total: 10200,
        items: [
            { name: 'Hamburguesa Doble', qty: 1, unitPrice: 7900 },
            { name: 'Papas Grandes', qty: 1, unitPrice: 2300 }
        ]
    }
];

let stockMovements = [];

function formatDateTime(value) {
    return new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(new Date(value));
}

function formatMoney(value) {
    return `$${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value)}`;
}

function generateId(prefix, base) {
    return `${prefix}-${String(base).padStart(4, '0')}`;
}

function normalizeNumberInput(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function getCategoryList() {
    return Array.from(
        new Set(products.map((product) => product.category || 'Sin categoria'))
    ).sort();
}

function resolveCategoryInput(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return 'Sin categoria';
    }

    const existing = getCategoryList().find(
        (category) => category.toLowerCase() === trimmed.toLowerCase()
    );

    return existing || trimmed;
}

function setProductFormVisibility(isVisible) {
    state.productFormVisible = isVisible;
    const formCard = document.getElementById('product-form-card');
    const panelGrid = document.getElementById('products-panel-grid');

    if (formCard) {
        formCard.classList.toggle('hidden', !isVisible);
    }
    if (panelGrid) {
        panelGrid.classList.toggle('single-column', !isVisible);
    }
}

function renderCategoryFilterOptions() {
    const select = document.getElementById('filter-category');
    if (!select) {
        return;
    }

    const categories = getCategoryList();

    select.innerHTML = ['<option value="all">Todas</option>']
        .concat(categories.map((category) => `<option value="${category}">${category}</option>`))
        .join('');

    if (state.productFilters.category !== 'all' && !categories.includes(state.productFilters.category)) {
        state.productFilters.category = 'all';
    }

    select.value = state.productFilters.category;
}

function renderCategorySuggestions() {
    const list = document.getElementById('product-category-list');
    if (!list) {
        return;
    }

    const options = getCategoryList()
        .map((category) => `<option value="${category}"></option>`)
        .join('');

    list.innerHTML = options;
}

function addStockMovement({ productId, name, category, before, after, reason }) {
    const delta = after - before;
    if (!delta) {
        return;
    }

    stockMovements.unshift({
        id: generateId('MOV', stockMovements.length + 1),
        productId,
        name,
        category: category || 'Sin categoria',
        before,
        after,
        delta,
        reason: reason || 'Ajuste de stock',
        createdAt: new Date().toISOString()
    });
}

function renderReports() {
    const list = document.getElementById('report-list');
    if (!list) {
        return;
    }

    if (!stockMovements.length) {
        list.innerHTML = '<div class="empty-state">No hay movimientos de stock registrados.</div>';
        return;
    }

    list.innerHTML = stockMovements
        .map((movement) => {
            const type = movement.delta > 0 ? 'entry' : 'exit';
            const label = movement.delta > 0 ? 'Entrada' : 'Salida';
            const deltaLabel = movement.delta > 0 ? `+${movement.delta}` : `${movement.delta}`;
            return `
                <div class="report-card">
                    <div class="report-head">
                        <div>
                            <strong>${movement.name}</strong>
                            <span class="muted">(${movement.productId})</span>
                        </div>
                        <span class="report-tag ${type}">${label}</span>
                    </div>
                    <div class="report-meta">
                        <span class="report-delta ${type}">${deltaLabel} uds</span>
                        <span>Categoria: ${movement.category}</span>
                        <span>Stock: ${movement.before} -> ${movement.after}</span>
                        <span>${formatDateTime(movement.createdAt)}</span>
                    </div>
                    ${movement.reason ? `<div class="muted">${movement.reason}</div>` : ''}
                </div>
            `;
        })
        .join('');
}

function setupMainTabs() {
    document.querySelectorAll('.tab-button').forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            const isSameTab = state.activeTab === targetTab;
            state.activeTab = targetTab;
            document.querySelectorAll('.tab-button').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));
            document.getElementById(`tab-${state.activeTab}`).classList.add('active');

            if (targetTab === 'productos' && isSameTab) {
                setProductFormVisibility(!state.productFormVisible);
            }
        });
    });
}

function applyProductFilters(list) {
    const {
        category,
        priceMin,
        priceMax,
        stockMin,
        stockMax,
        salesMin,
        salesMax
    } = state.productFilters;

    return list.filter((product) => {
        const salesValue = Number(product.sales || 0);

        if (category !== 'all' && (product.category || 'Sin categoria') !== category) {
            return false;
        }
        if (priceMin !== null && product.salePrice < priceMin) {
            return false;
        }
        if (priceMax !== null && product.salePrice > priceMax) {
            return false;
        }
        if (stockMin !== null && product.stock < stockMin) {
            return false;
        }
        if (stockMax !== null && product.stock > stockMax) {
            return false;
        }
        if (salesMin !== null && salesValue < salesMin) {
            return false;
        }
        if (salesMax !== null && salesValue > salesMax) {
            return false;
        }
        return true;
    });
}

function renderProducts() {
    const body = document.getElementById('products-table-body');
    renderCategoryFilterOptions();
    renderCategorySuggestions();

    const filtered = applyProductFilters(products);
    if (!filtered.length) {
        body.innerHTML = '<tr><td colspan="12"><div class="empty-state">No hay productos para el filtro seleccionado.</div></td></tr>';
        return;
    }

    body.innerHTML = filtered
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((product) => `
            <tr>
                <td>${product.id}</td>
                <td>${product.name}</td>
                <td>${product.category || 'Sin categoria'}</td>
                <td>${formatMoney(product.purchasePrice)}</td>
                <td>${formatMoney(product.salePrice)}</td>
                <td>${product.discountPrice ? formatMoney(product.discountPrice) : '-'}</td>
                <td>${product.stock}</td>
                <td>${product.sales ?? 0}</td>
                <td><span class="badge ${product.visibleInStore ? 'visible' : 'hidden'}">${product.visibleInStore ? 'Visible' : 'Oculto'}</span></td>
                <td>${formatDateTime(product.createdAt)}</td>
                <td>${formatDateTime(product.updatedAt)}</td>
                <td>
                    <div class="row-actions">
                        <button class="btn" onclick="editProduct('${product.id}')">Editar</button>
                        <button class="btn" onclick="toggleProductVisibility('${product.id}')">${product.visibleInStore ? 'Ocultar' : 'Mostrar'}</button>
                        <button class="btn danger" onclick="deleteProduct('${product.id}')">Eliminar</button>
                    </div>
                </td>
            </tr>
        `)
        .join('');
}

function resetProductForm() {
    state.editingProductId = null;
    document.getElementById('product-form-title').textContent = 'Crear producto';
    document.getElementById('product-form').reset();
    document.getElementById('show-in-store').checked = true;
}

function setupProductForm() {
    const form = document.getElementById('product-form');
    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const now = new Date().toISOString();
        const data = {
            name: document.getElementById('product-name').value.trim(),
            category: resolveCategoryInput(document.getElementById('product-category').value),
            purchasePrice: Number(document.getElementById('purchase-price').value),
            salePrice: Number(document.getElementById('sale-price').value),
            discountPrice: document.getElementById('discount-price').value ? Number(document.getElementById('discount-price').value) : null,
            stock: Number(document.getElementById('stock').value),
            visibleInStore: document.getElementById('show-in-store').checked
        };

        if (!data.name) {
            return;
        }

        if (state.editingProductId) {
            const index = products.findIndex((item) => item.id === state.editingProductId);
            if (index >= 0) {
                products[index] = {
                    ...products[index],
                    ...data,
                    updatedAt: now
                };
            }
        } else {
            const id = generateId('PRD', products.length + 1001);
            products.push({
                id,
                ...data,
                sales: 0,
                createdAt: now,
                updatedAt: now
            });
        }

        resetProductForm();
        renderProducts();
    });

    document.getElementById('cancel-product-edit').addEventListener('click', resetProductForm);
}

function updateProductFiltersUI() {
    const filterMap = {
        priceMin: 'filter-price-min',
        priceMax: 'filter-price-max',
        stockMin: 'filter-stock-min',
        stockMax: 'filter-stock-max',
        salesMin: 'filter-sales-min',
        salesMax: 'filter-sales-max'
    };

    Object.entries(filterMap).forEach(([key, id]) => {
        const input = document.getElementById(id);
        if (!input) {
            return;
        }
        input.value = state.productFilters[key] ?? '';
    });

    const categorySelect = document.getElementById('filter-category');
    if (categorySelect) {
        categorySelect.value = state.productFilters.category;
    }
}

function setupProductFilters() {
    const categorySelect = document.getElementById('filter-category');
    if (categorySelect) {
        categorySelect.addEventListener('change', (event) => {
            state.productFilters.category = event.target.value;
            renderProducts();
        });
    }

    const numericFilters = [
        ['filter-price-min', 'priceMin'],
        ['filter-price-max', 'priceMax'],
        ['filter-stock-min', 'stockMin'],
        ['filter-stock-max', 'stockMax'],
        ['filter-sales-min', 'salesMin'],
        ['filter-sales-max', 'salesMax']
    ];

    numericFilters.forEach(([id, key]) => {
        const input = document.getElementById(id);
        if (!input) {
            return;
        }
        input.addEventListener('input', (event) => {
            state.productFilters[key] = normalizeNumberInput(event.target.value);
            renderProducts();
        });
    });

    const resetButton = document.getElementById('reset-product-filters');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            state.productFilters = {
                category: 'all',
                priceMin: null,
                priceMax: null,
                stockMin: null,
                stockMax: null,
                salesMin: null,
                salesMax: null
            };
            updateProductFiltersUI();
            renderProducts();
        });
    }
}

function editProduct(productId) {
    const product = products.find((item) => item.id === productId);
    if (!product) {
        return;
    }

    state.editingProductId = product.id;
    document.getElementById('product-form-title').textContent = `Editar producto ${product.id}`;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-category').value = product.category || 'Sin categoria';
    document.getElementById('purchase-price').value = product.purchasePrice;
    document.getElementById('sale-price').value = product.salePrice;
    document.getElementById('discount-price').value = product.discountPrice ?? '';
    document.getElementById('stock').value = product.stock;
    document.getElementById('show-in-store').checked = product.visibleInStore;
    setProductFormVisibility(true);
}

function deleteProduct(productId) {
    products = products.filter((item) => item.id !== productId);
    if (state.editingProductId === productId) {
        resetProductForm();
    }
    renderProducts();
}

function toggleProductVisibility(productId) {
    const index = products.findIndex((item) => item.id === productId);
    if (index < 0) {
        return;
    }

    products[index].visibleInStore = !products[index].visibleInStore;
    products[index].updatedAt = new Date().toISOString();
    renderProducts();
}

function setupSalesFilters() {
    document.querySelectorAll('#quick-filters .btn.filter').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.activeFilter = btn.dataset.filter;
            state.customRange = null;
            document.querySelectorAll('#quick-filters .btn.filter').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            renderSales();
        });
    });

    document.querySelectorAll('.sub-tab-button').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.activeCaja = Number(btn.dataset.caja);
            document.querySelectorAll('.sub-tab-button').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            renderSales();
        });
    });

    document.getElementById('apply-custom-range').addEventListener('click', () => {
        const from = document.getElementById('from-date').value;
        const to = document.getElementById('to-date').value;
        if (!from || !to) {
            return;
        }

        state.customRange = { from, to };
        document.querySelectorAll('#quick-filters .btn.filter').forEach((b) => b.classList.remove('active'));
        renderSales();
    });
}

function getDateRangeByFilter() {
    if (state.customRange) {
        const from = new Date(`${state.customRange.from}T00:00:00`);
        const to = new Date(`${state.customRange.to}T23:59:59`);
        return { from, to };
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    if (state.activeFilter === 'today') {
        return { from: todayStart, to: now };
    }

    if (state.activeFilter === 'week') {
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 6);
        return { from: weekStart, to: now };
    }

    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 29);
    return { from: monthStart, to: now };
}

function renderSales() {
    const list = document.getElementById('sales-list');
    const { from, to } = getDateRangeByFilter();

    const filtered = sales
        .filter((sale) => sale.caja === state.activeCaja)
        .filter((sale) => {
            const date = new Date(sale.dateTime);
            return date >= from && date <= to;
        })
        .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));

    if (!filtered.length) {
        list.innerHTML = '<div class="empty-state">No hay ventas para el filtro seleccionado.</div>';
        return;
    }

    list.innerHTML = filtered
        .map((sale) => `
            <div class="sale-card">
                <div class="sale-card-top">
                    <div>
                        <strong>${sale.id}</strong>
                        <div>${formatDateTime(sale.dateTime)}</div>
                    </div>
                    <strong>${formatMoney(sale.total)}</strong>
                </div>
                <div>${sale.items.length} producto(s)</div>
                <div class="row-actions">
                    <button class="btn" onclick="showSaleDetails('${sale.id}')">Ver detalles</button>
                </div>
            </div>
        `)
        .join('');
}

function showSaleDetails(saleId) {
    const sale = sales.find((item) => item.id === saleId);
    if (!sale) {
        return;
    }

    document.getElementById('modal-title').textContent = `Detalle ${sale.id} | Caja ${sale.caja}`;
    document.getElementById('modal-content').innerHTML = sale.items
        .map((item) => `
            <div class="detail-item">
                <strong>${item.name}</strong>
                <div>Cantidad: ${item.qty}</div>
                <div>Unitario: ${formatMoney(item.unitPrice)}</div>
                <div>Subtotal: ${formatMoney(item.qty * item.unitPrice)}</div>
            </div>
        `)
        .join('');

    openModal();
}

function openModal() {
    document.getElementById('sale-details-modal').classList.add('show');
    document.getElementById('sale-details-modal').setAttribute('aria-hidden', 'false');
}

function closeModal() {
    document.getElementById('sale-details-modal').classList.remove('show');
    document.getElementById('sale-details-modal').setAttribute('aria-hidden', 'true');
}

function setupUsersForm() {
    const form = document.getElementById('user-form');
    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const name = document.getElementById('user-name').value.trim();
        const role = document.getElementById('user-role').value;
        if (!name) {
            return;
        }

        if (state.editingUserId) {
            const index = users.findIndex((item) => item.id === state.editingUserId);
            if (index >= 0) {
                users[index] = { ...users[index], name, role };
            }
        } else {
            const id = generateId('USR', users.length + 1);
            users.push({ id, name, role, createdAt: new Date().toISOString() });
        }

        resetUserForm();
        renderUsers();
    });

    document.getElementById('cancel-user-edit').addEventListener('click', resetUserForm);
}

function renderUsers() {
    const body = document.getElementById('users-table-body');
    if (!users.length) {
        body.innerHTML = '<tr><td colspan="5"><div class="empty-state">No hay usuarios registrados.</div></td></tr>';
        return;
    }

    body.innerHTML = users
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((user) => `
            <tr>
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.role}</td>
                <td>${formatDateTime(user.createdAt)}</td>
                <td>
                    <div class="row-actions">
                        <button class="btn" onclick="editUser('${user.id}')">Editar</button>
                        <button class="btn danger" onclick="deleteUser('${user.id}')" ${user.role === 'admin' ? 'disabled' : ''}>Eliminar</button>
                    </div>
                </td>
            </tr>
        `)
        .join('');
}

function resetUserForm() {
    state.editingUserId = null;
    document.getElementById('user-form-title').textContent = 'Crear usuario';
    document.getElementById('user-form').reset();
    document.getElementById('user-role').value = 'admin';
}

function editUser(userId) {
    const user = users.find((item) => item.id === userId);
    if (!user) {
        return;
    }

    state.editingUserId = user.id;
    document.getElementById('user-form-title').textContent = `Editar usuario ${user.id}`;
    document.getElementById('user-name').value = user.name;
    document.getElementById('user-role').value = user.role;
}

function deleteUser(userId) {
    const user = users.find((item) => item.id === userId);
    if (!user || user.role === 'admin') {
        return;
    }

    users = users.filter((item) => item.id !== userId);
    if (state.editingUserId === userId) {
        resetUserForm();
    }
    renderUsers();
}

function setupModalEvents() {
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('modal-backdrop').addEventListener('click', closeModal);
}

document.addEventListener('DOMContentLoaded', () => {
    setupMainTabs();
    setupProductForm();
    setupProductFilters();
    setupSalesFilters();
    setupUsersForm();
    setupModalEvents();

    renderProducts();
    renderSales();
    renderUsers();

    window.editProduct = editProduct;
    window.deleteProduct = deleteProduct;
    window.toggleProductVisibility = toggleProductVisibility;
    window.showSaleDetails = showSaleDetails;
    window.editUser = editUser;
    window.deleteUser = deleteUser;
});
