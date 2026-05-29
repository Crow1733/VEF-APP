const state = {
    activeTab: 'productos',
    activeFilter: 'today',
    customRange: null,
    activeCajaTab: null,
    editingProductId: null,
    editingCategoryId: null,
    editingUserId: null,
    productFormVisible: true,
    productFilters: {
        category: 'all',
        tipo: 'all',
        priceMin: null,
        priceMax: null,
        stockMin: null,
        stockMax: null
    },
    reportFilter: 'week',
    reportRange: null
};

const ROLE_LABELS = {
    admin: 'Administrador',
    cajero: 'Cajero'
};

const TIPO_PAGO_LABELS = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    mixto: 'Mixto'
};

let cache = {
    categorias: [],
    productos: [],
    ventas: [],
    cajas: [],
    compras: [],
    consignaciones: [],
    usuarios: []
};

let pendingConfirm = null;

// ============================================================================
// Helpers
// ============================================================================
function formatDateTime(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatDate(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short' }).format(new Date(value));
}

function formatMoney(value) {
    const n = Number(value) || 0;
    return `$${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n)}`;
}

function normalizeNumberInput(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
}

async function refreshCache() {
    [cache.categorias, cache.productos, cache.ventas, cache.cajas, cache.compras, cache.consignaciones, cache.usuarios] =
        await Promise.all([
            window.api.categorias.listar(),
            window.api.productos.listar(),
            window.api.ventas.listar(),
            window.api.cajas.listar(),
            window.api.compras.listar(),
            window.api.consignaciones.listar(),
            window.api.usuarios.listar()
        ]);
}

// ============================================================================
// Modales
// ============================================================================
function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    document.body.classList.add('modal-open');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal.show')) {
        document.body.classList.remove('modal-open');
    }
}

function setupModalCloseHandlers() {
    document.querySelectorAll('[data-close-modal]').forEach((el) => {
        el.addEventListener('click', () => closeModal(el.dataset.closeModal));
    });
}

function showConfirm({ title, text, okLabel = 'Confirmar', danger = true, onConfirm }) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-text').textContent = text;
    const okBtn = document.getElementById('confirm-ok-btn');
    okBtn.textContent = okLabel;
    okBtn.classList.toggle('danger', danger);
    pendingConfirm = onConfirm;
    openModal('generic-confirm-modal');
}

// ============================================================================
// Tabs principales
// ============================================================================
function setupMainTabs() {
    document.querySelectorAll('.main-tabs .tab-button').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.activeTab = btn.dataset.tab;
            document.querySelectorAll('.main-tabs .tab-button').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
            document.getElementById(`tab-${state.activeTab}`).classList.add('active');
            renderActiveTab();
        });
    });
}

function renderActiveTab() {
    switch (state.activeTab) {
        case 'productos': renderProducts(); break;
        case 'categorias': renderCategories(); break;
        case 'ventas': renderSales(); break;
        case 'caja': renderCajaTab(); break;
        case 'compras': renderCompras(); break;
        case 'consignacion': renderConsignaciones(); break;
        case 'reportes': renderReportes(); break;
        case 'usuarios': renderUsers(); break;
    }
}

// ============================================================================
// PRODUCTOS
// ============================================================================
function setProductFormVisibility(isVisible) {
    state.productFormVisible = isVisible;
    document.getElementById('product-form-card')?.classList.toggle('hidden', !isVisible);
    document.getElementById('products-panel-grid')?.classList.toggle('single-column', !isVisible);
    const toggle = document.getElementById('toggle-product-form');
    if (toggle) {
        toggle.textContent = isVisible ? 'Ocultar formulario' : 'Crear producto';
    }
}

function renderCategorySelects() {
    const propias = cache.categorias.filter((c) => c.activa);

    const productCategory = document.getElementById('product-category');
    if (productCategory) {
        const current = productCategory.value;
        productCategory.innerHTML = propias
            .map((c) => `<option value="${c.id}">${c.nombre}${c.es_consignacion ? ' (consignación)' : ''}</option>`)
            .join('');
        if (current) productCategory.value = current;
    }

    const filterCategory = document.getElementById('filter-category');
    if (filterCategory) {
        filterCategory.innerHTML = ['<option value="all">Todas</option>']
            .concat(propias.map((c) => `<option value="${c.id}">${c.nombre}</option>`))
            .join('');
        filterCategory.value = state.productFilters.category;
    }
}

function applyProductFilters(list) {
    const f = state.productFilters;
    return list.filter((p) => {
        if (f.category !== 'all' && String(p.categoria_id) !== String(f.category)) return false;
        if (f.tipo !== 'all' && p.tipo_producto !== f.tipo) return false;
        if (f.priceMin !== null && p.precio_venta < f.priceMin) return false;
        if (f.priceMax !== null && p.precio_venta > f.priceMax) return false;
        if (f.stockMin !== null && p.stock_actual < f.stockMin) return false;
        if (f.stockMax !== null && p.stock_actual > f.stockMax) return false;
        return true;
    });
}

function renderProducts() {
    renderCategorySelects();
    const body = document.getElementById('products-table-body');
    const filtered = applyProductFilters(cache.productos);
    if (!filtered.length) {
        body.innerHTML = '<tr class="table-empty-row"><td colspan="12"><div class="empty-state">No hay productos para el filtro seleccionado.</div></td></tr>';
        return;
    }
    body.innerHTML = filtered
        .sort((a, b) => a.id - b.id)
        .map((p) => `
            <tr>
                <td data-label="ID">#${p.id}</td>
                <td data-label="Foto">${p.imagen ? `<img class="product-thumb" src="${p.imagen}" alt="${p.nombre}" loading="lazy">` : '<span class="muted">—</span>'}</td>
                <td data-label="Código">${p.codigo || '-'}</td>
                <td data-label="Nombre">${p.nombre}</td>
                <td data-label="Categoría">${p.categoria_nombre}</td>
                <td data-label="Tipo">${p.tipo_producto === 'consignacion' ? `<span class="badge hidden">Consignación${p.consignador ? ' · ' + p.consignador : ''}</span>` : '<span class="badge visible">Propio</span>'}</td>
                <td data-label="Costo">${formatMoney(p.costo)}</td>
                <td data-label="Venta">${formatMoney(p.precio_venta)}</td>
                <td data-label="Ganancia">${formatMoney(p.ganancia)}</td>
                <td data-label="Stock">${p.stock_actual}</td>
                <td data-label="Vendidos">${p.vendidos}</td>
                <td data-label="Acciones">
                    <div class="row-actions">
                        <button class="btn" onclick="editProduct(${p.id})">Editar</button>
                        <button class="btn danger" onclick="deleteProduct(${p.id})">Eliminar</button>
                    </div>
                </td>
            </tr>
        `).join('');
}

