/**
 * VEF API — Capa de acceso a datos con soporte offline.
 * Cuando hay conexión: llama al backend FastAPI.
 * Sin conexión: sirve desde IndexedDB y encola escrituras en el outbox.
 * La interfaz pública (window.api) es idéntica a la versión original.
 */
(function () {
    const BASE = '/api';

    // ── Red ────────────────────────────────────────────────────────────────
    async function netReq(method, path, body) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body !== undefined) opts.body = JSON.stringify(body);
        const res = await fetch(BASE + path, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `HTTP ${res.status}`);
        }
        return res.json();
    }
    const netGet   = p      => netReq('GET',    p);
    const netPost  = (p, b) => netReq('POST',   p, b);
    const netPut   = (p, b) => netReq('PUT',    p, b);
    const netPatch = (p, b) => netReq('PATCH',  p, b);
    const netDel   = p      => netReq('DELETE', p);

    // ── ¿Error de red? (fallo de conexión al servidor) ─────────────────────
    function isNetworkError(e) {
        return (e instanceof TypeError) || !navigator.onLine;
    }

    // ── DB helper (null-safe) ──────────────────────────────────────────────
    const db = () => window.vefDB || null;

    // ── Encolar op pendiente ───────────────────────────────────────────────
    async function queue(op, payload) {
        if (db()) await db().pushOutbox(op, payload);
        window.dispatchEvent(new CustomEvent('vef:queue-op'));
    }

    // ── Categorías ─────────────────────────────────────────────────────────
    const categorias = {
        listar: async () => {
            try {
                const data = await netGet('/categorias');
                db()?.putAll('categorias', data);
                return data;
            } catch (e) {
                if (isNetworkError(e) && db()) return db().getAll('categorias');
                throw e;
            }
        },
        crear:      (p)     => netPost('/categorias', p),
        actualizar: (id, p) => netPut(`/categorias/${id}`, p),
        eliminar:   (id)    => netDel(`/categorias/${id}`),
    };

    // ── Productos ───────────────────────────────────────────────────────────
    const productos = {
        listar: async () => {
            try {
                const data = await netGet('/productos');
                db()?.putAll('productos', data);
                return data;
            } catch (e) {
                if (isNetworkError(e) && db()) return db().getAll('productos');
                throw e;
            }
        },
        crear:       (p)         => netPost('/productos', p),
        actualizar:  (id, p)     => netPut(`/productos/${id}`, p),
        eliminar:    (id)        => netDel(`/productos/${id}`),
        ajustarStock:(id, stock) => netPatch(`/productos/${id}/stock`, { stock_actual: stock }),
    };

    // ── Usuarios ────────────────────────────────────────────────────────────
    const usuarios = {
        listar:     ()               => netGet('/usuarios'),
        autenticar: (usuario, clave) =>
            netPost('/auth/login', { usuario, clave }).catch(() => null),
        crear:      (p)              => netPost('/usuarios', p),
        actualizar: (id, p)          => netPut(`/usuarios/${id}`, p),
        eliminar:   (id)             => netDel(`/usuarios/${id}`),
    };

    // ── Cajas config ────────────────────────────────────────────────────────
    const cajas_config = {
        listar: async () => {
            try {
                const data = await netGet('/cajas/config');
                db()?.kvSet('cajas_config', data);
                return data;
            } catch (e) {
                if (isNetworkError(e) && db()) {
                    const cached = await db().kvGet('cajas_config');
                    if (cached) return cached;
                }
                throw e;
            }
        },
        actualizarCategorias: (id, cat_ids) =>
            netPut(`/cajas/config/${id}`, { categorias_ids: cat_ids }),
    };

    // ── Cajas operativas ────────────────────────────────────────────────────
    const cajas = {
        listar: () => netGet('/cajas'),
        actual: async () => {
            try {
                const data = await netGet('/cajas/actual');
                if (data) db()?.kvSet('caja_actual', data);
                return data;
            } catch (e) {
                if (isNetworkError(e) && db()) {
                    return (await db().kvGet('caja_actual')) ?? null;
                }
                throw e;
            }
        },
        abrir: (efectivo_inicial) =>
            netPost('/cajas/abrir', { efectivo_inicial }).then(r => {
                db()?.kvSet('caja_actual', r); return r;
            }),
        cerrar: (id, efectivo_contado, obs) =>
            netPost(`/cajas/${id}/cerrar`, { efectivo_contado, observacion: obs || '' }).then(r => {
                db()?.kvSet('caja_actual', null); return r;
            }),
        desgloseEfectivo: (id) => netGet(`/cajas/${id}/desglose`),
    };

    // ── Ventas ──────────────────────────────────────────────────────────────
    const ventas = {
        listar: async (filtros = {}) => {
            const qs = new URLSearchParams();
            if (filtros.caja_id != null) qs.set('caja_id', filtros.caja_id);
            if (filtros.estado)          qs.set('estado',  filtros.estado);
            if (filtros.desde)           qs.set('desde',   filtros.desde);
            if (filtros.hasta)           qs.set('hasta',   filtros.hasta);
            const path     = '/ventas' + (qs.toString() ? '?' + qs : '');
            const cacheKey = 'ventas_' + (filtros.caja_id ?? 'all');
            try {
                const data = await netGet(path);
                db()?.kvSet(cacheKey, data);
                return data;
            } catch (e) {
                if (isNetworkError(e) && db()) {
                    return (await db().kvGet(cacheKey)) ?? [];
                }
                throw e;
            }
        },
        listarPorCaja: (caja_id) => ventas.listar({ caja_id }),
        obtener:       (id)      => netGet(`/ventas/${id}`),
        registrar: async (payload) => {
            try {
                return await netPost('/ventas', payload);
            } catch (e) {
                if (isNetworkError(e)) return _ventaOffline(payload);
                throw e;
            }
        },
        cancelar: (id) => netPost(`/ventas/${id}/cancelar`),
    };

    async function _ventaOffline(payload) {
        // Descuenta stock local para que la caja refleje el cambio de inmediato
        if (db() && Array.isArray(payload.items)) {
            for (const item of payload.items) {
                const p = await db().get('productos', item.producto_id);
                if (p) {
                    p.stock_actual = Math.max(0, (p.stock_actual || 0) - item.cantidad);
                    await db().put('productos', p);
                }
            }
        }
        await queue('venta', payload);
        return {
            id:       'off_' + Date.now(),
            estado:   'completada',
            fecha:    new Date().toISOString(),
            _offline: true,
            ...payload,
        };
    }

    // ── Movimientos ─────────────────────────────────────────────────────────
    const movimientos = {
        listar: (caja_id) => {
            const q = caja_id != null ? `?caja_id=${caja_id}` : '';
            return netGet('/movimientos' + q);
        },
        registrarExtraccion: async (p) => {
            try { return await netPost('/movimientos/extraccion', p); }
            catch (e) {
                if (isNetworkError(e)) { await queue('extraccion', p); return { id: 'off_' + Date.now(), _offline: true, ...p }; }
                throw e;
            }
        },
        registrarPago: async (p) => {
            try { return await netPost('/movimientos/pago', p); }
            catch (e) {
                if (isNetworkError(e)) { await queue('pago', p); return { id: 'off_' + Date.now(), _offline: true, ...p }; }
                throw e;
            }
        },
    };

    // ── Compras ─────────────────────────────────────────────────────────────
    const compras = {
        listar:    ()  => netGet('/compras'),
        registrar: (p) => netPost('/compras', p),
    };

    // ── Consignaciones ──────────────────────────────────────────────────────
    const consignaciones = {
        listar:         ()         => netGet('/consignaciones'),
        crear:          (p)        => netPost('/consignaciones', p),
        agregarEntrega: (id, item) => netPost(`/consignaciones/${id}/entrega`, item),
        cerrar:         (id)       => netPost(`/consignaciones/${id}/cerrar`),
    };

    // ── Reportes ────────────────────────────────────────────────────────────
    const reportes = {
        semanal: (desde, hasta, caja_id) => {
            const qs = new URLSearchParams();
            if (desde)           qs.set('desde',   desde);
            if (hasta)           qs.set('hasta',   hasta);
            if (caja_id != null) qs.set('caja_id', caja_id);
            return netGet('/reportes/semanal?' + qs);
        },
        porCategoria: (desde, hasta, caja_id) => {
            const qs = new URLSearchParams();
            if (desde)           qs.set('desde',   desde);
            if (hasta)           qs.set('hasta',   hasta);
            if (caja_id != null) qs.set('caja_id', caja_id);
            return netGet('/reportes/por-categoria?' + qs);
        },
        utilidadPorProducto: (desde, hasta, caja_id) => {
            const qs = new URLSearchParams();
            if (desde)           qs.set('desde',   desde);
            if (hasta)           qs.set('hasta',   hasta);
            if (caja_id != null) qs.set('caja_id', caja_id);
            return netGet('/reportes/utilidad-por-producto?' + qs);
        },
    };

    window.api = {
        categorias, productos, usuarios, cajas_config, cajas,
        ventas, movimientos, compras, consignaciones, reportes,
    };
})();
