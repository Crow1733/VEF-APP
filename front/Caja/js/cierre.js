function money(value) {
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function formatDateTime(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

async function refresh() {
    const [actual, todas] = await Promise.all([
        window.api.cajas.actual(),
        window.api.cajas.listar()
    ]);
    renderState(actual);
    renderHistorico(todas, actual);
}

function renderState(caja) {
    const pill = document.getElementById('state-pill');
    const title = document.getElementById('caja-state-title');
    const body = document.getElementById('caja-state-body');

    if (!caja) {
        pill.textContent = 'Sin caja abierta';
        title.textContent = 'Abrir caja';
        body.innerHTML = `
            <p class="muted">No hay una caja abierta. Indica el efectivo inicial y crea una nueva apertura.</p>
            <form class="cierre-form" id="apertura-form">
                <label>
                    Efectivo inicial
                    <input type="number" id="apertura-efectivo" min="0" step="0.01" value="50000" required>
                </label>
                <div>
                    <button class="btn-primary" type="submit">Abrir caja</button>
                </div>
            </form>
        `;
        document.getElementById('apertura-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const monto = Number(document.getElementById('apertura-efectivo').value);
            await window.api.cajas.abrir(monto);
            await refresh();
        });
        return;
    }

    pill.textContent = `Caja #${caja.id} abierta`;
    title.textContent = `Caja #${caja.id}`;

    window.api.cajas.desgloseEfectivo(caja.id).then((d) => {
        body.innerHTML = `
            <p class="muted">Abierta el ${formatDateTime(caja.fecha_apertura)}</p>
            <div class="desglose-grid">
                <div class="desglose-card"><div class="label">Efectivo inicial</div><div class="value">$${money(d.efectivo_inicial)}</div></div>
                <div class="desglose-card entry"><div class="label">+ Ventas efectivo</div><div class="value">$${money(d.ventas_efectivo)}</div></div>
                <div class="desglose-card"><div class="label">Ventas transferencia</div><div class="value">$${money(d.ventas_transferencia)}</div></div>
                <div class="desglose-card exit"><div class="label">− Extracciones</div><div class="value">$${money(d.extracciones)}</div></div>
                <div class="desglose-card exit"><div class="label">− Compras mercancía</div><div class="value">$${money(d.compras_mercancia)}</div></div>
                <div class="desglose-card exit"><div class="label">− Pagos varios</div><div class="value">$${money(d.pagos_varios)}</div></div>
                <div class="desglose-card total"><div class="label">= Efectivo esperado</div><div class="value">$${money(d.efectivo_esperado)}</div></div>
            </div>
            <form class="cierre-form" id="cierre-form">
                <label>
                    Efectivo contado al cierre
                    <input type="number" id="cierre-contado" min="0" step="0.01" value="${d.efectivo_esperado}">
                </label>
                <label>
                    Observación
                    <input type="text" id="cierre-obs" placeholder="Ej: diferencia por vuelto">
                </label>
                <div>
                    <button class="btn-danger" type="submit">Cerrar caja</button>
                </div>
            </form>
        `;
        document.getElementById('cierre-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const contado = Number(document.getElementById('cierre-contado').value) || 0;
            const obs = document.getElementById('cierre-obs').value.trim();
            const result = await window.api.cajas.cerrar(caja.id, contado, obs);
            if (result) {
                const diff = result.caja.diferencia;
                if (Math.abs(diff) >= 1) {
                    alert(`Caja cerrada. Diferencia: $${money(diff)} ${diff < 0 ? '(faltante)' : '(sobrante)'}`);
                }
            }
            await refresh();
        });
    });
}

function renderHistorico(todas, actual) {
    const list = document.getElementById('historico-cajas');
    if (!todas.length) {
        list.innerHTML = '<div class="empty-state">Sin cajas registradas.</div>';
        return;
    }
    list.innerHTML = todas.sort((a, b) => b.id - a.id).map((c) => `
        <article class="history-card ${c.estado}">
            <div class="sale-card-header">
                <div>
                    <strong>Caja #${c.id}</strong>
                    <span class="muted">${c.estado}</span>
                </div>
                <span class="pill ${c.estado === 'abierta' ? '' : 'gray'}">${c.estado === 'abierta' ? 'Abierta' : 'Cerrada'}</span>
            </div>
            <div class="meta">
                <span>Apertura: ${formatDateTime(c.fecha_apertura)}</span>
                <span>Cierre: ${formatDateTime(c.fecha_cierre)}</span>
                <span>Inicial: $${money(c.efectivo_inicial)}</span>
                <span>Contado: ${c.efectivo_contado != null ? '$' + money(c.efectivo_contado) : '-'}</span>
                <span>Diferencia: ${c.diferencia != null ? '$' + money(c.diferencia) : '-'}</span>
            </div>
            ${c.observacion ? `<div class="muted">${c.observacion}</div>` : ''}
        </article>
    `).join('');
}

document.addEventListener('DOMContentLoaded', refresh);