function recalcProductProfit() {
    const cost = Number(document.getElementById('product-cost').value) || 0;
    const sale = Number(document.getElementById('product-sale-price').value) || 0;
    document.getElementById('product-profit').value = formatMoney(sale - cost);
}

function resetProductForm() {
    state.editingProductId = null;
    document.getElementById('product-form-title').textContent = 'Crear producto';
    document.getElementById('product-form').reset();
    document.getElementById('product-unit').value = 'unidad';
    document.getElementById('product-profit').value = '';
    document.getElementById('consignador-wrap').classList.add('hidden');
    const fileInput = document.getElementById('product-image-file');
    if (fileInput) fileInput.value = '';
    setImagePreview('');
}

function setImagePreview(src) {
    const preview = document.getElementById('product-image-preview');
    if (!preview) return;
    const img = preview.querySelector('img');
    const value = (src || '').trim();
    if (!value) {
        preview.classList.remove('show');
        if (img) img.src = '';
        return;
    }
    preview.classList.add('show');
    if (img) img.src = value;
}

function getEditingImage() {
    if (!state.editingProductId) return '';
    const p = cache.productos.find((x) => x.id === state.editingProductId);
    return p ? (p.imagen || '') : '';
}

function readFileAsDataUrl(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
    });
}

function setupProductForm() {
    document.getElementById('product-type').addEventListener('change', (e) => {
        document.getElementById('consignador-wrap').classList.toggle('hidden', e.target.value !== 'consignacion');
    });
    document.getElementById('product-cost').addEventListener('input', recalcProductProfit);
    document.getElementById('product-sale-price').addEventListener('input', recalcProductProfit);

    document.getElementById('product-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = {
            nombre: document.getElementById('product-name').value.trim(),
            codigo: document.getElementById('product-code').value.trim(),
            categoria_id: Number(document.getElementById('product-category').value),
            tipo_producto: document.getElementById('product-type').value,
            consignador: document.getElementById('product-consignador').value.trim() || null,
            costo: Number(document.getElementById('product-cost').value),
            precio_venta: Number(document.getElementById('product-sale-price').value),
            unidad: document.getElementById('product-unit').value.trim() || 'unidad',
            stock_inicial: Number(document.getElementById('product-stock').value)
        };
        if (!payload.nombre || !payload.categoria_id) return;

        const fileInput = document.getElementById('product-image-file');
        const file = fileInput && fileInput.files ? fileInput.files[0] : null;
        if (file) {
            payload.imagen = await readFileAsDataUrl(file);
        } else if (state.editingProductId) {
            payload.imagen = getEditingImage();
        } else {
            payload.imagen = '';
        }

        if (state.editingProductId) {
            await window.api.productos.actualizar(state.editingProductId, {
                ...payload,
                stock_actual: payload.stock_inicial
            });
        } else {
            await window.api.productos.crear(payload);
        }
        await refreshCache();
        resetProductForm();
        renderProducts();
    });

    document.getElementById('product-image-file').addEventListener('change', async (event) => {
        const file = event.target.files && event.target.files[0];
        if (file) {
            const dataUrl = await readFileAsDataUrl(file);
            setImagePreview(dataUrl);
        } else {
            setImagePreview(getEditingImage());
        }
    });

    document.getElementById('cancel-product-edit').addEventListener('click', resetProductForm);
    document.getElementById('toggle-product-form').addEventListener('click', () => {
        setProductFormVisibility(!state.productFormVisible);
    });
}

function setupProductFilters() {
    document.getElementById('filter-category').addEventListener('change', (e) => {
        state.productFilters.category = e.target.value;
        renderProducts();
    });
    document.getElementById('filter-type').addEventListener('change', (e) => {
        state.productFilters.tipo = e.target.value;
        renderProducts();
    });
    const numericFilters = [
        ['filter-price-min', 'priceMin'],
        ['filter-price-max', 'priceMax'],
        ['filter-stock-min', 'stockMin'],
        ['filter-stock-max', 'stockMax']
    ];
    numericFilters.forEach(([id, key]) => {
        document.getElementById(id).addEventListener('input', (e) => {
            state.productFilters[key] = normalizeNumberInput(e.target.value);
            renderProducts();
        });
    });
    document.getElementById('reset-product-filters').addEventListener('click', () => {
        state.productFilters = { category: 'all', tipo: 'all', priceMin: null, priceMax: null, stockMin: null, stockMax: null };
        document.getElementById('filter-category').value = 'all';
        document.getElementById('filter-type').value = 'all';
        ['filter-price-min', 'filter-price-max', 'filter-stock-min', 'filter-stock-max'].forEach((id) => {
            document.getElementById(id).value = '';
        });
        renderProducts();
    });
}

