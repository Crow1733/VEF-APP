let productosCache = [];
let items = [];

function money(v) {
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(Number(v) || 0);
}

function formatDateTime(v) {
    if (!v) return '-';
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v));
}

function productOptions(selected) {
    return productosCache
        .filter((p) => p.tipo_producto !== 'consignacion')
        .map((p) => `<option value="${p.id}" ${selected == p.id ? 'selected' : ''}>${p.nombre} (stock ${p.stock_actual})</option>`)
        .join('');
}

function recalcTotal() {
    const total = items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.costo_unitario) || 0), 0);
    document.getElementById('cp-total').textContent = `$${money(total)}`;
}

function renderItems() {
    const container = document.getElementById('cp-items');
    if (!items.length) {
        items.push({ producto_id: productosCache[0]?.id || '', cantidad: 1, costo_unitario: 0 });
    }
    container.innerHTML = items.map((item, idx) => `
        <div class="desglose-card">
            <label>
                Producto
                <select data-idx="${idx}" data-f="producto_id">${productOptions(item.producto_id)}</select>
            </label>
            <label>
                Cantidad
                <input type="number" min="1" step="1" data-idx="${idx}" data-f="cantidad" value="${item.cantidad}">
            </label>
            <label>
                Costo unitario
                <input type="number" min="0" step="0.01" data-idx="${idx}" data-f="costo_unitario" value="${item.costo_unitario}">
            </label>
            <div>
                <button type="button" class="btn-ghost" data-remove="${idx}">Quitar item</button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('[data-idx]').forEach((el) => {
        el.addEventListener('input', () => {
            const idx = Number(el.dataset.idx);
            items[idx][el.dataset.f] = el.value;
            recalcTotal();
        });
        el.addEventListener('change', () => {
            const idx = Number(el.dataset.idx);
            items[idx][el.dataset.f] = el.value;
            recalcTotal();
        });
    });

    container.querySelectorAll('[data-remove]').forEach((btn) => {
        btn.addEventListener('click', () => {
            items.splice(Number(btn.dataset.remove), 1);
            renderItems();
            recalcTotal();
        });
    });

    recalcTotal();
}

async function renderHistorial() {
    const list = document.getElementById('compras-list');
    const compras = await window.api.compras.listar();
    if (!compras.length) {
        list.innerHTML = '<div class="empty-state">Sin compras registradas.</div>';
        return;
    }
    list.innerHTML = compras.sort((a, b) => b.id - a.id).map((c) => `
        <article class="history-card">
            <div class="sale-card-header">
                <div>
                    <strong>Compra #${c.id}</strong>
                    <span class="muted">${formatDateTime(c.fecha)}</span>
                </div>
                <span class="pill">$${money(c.total)}</span>
            </div>
            <div class="meta">
                <span>Procedencia: ${c.procedencia || '-'}</span>
                <span>Método: ${c.metodo_pago}</span>
                <span>${c.descuenta_fondo ? 'Descuenta del fondo' : 'No descuenta del fondo'}</span>
            </div>
            <div class="muted">
                ${c.items.map((i) => `· ${i.producto_nombre} × ${i.cantidad} a $${money(i.costo_unitario)}`).join('<br>')}
            </div>
            ${c.observacion ? `<div class="muted">${c.observacion}</div>` : ''}
        </article>
    `).join('');
}

async function refresh() {
    productosCache = await window.api.productos.listar();
    const caja = await window.api.cajas.actual();
    document.getElementById('compras-pill').textContent = caja ? `Caja #${caja.id} abierta` : 'Sin caja abierta';
    renderItems();
    renderHistorial();
}

document.addEventListener('DOMContentLoaded', async () => {
    await refresh();

    document.getElementById('cp-add-item').addEventListener('click', () => {
        items.push({ producto_id: productosCache[0]?.id || '', cantidad: 1, costo_unitario: 0 });
        renderItems();
    });

    document.getElementById('compra-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const valid = items.filter((i) => i.producto_id && Number(i.cantidad) > 0 && Number(i.costo_unitario) >= 0);
        if (!valid.length) {
            alert('Agrega al menos un item válido.');
            return;
        }
        await window.api.compras.registrar({
            procedencia: document.getElementById('cp-procedencia').value.trim(),
            metodo_pago: document.getElementById('cp-metodo').value,
            descuenta_fondo: document.getElementById('cp-descuenta').checked,
            observacion: document.getElementById('cp-obs').value.trim(),
            items: valid.map((i) => ({
                producto_id: Number(i.producto_id),
                cantidad: Number(i.cantidad),
                costo_unitario: Number(i.costo_unitario)
            }))
        });
        items = [];
        document.getElementById('compra-form').reset();
        document.getElementById('cp-descuenta').checked = true;
        await refresh();
    });
});
