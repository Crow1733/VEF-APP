/**
 * Capa de acceso a datos — llama al backend FastAPI.
 * La interfaz pública (window.api) es idéntica a la versión mock,
 * por lo que todas las vistas funcionan sin cambios.
 */
(function () {
    const BASE = '/api';

    async function req(method, path, body) {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body !== undefined) opts.body = JSON.stringify(body);
        const res = await fetch(BASE + path, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `HTTP ${res.status}`);
        }
        return res.json();
    }

    const get  = (path)        => req('GET',    path);
    const post = (path, body)  => req('POST',   path, body);
    const put  = (path, body)  => req('PUT',    path, body);
    const patch= (path, body)  => req('PATCH',  path, body);
    const del  = (path)        => req('DELETE', path);

    // ── Categorías ──────────────────────────────────────────────────────────
    const categorias = {
        listar:     ()           => get('/categorias'),
        crear:      (p)          => post('/categorias', p),
        actualizar: (id, p)      => put(`/categorias/${id}`, p),
        eliminar:   (id)         => del(`/categorias/${id}`),
    };

    // ── Productos ───────────────────────────────────────────────────────────
    const productos = {
        listar:      ()          => get('/productos'),
        crear:       (p)         => post('/productos', p),
        actualizar:  (id, p)     => put(`/productos/${id}`, p),
        eliminar:    (id)        => del(`/productos/${id}`),
        ajustarStock:(id, stock) => patch(`/productos/${id}/stock`, { stock_actual: stock }),
    };

    // ── Usuarios ────────────────────────────────────────────────────────────
    const usuarios = {
        listar:      ()          => get('/usuarios'),
        autenticar:  (usuario, clave) =>
            post('/auth/login', { usuario, clave }).catch(() => null),
        crear:       (p)         => post('/usuarios', p),
        actualizar:  (id, p)     => put(`/usuarios/${id}`, p),
        eliminar:    (id)        => del(`/usuarios/${id}`),
    };

    // ── Cajas config (3 fijas) ──────────────────────────────────────────────
    const cajas_config = {
        listar:              ()              => get('/cajas/config'),
        actualizarCategorias:(id, cat_ids)   => put(`/cajas/config/${id}`, { categorias_ids: cat_ids }),
    };

    // ── Cajas operativas ────────────────────────────────────────────────────
    const cajas = {
        listar:          ()                          => get('/cajas'),
        actual:          ()                          => get('/cajas/actual'),
        abrir:           (efectivo_inicial)          => post('/cajas/abrir', { efectivo_inicial }),
        cerrar:          (id, efectivo_contado, obs) => post(`/cajas/${id}/cerrar`, { efectivo_contado, observacion: obs || '' }),
        desgloseEfectivo:(id)                        => get(`/cajas/${id}/desglose`),
    };

    // ── Ventas ──────────────────────────────────────────────────────────────
    const ventas = {
        listar:         (filtros = {}) => {
            const qs = new URLSearchParams();
            if (filtros.caja_id != null) qs.set('caja_id', filtros.caja_id);
            if (filtros.estado)          qs.set('estado',  filtros.estado);
            if (filtros.desde)           qs.set('desde',   filtros.desde);
            if (filtros.hasta)           qs.set('hasta',   filtros.hasta);
            const q = qs.toString();
            return get('/ventas' + (q ? '?' + q : ''));
        },
        listarPorCaja:  (caja_id) => get(`/ventas?caja_id=${caja_id}`),
        obtener:        (id)      => get(`/ventas/${id}`),
        registrar:      (p)       => post('/ventas', p),
        cancelar:       (id)      => post(`/ventas/${id}/cancelar`),
    };

    // ── Movimientos de caja ─────────────────────────────────────────────────
    const movimientos = {
        listar:              (caja_id) => {
            const q = caja_id != null ? `?caja_id=${caja_id}` : '';
            return get('/movimientos' + q);
        },
        registrarExtraccion: (p)       => post('/movimientos/extraccion', p),
        registrarPago:       (p)       => post('/movimientos/pago', p),
    };

    // ── Compras ─────────────────────────────────────────────────────────────
    const compras = {
        listar:    ()  => get('/compras'),
        registrar: (p) => post('/compras', p),
    };

    // ── Consignaciones ──────────────────────────────────────────────────────
    const consignaciones = {
        listar:        ()         => get('/consignaciones'),
        crear:         (p)        => post('/consignaciones', p),
        agregarEntrega:(id, item) => post(`/consignaciones/${id}/entrega`, item),
        cerrar:        (id)       => post(`/consignaciones/${id}/cerrar`),
    };

    // ── Reportes ────────────────────────────────────────────────────────────
    const reportes = {
        semanal: (desde, hasta, caja_id) => {
            const qs = new URLSearchParams();
            if (desde)           qs.set('desde',   desde);
            if (hasta)           qs.set('hasta',   hasta);
            if (caja_id != null) qs.set('caja_id', caja_id);
            return get('/reportes/semanal?' + qs.toString());
        },
        porCategoria: (desde, hasta, caja_id) => {
            const qs = new URLSearchParams();
            if (desde)           qs.set('desde',   desde);
            if (hasta)           qs.set('hasta',   hasta);
            if (caja_id != null) qs.set('caja_id', caja_id);
            return get('/reportes/por-categoria?' + qs.toString());
        },
        utilidadPorProducto: (desde, hasta, caja_id) => {
            const qs = new URLSearchParams();
            if (desde)           qs.set('desde',   desde);
            if (hasta)           qs.set('hasta',   hasta);
            if (caja_id != null) qs.set('caja_id', caja_id);
            return get('/reportes/utilidad-por-producto?' + qs.toString());
        },
    };

    window.api = {
        categorias, productos, usuarios, cajas_config, cajas,
        ventas, movimientos, compras, consignaciones, reportes,
    };
})();