function editProduct(id) {
    const p = cache.productos.find((x) => x.id === id);
    if (!p) return;
    state.editingProductId = id;
    document.getElementById('product-form-title').textContent = `Editar producto #${id}`;
    document.getElementById('product-name').value = p.nombre;
    document.getElementById('product-code').value = p.codigo || '';
    document.getElementById('product-category').value = p.categoria_id;
    document.getElementById('product-type').value = p.tipo_producto;
    document.getElementById('product-consignador').value = p.consignador || '';
    document.getElementById('consignador-wrap').classList.toggle('hidden', p.tipo_producto !== 'consignacion');
    document.getElementById('product-cost').value = p.costo;
    document.getElementById('product-sale-price').value = p.precio_venta;
    document.getElementById('product-unit').value = p.unidad || 'unidad';
    document.getElementById('product-stock').value = p.stock_actual;
    const fileInput = document.getElementById('product-image-file');
    if (fileInput) fileInput.value = '';
    setImagePreview(p.imagen || '');
    recalcProductProfit();
    setProductFormVisibility(true);
    document.getElementById('product-form-card').scrollIntoView({ behavior: 'smooth' });
}

function deleteProduct(id) {
    const p = cache.productos.find((x) => x.id === id);
    if (!p) return;
    showConfirm({
        title: `Eliminar ${p.nombre}`,
        text: `Esta acción eliminará el producto #${id} de forma permanente.`,
        okLabel: 'Sí, eliminar',
        onConfirm: async () => {
            await window.api.productos.eliminar(id);
            await refreshCache();
            if (state.editingProductId === id) resetProductForm();
            renderProducts();
        }
    });
}

// ============================================================================
// CATEGORÍAS
// ============================================================================
function renderCategories() {
    const body = document.getElementById('categories-table-body');
    if (!cache.categorias.length) {
        body.innerHTML = '<tr class="table-empty-row"><td colspan="4"><div class="empty-state">No hay categorías.</div></td></tr>';
        return;
    }
    body.innerHTML = cache.categorias
        .sort((a, b) => a.id - b.id)
        .map((c) => `
            <tr>
                <td data-label="ID">#${c.id}</td>
                <td data-label="Nombre">${c.nombre}</td>
                <td data-label="Tipo">${c.es_consignacion ? '<span class="badge hidden">Consignación</span>' : '<span class="badge visible">Propia</span>'}</td>
                <td data-label="Acciones">
                    <div class="row-actions">
                        <button class="btn" onclick="editCategory(${c.id})">Editar</button>
                        <button class="btn danger" onclick="deleteCategory(${c.id})">Eliminar</button>
                    </div>
                </td>
            </tr>
        `).join('');
}

function setupCategoryForm() {
    document.getElementById('category-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = {
            nombre: document.getElementById('category-name').value.trim(),
            es_consignacion: document.getElementById('category-is-consignacion').checked
        };
        if (!payload.nombre) return;
        if (state.editingCategoryId) {
            await window.api.categorias.actualizar(state.editingCategoryId, payload);
        } else {
            await window.api.categorias.crear(payload);
        }
        await refreshCache();
        resetCategoryForm();
        renderCategories();
        renderCategorySelects();
    });
    document.getElementById('cancel-category-edit').addEventListener('click', resetCategoryForm);
}

function resetCategoryForm() {
    state.editingCategoryId = null;
    document.getElementById('category-form-title').textContent = 'Crear categoría';
    document.getElementById('category-form').reset();
}

function editCategory(id) {
    const c = cache.categorias.find((x) => x.id === id);
    if (!c) return;
    state.editingCategoryId = id;
    document.getElementById('category-form-title').textContent = `Editar categoría #${id}`;
    document.getElementById('category-name').value = c.nombre;
    document.getElementById('category-is-consignacion').checked = !!c.es_consignacion;
}

function deleteCategory(id) {
    const c = cache.categorias.find((x) => x.id === id);
    if (!c) return;
    showConfirm({
        title: `Eliminar ${c.nombre}`,
        text: `¿Confirmas borrar la categoría #${id}? No podrá eliminarse si tiene productos asociados.`,
        okLabel: 'Sí, eliminar',
        onConfirm: async () => {
            const res = await window.api.categorias.eliminar(id);
            if (!res.ok) {
                alert('No se puede eliminar: hay productos en esta categoría.');
                return;
            }
            await refreshCache();
            renderCategories();
        }
    });
}

// ============================================================================
// VENTAS
// ============================================================================
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
    document.getElementById('apply-custom-range').addEventListener('click', () => {
        const from = document.getElementById('from-date').value;
        const to = document.getElementById('to-date').value;
        if (!from || !to) return;
        state.customRange = { from, to };
        document.querySelectorAll('#quick-filters .btn.filter').forEach((b) => b.classList.remove('active'));
        renderSales();
    });
}

function getSalesDateRange() {
    if (state.customRange) {
        return { from: new Date(`${state.customRange.from}T00:00:00`), to: new Date(`${state.customRange.to}T23:59:59`) };
    }
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (state.activeFilter === 'today') return { from: todayStart, to: now };
    if (state.activeFilter === 'week') {
        const from = new Date(todayStart);
        from.setDate(from.getDate() - 6);
        return { from, to: now };
    }
    const from = new Date(todayStart);
    from.setDate(from.getDate() - 29);
    return { from, to: now };
}

function renderSalesSubTabs() {
    const container = document.getElementById('sales-sub-tabs');
    if (!cache.cajas.length) {
        container.innerHTML = '';
        return;
    }
    if (!state.activeCajaTab) {
        const abierta = cache.cajas.find((c) => c.estado === 'abierta');
        state.activeCajaTab = abierta ? abierta.id : cache.cajas[0].id;
    }
    container.innerHTML = cache.cajas
        .sort((a, b) => b.id - a.id)
        .map((c) => `
            <button class="sub-tab-button ${state.activeCajaTab === c.id ? 'active' : ''}" data-caja-id="${c.id}">
                Caja #${c.id} ${c.estado === 'abierta' ? '· activa' : ''}
            </button>
        `).join('');
    container.querySelectorAll('.sub-tab-button').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.activeCajaTab = Number(btn.dataset.cajaId);
            renderSalesSubTabs();
            renderSales();
        });
    });
}

function renderSales() {
    renderSalesSubTabs();
    const list = document.getElementById('sales-list');
    const { from, to } = getSalesDateRange();
    const filtered = cache.ventas
        .filter((v) => v.caja_id === state.activeCajaTab)
        .filter((v) => {
            const d = new Date(v.fecha);
            return d >= from && d <= to;
        });
    if (!filtered.length) {
        list.innerHTML = '<div class="empty-state">No hay ventas en este rango.</div>';
        return;
    }
    list.innerHTML = filtered.map((v) => `
        <div class="sale-card">
            <div class="sale-card-top">
                <div>
                    <strong>Venta #${v.id}</strong>
                    <div class="muted">${formatDateTime(v.fecha)}</div>
                </div>
                <div style="text-align:right;">
                    <strong>${formatMoney(v.total)}</strong>
                    <div class="muted">${TIPO_PAGO_LABELS[v.tipo_pago] || v.tipo_pago}</div>
                </div>
            </div>
            <div class="muted">
                ${v.items.length} producto(s) ·
                Efectivo ${formatMoney(v.subtotal_efectivo)} · Transferencia ${formatMoney(v.subtotal_transferencia)}
                ${v.es_consignacion ? '· <span class="badge hidden">Consignación</span>' : ''}
                ${v.estado === 'cancelada' ? '· <span class="badge hidden">Cancelada</span>' : ''}
            </div>
            <div class="row-actions">
                <button class="btn" onclick="showSaleDetails(${v.id})">Ver detalles</button>
            </div>
        </div>
    `).join('');
}

function showSaleDetails(id) {
    const sale = cache.ventas.find((v) => v.id === id);
    if (!sale) return;
    document.getElementById('modal-title').textContent = `Detalle venta #${sale.id}`;
    const itemsHtml = sale.items.map((item) => `
        <div class="detail-item">
            <strong>${item.producto_nombre}</strong>
            <div class="muted">Categoría: ${item.categoria_nombre || '-'}</div>
            <div>Cantidad: ${item.cantidad} · Unitario: ${formatMoney(item.precio_unitario)}</div>
            <div>Subtotal: <strong>${formatMoney(item.subtotal)}</strong></div>
            ${item.es_consignacion ? '<span class="badge hidden">Consignación</span>' : ''}
        </div>
    `).join('');
    document.getElementById('modal-content').innerHTML = `
        <div class="detail-item">
            <div class="muted">${formatDateTime(sale.fecha)}</div>
            <div>Tipo de pago: <strong>${TIPO_PAGO_LABELS[sale.tipo_pago] || sale.tipo_pago}</strong></div>
            <div>Efectivo: <strong>${formatMoney(sale.subtotal_efectivo)}</strong></div>
            <div>Transferencia: <strong>${formatMoney(sale.subtotal_transferencia)}</strong></div>
            <div>Total: <strong>${formatMoney(sale.total)}</strong></div>
        </div>
        ${itemsHtml}
    `;
    openModal('sale-details-modal');
}

// ============================================================================
// CAJA
// ============================================================================
function renderCajaTab() {
    const caja = cache.cajas.find((c) => c.estado === 'abierta');
    const content = document.getElementById('caja-actual-content');
    if (caja) {
        renderCajaActual(caja, content);
    } else {
        content.innerHTML = `
            <p class="muted">No hay caja abierta en este momento.</p>
            <p class="muted">Las cajas se abren desde el panel de Caja con el efectivo inicial.</p>
        `;
    }

    const body = document.getElementById('cajas-table-body');
    if (!cache.cajas.length) {
        body.innerHTML = '<tr class="table-empty-row"><td colspan="8"><div class="empty-state">Aún no hay cajas registradas.</div></td></tr>';
        return;
    }
    body.innerHTML = cache.cajas
        .sort((a, b) => b.id - a.id)
        .map((c) => `
            <tr>
                <td data-label="ID">#${c.id}</td>
                <td data-label="Apertura">${formatDateTime(c.fecha_apertura)}</td>
                <td data-label="Cierre">${formatDateTime(c.fecha_cierre)}</td>
                <td data-label="Inicial">${formatMoney(c.efectivo_inicial)}</td>
                <td data-label="Contado">${c.efectivo_contado != null ? formatMoney(c.efectivo_contado) : '-'}</td>
                <td data-label="Diferencia">${c.diferencia != null ? `<span class="${c.diferencia < 0 ? 'report-delta exit' : 'report-delta entry'}">${formatMoney(c.diferencia)}</span>` : '-'}</td>
                <td data-label="Estado">${c.estado === 'abierta' ? '<span class="badge visible">Abierta</span>' : '<span class="badge hidden">Cerrada</span>'}</td>
                <td data-label="Acciones">
                    <div class="row-actions">
                        <button class="btn" onclick="verCajaDesglose(${c.id})">Ver desglose</button>
                        ${c.estado === 'abierta' ? `<button class="btn danger" onclick="abrirCierreCaja(${c.id})">Cerrar</button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
}

async function renderCajaActual(caja, container) {
    const d = await window.api.cajas.desgloseEfectivo(caja.id);
    container.innerHTML = `
        <div class="report-card">
            <div class="report-head">
                <strong>Caja #${caja.id} · ${formatDateTime(caja.fecha_apertura)}</strong>
                <span class="badge visible">Abierta</span>
            </div>
            <div class="report-meta">
                <span>Efectivo inicial: <strong>${formatMoney(d.efectivo_inicial)}</strong></span>
                <span>Ventas efectivo: <strong>${formatMoney(d.ventas_efectivo)}</strong></span>
                <span>Ventas transferencia: <strong>${formatMoney(d.ventas_transferencia)}</strong></span>
                <span>Extracciones: <strong>${formatMoney(d.extracciones)}</strong></span>
                <span>Compras mercancía: <strong>${formatMoney(d.compras_mercancia)}</strong></span>
                <span>Pagos varios: <strong>${formatMoney(d.pagos_varios)}</strong></span>
                <span>Efectivo esperado: <strong>${formatMoney(d.efectivo_esperado)}</strong></span>
            </div>
            <div class="actions-row">
                <button class="btn danger" onclick="abrirCierreCaja(${caja.id})">Cerrar caja</button>
            </div>
        </div>
    `;
}

async function verCajaDesglose(id) {
    const caja = cache.cajas.find((c) => c.id === id);
    const d = await window.api.cajas.desgloseEfectivo(id);
    document.getElementById('modal-title').textContent = `Desglose caja #${id}`;
    document.getElementById('modal-content').innerHTML = `
        <div class="detail-item">
            <div class="muted">Apertura: ${formatDateTime(caja.fecha_apertura)}</div>
            <div class="muted">Cierre: ${formatDateTime(caja.fecha_cierre)}</div>
        </div>
        <div class="detail-item">
            <div>Efectivo inicial: <strong>${formatMoney(d.efectivo_inicial)}</strong></div>
            <div>+ Ventas en efectivo: <strong>${formatMoney(d.ventas_efectivo)}</strong></div>
            <div>− Extracciones: <strong>${formatMoney(d.extracciones)}</strong></div>
            <div>− Compras mercancía: <strong>${formatMoney(d.compras_mercancia)}</strong></div>
            <div>− Pagos varios: <strong>${formatMoney(d.pagos_varios)}</strong></div>
            <div>= Efectivo esperado: <strong>${formatMoney(d.efectivo_esperado)}</strong></div>
        </div>
        <div class="detail-item">
            <div>Efectivo contado: <strong>${caja.efectivo_contado != null ? formatMoney(caja.efectivo_contado) : '-'}</strong></div>
            <div>Diferencia: <strong>${caja.diferencia != null ? formatMoney(caja.diferencia) : '-'}</strong></div>
        </div>
        <div class="detail-item">
            <div class="muted">Ventas por transferencia: <strong>${formatMoney(d.ventas_transferencia)}</strong></div>
        </div>
    `;
    openModal('sale-details-modal');
}

async function abrirCierreCaja(id) {
    const caja = cache.cajas.find((c) => c.id === id);
    const d = await window.api.cajas.desgloseEfectivo(id);
    document.getElementById('cierre-caja-content').innerHTML = `
        <div class="detail-item">
            <div>Caja #${caja.id}</div>
            <div>Efectivo esperado: <strong>${formatMoney(d.efectivo_esperado)}</strong></div>
        </div>
        <label class="form-grid" style="display:grid; gap:8px;">
            Efectivo contado
            <input type="number" id="cierre-efectivo-contado" min="0" step="0.01" value="${d.efectivo_esperado}">
        </label>
        <label class="form-grid" style="display:grid; gap:8px;">
            Observación
            <input type="text" id="cierre-observacion" placeholder="Ej: diferencia por vuelto">
        </label>
        <div class="detail-actions">
            <button class="btn" data-close-modal="cierre-caja-modal">Cancelar</button>
            <button class="btn danger" id="confirm-cierre-caja">Cerrar caja</button>
        </div>
    `;
    document.getElementById('cierre-caja-modal').querySelectorAll('[data-close-modal]').forEach((el) => {
        el.addEventListener('click', () => closeModal(el.dataset.closeModal));
    });
    document.getElementById('confirm-cierre-caja').addEventListener('click', async () => {
        const contado = Number(document.getElementById('cierre-efectivo-contado').value) || 0;
        const obs = document.getElementById('cierre-observacion').value.trim();
        await window.api.cajas.cerrar(id, contado, obs);
        await refreshCache();
        closeModal('cierre-caja-modal');
        renderCajaTab();
    });
    openModal('cierre-caja-modal');
}

// ============================================================================
// COMPRAS
// ============================================================================
function renderCompras() {
    const list = document.getElementById('compras-list');
    if (!cache.compras.length) {
        list.innerHTML = '<div class="empty-state">Aún no se han registrado compras.</div>';
        return;
    }
    list.innerHTML = cache.compras
        .sort((a, b) => b.id - a.id)
        .map((c) => `
            <div class="report-card">
                <div class="report-head">
                    <div>
                        <strong>Compra #${c.id}</strong>
                        <div class="muted">${formatDateTime(c.fecha)}</div>
                    </div>
                    <span class="report-tag exit">${formatMoney(c.total)}</span>
                </div>
                <div class="report-meta">
                    <span>Procedencia: ${c.procedencia || '-'}</span>
                    <span>Método: ${c.metodo_pago}</span>
                    <span>${c.descuenta_fondo ? 'Descuenta del fondo' : 'Sin descuento de fondo'}</span>
                </div>
                <div>
                    ${c.items.map((i) => `<span class="muted">· ${i.producto_nombre} × ${i.cantidad} a ${formatMoney(i.costo_unitario)} = <strong>${formatMoney(i.subtotal)}</strong></span><br>`).join('')}
                </div>
                ${c.observacion ? `<div class="muted">${c.observacion}</div>` : ''}
            </div>
        `).join('');
}

function abrirModalCompra() {
    const opciones = cache.productos
        .filter((p) => p.tipo_producto !== 'consignacion')
        .map((p) => `<option value="${p.id}">${p.nombre} (stock ${p.stock_actual})</option>`).join('');
    document.getElementById('compra-modal-content').innerHTML = `
        <div class="form-grid">
            <label>
                Procedencia (texto libre)
                <input type="text" id="compra-procedencia" placeholder="Ej: Mayorista del centro">
            </label>
            <label>
                Método de pago
                <select id="compra-metodo">
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                </select>
            </label>
            <label class="inline-row">
                <input type="checkbox" id="compra-descuenta" checked>
                Descuenta del fondo de caja
            </label>
            <label>
                Observación
                <input type="text" id="compra-obs">
            </label>
        </div>
        <h4 style="margin-bottom:6px;">Items de la compra</h4>
        <div id="compra-items"></div>
        <div class="actions-row">
            <button class="btn" id="add-compra-item">+ Agregar item</button>
        </div>
        <div class="detail-actions">
            <button class="btn" data-close-modal="compra-modal">Cancelar</button>
            <button class="btn primary" id="confirm-compra">Guardar compra</button>
        </div>
    `;

    function renderItems(items) {
        document.getElementById('compra-items').innerHTML = items.map((_, idx) => `
            <div class="detail-item">
                <div class="form-grid" style="grid-template-columns: 2fr 1fr 1fr;">
                    <label>Producto
                        <select data-idx="${idx}" data-field="producto_id">${opciones}</select>
                    </label>
                    <label>Cantidad
                        <input type="number" min="1" step="1" data-idx="${idx}" data-field="cantidad" value="1">
                    </label>
                    <label>Costo unitario
                        <input type="number" min="0" step="0.01" data-idx="${idx}" data-field="costo_unitario" value="0">
                    </label>
                </div>
            </div>
        `).join('');
    }

    let items = [{}];
    renderItems(items);

    document.getElementById('add-compra-item').addEventListener('click', () => {
        items.push({});
        renderItems(items);
    });

    document.getElementById('compra-modal').querySelectorAll('[data-close-modal]').forEach((el) => {
        el.addEventListener('click', () => closeModal(el.dataset.closeModal));
    });

    document.getElementById('confirm-compra').addEventListener('click', async () => {
        const itemsPayload = items.map((_, idx) => ({
            producto_id: Number(document.querySelector(`[data-idx="${idx}"][data-field="producto_id"]`).value),
            cantidad: Number(document.querySelector(`[data-idx="${idx}"][data-field="cantidad"]`).value),
            costo_unitario: Number(document.querySelector(`[data-idx="${idx}"][data-field="costo_unitario"]`).value)
        })).filter((i) => i.producto_id && i.cantidad > 0);
        if (!itemsPayload.length) {
            alert('Agrega al menos un item.');
            return;
        }
        await window.api.compras.registrar({
            procedencia: document.getElementById('compra-procedencia').value.trim(),
            metodo_pago: document.getElementById('compra-metodo').value,
            descuenta_fondo: document.getElementById('compra-descuenta').checked,
            observacion: document.getElementById('compra-obs').value.trim(),
            items: itemsPayload
        });
        await refreshCache();
        closeModal('compra-modal');
        renderCompras();
    });

    openModal('compra-modal');
}

// ============================================================================
// CONSIGNACIONES
// ============================================================================
function renderConsignaciones() {
    const list = document.getElementById('consignaciones-list');
    if (!cache.consignaciones.length) {
        list.innerHTML = '<div class="empty-state">Sin consignaciones registradas.</div>';
        return;
    }
    list.innerHTML = cache.consignaciones
        .sort((a, b) => b.id - a.id)
        .map((c) => `
            <div class="report-card">
                <div class="report-head">
                    <div>
                        <strong>Consignación #${c.id} · ${c.consignador}</strong>
                        <div class="muted">${c.categoria_nombre || '-'} · ${c.estado}</div>
                    </div>
                    <span class="report-tag entry">${formatMoney(c.total_vendido)}</span>
                </div>
                <div class="report-meta">
                    <span>Inicio: ${formatDate(c.fecha_inicio)}</span>
                    <span>Fin: ${c.fecha_fin ? formatDate(c.fecha_fin) : '-'}</span>
                </div>
                <div>
                    ${c.items.length
                        ? c.items.map((i) => `<span class="muted">· ${i.producto_nombre} · entregadas ${i.cantidad_entregada} · vendidas ${i.cantidad_vendida} · stock ${i.stock_actual} → ${formatMoney(i.subtotal_venta)}</span><br>`).join('')
                        : '<span class="muted">Sin productos cargados.</span>'}
                </div>
                ${c.observacion ? `<div class="muted">${c.observacion}</div>` : ''}
                <div class="row-actions">
                    <button class="btn" onclick="agregarEntregaConsignacion(${c.id})">+ Entrega</button>
                    ${c.estado === 'activa' ? `<button class="btn danger" onclick="cerrarConsignacion(${c.id})">Cerrar</button>` : ''}
                </div>
            </div>
        `).join('');
}

function abrirModalConsignacion() {
    const catOptions = cache.categorias.filter((c) => c.es_consignacion)
        .map((c) => `<option value="${c.id}">${c.nombre}</option>`).join('');
    document.getElementById('consignacion-modal-title').textContent = 'Nueva consignación';
    document.getElementById('consignacion-modal-content').innerHTML = `
        <div class="form-grid">
            <label>
                Consignador
                <input type="text" id="cons-consignador" placeholder="Ej: Jesús">
            </label>
            <label>
                Categoría (debe estar marcada como consignación)
                <select id="cons-categoria">
                    <option value="">(opcional)</option>
                    ${catOptions}
                </select>
            </label>
            <label>
                Observación
                <input type="text" id="cons-obs">
            </label>
        </div>
        <div class="detail-actions">
            <button class="btn" data-close-modal="consignacion-modal">Cancelar</button>
            <button class="btn primary" id="confirm-cons">Crear consignación</button>
        </div>
    `;
    document.getElementById('consignacion-modal').querySelectorAll('[data-close-modal]').forEach((el) => {
        el.addEventListener('click', () => closeModal(el.dataset.closeModal));
    });
    document.getElementById('confirm-cons').addEventListener('click', async () => {
        const consignador = document.getElementById('cons-consignador').value.trim();
        if (!consignador) {
            alert('Indica el nombre del consignador.');
            return;
        }
        await window.api.consignaciones.crear({
            consignador,
            categoria_id: document.getElementById('cons-categoria').value || null,
            observacion: document.getElementById('cons-obs').value.trim()
        });
        await refreshCache();
        closeModal('consignacion-modal');
        renderConsignaciones();
    });
    openModal('consignacion-modal');
}

function agregarEntregaConsignacion(consignacionId) {
    const consignacion = cache.consignaciones.find((c) => c.id === consignacionId);
    const productosCons = cache.productos.filter((p) => p.tipo_producto === 'consignacion');
    if (!productosCons.length) {
        alert('Crea primero un producto con tipo Consignación.');
        return;
    }
    document.getElementById('consignacion-modal-title').textContent = `Agregar entrega · Consignación #${consignacionId}`;
    document.getElementById('consignacion-modal-content').innerHTML = `
        <p class="muted">Consignador: <strong>${consignacion.consignador}</strong></p>
        <div class="form-grid">
            <label>
                Producto
                <select id="entrega-producto">
                    ${productosCons.map((p) => `<option value="${p.id}">${p.nombre}</option>`).join('')}
                </select>
            </label>
            <label>
                Cantidad entregada
                <input type="number" id="entrega-cant" min="1" step="1" value="1">
            </label>
            <label>
                Costo acordado
                <input type="number" id="entrega-costo" min="0" step="0.01" value="0">
            </label>
            <label>
                Precio de venta
                <input type="number" id="entrega-precio" min="0" step="0.01" value="0">
            </label>
        </div>
        <div class="detail-actions">
            <button class="btn" data-close-modal="consignacion-modal">Cancelar</button>
            <button class="btn primary" id="confirm-entrega">Registrar entrega</button>
        </div>
    `;
    document.getElementById('consignacion-modal').querySelectorAll('[data-close-modal]').forEach((el) => {
        el.addEventListener('click', () => closeModal(el.dataset.closeModal));
    });
    document.getElementById('confirm-entrega').addEventListener('click', async () => {
        await window.api.consignaciones.agregarEntrega(consignacionId, {
            producto_id: Number(document.getElementById('entrega-producto').value),
            cantidad: Number(document.getElementById('entrega-cant').value),
            costo_acordado: Number(document.getElementById('entrega-costo').value),
            precio_venta: Number(document.getElementById('entrega-precio').value)
        });
        await refreshCache();
        closeModal('consignacion-modal');
        renderConsignaciones();
    });
    openModal('consignacion-modal');
}

function cerrarConsignacion(id) {
    showConfirm({
        title: `Cerrar consignación #${id}`,
        text: 'La consignación quedará marcada como cerrada y no podrá recibir más entregas.',
        okLabel: 'Sí, cerrar',
        onConfirm: async () => {
            await window.api.consignaciones.cerrar(id);
            await refreshCache();
            renderConsignaciones();
        }
    });
}

// ============================================================================
// REPORTES
// ============================================================================
function setupReportFilters() {
    document.querySelectorAll('#report-quick-filters .btn.filter').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.reportFilter = btn.dataset.filter;
            state.reportRange = null;
            document.querySelectorAll('#report-quick-filters .btn.filter').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            renderReportes();
        });
    });
    document.getElementById('apply-report-range').addEventListener('click', () => {
        const from = document.getElementById('report-from').value;
        const to = document.getElementById('report-to').value;
        if (!from || !to) return;
        state.reportRange = { from, to };
        document.querySelectorAll('#report-quick-filters .btn.filter').forEach((b) => b.classList.remove('active'));
        renderReportes();
    });
}

function getReportRange() {
    if (state.reportRange) {
        return { desde: `${state.reportRange.from}T00:00:00.000Z`, hasta: `${state.reportRange.to}T23:59:59.999Z` };
    }
    if (state.reportFilter === 'all') return { desde: null, hasta: null };
    const now = new Date();
    const days = state.reportFilter === 'month' ? 30 : 7;
    const from = new Date(now);
    from.setDate(from.getDate() - days);
    return { desde: from.toISOString(), hasta: now.toISOString() };
}

async function renderReportes() {
    const { desde, hasta } = getReportRange();
    const [semanal, porCategoria, porProducto] = await Promise.all([
        window.api.reportes.semanal(desde, hasta),
        window.api.reportes.porCategoria(desde, hasta),
        window.api.reportes.utilidadPorProducto(desde, hasta)
    ]);

    document.getElementById('report-semanal').innerHTML = `
        <div class="report-card">
            <div class="report-meta">
                <span>Venta total (propio): <strong>${formatMoney(semanal.venta_total)}</strong></span>
                <span>Efectivo: <strong>${formatMoney(semanal.efectivo_total)}</strong></span>
                <span>Transferencia: <strong>${formatMoney(semanal.transferencia_total)}</strong></span>
                <span>Utilidad: <strong>${formatMoney(semanal.utilidad_total)}</strong></span>
            </div>
            <div class="report-meta">
                <span>Extracciones: <strong class="report-delta exit">−${formatMoney(semanal.extracciones_total)}</strong></span>
                <span>Compras mercancía: <strong class="report-delta exit">−${formatMoney(semanal.compras_total)}</strong></span>
                <span>Consignación (aparte): <strong>${formatMoney(semanal.consignacion_total)}</strong></span>
            </div>
        </div>
    `;

    const catBody = document.getElementById('report-categorias-body');
    catBody.innerHTML = porCategoria.length
        ? porCategoria.map((r) => `
            <tr>
                <td data-label="Categoría">${r.nombre}</td>
                <td data-label="Tipo">${r.es_consignacion ? '<span class="badge hidden">Consignación</span>' : '<span class="badge visible">Propia</span>'}</td>
                <td data-label="Unidades">${r.unidades}</td>
                <td data-label="Venta">${formatMoney(r.venta_total)}</td>
                <td data-label="Utilidad">${formatMoney(r.utilidad_total)}</td>
            </tr>
        `).join('')
        : '<tr class="table-empty-row"><td colspan="5"><div class="empty-state">Sin datos.</div></td></tr>';

    const prodBody = document.getElementById('report-productos-body');
    prodBody.innerHTML = porProducto.length
        ? porProducto.map((r) => `
            <tr>
                <td data-label="Producto">${r.nombre}</td>
                <td data-label="Categoría">${r.categoria_nombre}</td>
                <td data-label="Tipo">${r.es_consignacion ? '<span class="badge hidden">Consignación</span>' : '<span class="badge visible">Propio</span>'}</td>
                <td data-label="Unidades">${r.unidades}</td>
                <td data-label="Venta">${formatMoney(r.venta_total)}</td>
                <td data-label="Utilidad">${formatMoney(r.utilidad_total)}</td>
            </tr>
        `).join('')
        : '<tr class="table-empty-row"><td colspan="6"><div class="empty-state">Sin datos.</div></td></tr>';
}

// ============================================================================
// USUARIOS
// ============================================================================
function setUserFormError(message) {
    const el = document.getElementById('user-form-error');
    if (!message) { el.textContent = ''; el.classList.add('hidden'); return; }
    el.textContent = message; el.classList.remove('hidden');
}

function setupUsersForm() {
    document.getElementById('user-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        setUserFormError('');
        const nombre = document.getElementById('user-name').value.trim();
        const usuario = document.getElementById('user-login').value.trim();
        const rol = document.getElementById('user-role').value;
        const clave = document.getElementById('user-password').value;
        const claveConfirm = document.getElementById('user-password-confirm').value;
        if (!nombre || !usuario) { setUserFormError('Nombre y usuario son obligatorios.'); return; }
        const editing = Boolean(state.editingUserId);
        if (!editing && !clave) { setUserFormError('La contraseña es obligatoria al crear usuario.'); return; }
        if (clave && clave.length < 4) { setUserFormError('La contraseña debe tener al menos 4 caracteres.'); return; }
        if (clave && clave !== claveConfirm) { setUserFormError('Las contraseñas no coinciden.'); return; }
        if (editing) {
            await window.api.usuarios.actualizar(state.editingUserId, { nombre, usuario, rol, ...(clave ? { clave } : {}) });
        } else {
            await window.api.usuarios.crear({ nombre, usuario, rol, clave });
        }
        await refreshCache();
        resetUserForm();
        renderUsers();
    });
    document.getElementById('cancel-user-edit').addEventListener('click', resetUserForm);
}

function resetUserForm() {
    state.editingUserId = null;
    document.getElementById('user-form-title').textContent = 'Crear usuario';
    document.getElementById('user-form').reset();
    setUserFormError('');
    document.getElementById('user-password-hint').textContent = '';
}

function renderUsers() {
    const body = document.getElementById('users-table-body');
    if (!cache.usuarios.length) {
        body.innerHTML = '<tr class="table-empty-row"><td colspan="5"><div class="empty-state">No hay usuarios.</div></td></tr>';
        return;
    }
    body.innerHTML = cache.usuarios
        .sort((a, b) => a.id - b.id)
        .map((u) => `
            <tr>
                <td data-label="ID">#${u.id}</td>
                <td data-label="Nombre">${u.nombre}</td>
                <td data-label="Usuario">${u.usuario}</td>
                <td data-label="Rol">${ROLE_LABELS[u.rol] || u.rol}</td>
                <td data-label="Acciones">
                    <div class="row-actions">
                        <button class="btn" onclick="editUser(${u.id})">Editar</button>
                        <button class="btn danger" onclick="deleteUser(${u.id})" ${u.rol === 'admin' ? 'disabled' : ''}>Eliminar</button>
                    </div>
                </td>
            </tr>
        `).join('');
}

function editUser(id) {
    const u = cache.usuarios.find((x) => x.id === id);
    if (!u) return;
    state.editingUserId = id;
    document.getElementById('user-form-title').textContent = `Editar usuario #${id}`;
    document.getElementById('user-name').value = u.nombre;
    document.getElementById('user-login').value = u.usuario;
    document.getElementById('user-role').value = u.rol;
    document.getElementById('user-password').value = '';
    document.getElementById('user-password-confirm').value = '';
    document.getElementById('user-password-hint').textContent = '(dejar vacío para mantener la actual)';
}

function deleteUser(id) {
    const u = cache.usuarios.find((x) => x.id === id);
    if (!u || u.rol === 'admin') return;
    showConfirm({
        title: `Eliminar ${u.nombre}`,
        text: `Se eliminará el usuario "${u.usuario}".`,
        okLabel: 'Sí, eliminar',
        onConfirm: async () => {
            await window.api.usuarios.eliminar(id);
            await refreshCache();
            renderUsers();
        }
    });
}

// ============================================================================
// Bootstrap
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    setupMainTabs();
    setupModalCloseHandlers();
    setupProductForm();
    setupProductFilters();
    setupCategoryForm();
    setupSalesFilters();
    setupReportFilters();
    setupUsersForm();

    document.getElementById('btn-new-compra').addEventListener('click', abrirModalCompra);
    document.getElementById('btn-new-consignacion').addEventListener('click', abrirModalConsignacion);

    document.getElementById('confirm-ok-btn').addEventListener('click', async () => {
        const fn = pendingConfirm;
        pendingConfirm = null;
        closeModal('generic-confirm-modal');
        if (typeof fn === 'function') await fn();
    });
    document.getElementById('confirm-cancel-btn').addEventListener('click', () => {
        pendingConfirm = null;
        closeModal('generic-confirm-modal');
    });

    document.getElementById('btn-reset-demo').addEventListener('click', () => {
        showConfirm({
            title: 'Resetear datos de demo',
            text: 'Se restaurarán los datos de muestra y se perderán los cambios actuales.',
            okLabel: 'Sí, resetear',
            onConfirm: async () => {
                window.api.resetDemo();
                await refreshCache();
                renderActiveTab();
            }
        });
    });

    const isMobile = window.matchMedia('(max-width: 760px)').matches;
    setProductFormVisibility(!isMobile);

    await refreshCache();
    renderActiveTab();

    window.editProduct = editProduct;
    window.deleteProduct = deleteProduct;
    window.editCategory = editCategory;
    window.deleteCategory = deleteCategory;
    window.editUser = editUser;
    window.deleteUser = deleteUser;
    window.showSaleDetails = showSaleDetails;
    window.verCajaDesglose = verCajaDesglose;
    window.abrirCierreCaja = abrirCierreCaja;
    window.agregarEntregaConsignacion = agregarEntregaConsignacion;
    window.cerrarConsignacion = cerrarConsignacion;
});
