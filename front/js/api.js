/**
 * Capa de acceso a datos (mock).
 * Toda la UI llama a esta API en lugar de tocar localStorage o arrays directos.
 * El día que exista el backend SQLite, basta con reemplazar el cuerpo de cada
 * función por un fetch(...) sin cambiar las vistas.
 */
(function () {
    const STORAGE_KEY = 'vefDataStore';
    const SCHEMA_VERSION = 3;

    const RAND_DELAY = 0;
    const wait = (value) => RAND_DELAY ? new Promise((r) => setTimeout(() => r(value), RAND_DELAY)) : Promise.resolve(value);

    const todayIso = () => new Date().toISOString();
    const daysAgoIso = (days) => {
        const d = new Date();
        d.setDate(d.getDate() - days);
        d.setHours(10 + (days % 6), (days * 7) % 60, 0, 0);
        return d.toISOString();
    };

    function seed() {
        const categorias = [
            { id: 1, nombre: 'Aseo', tipo: 'propia', es_consignacion: 0, activa: 1 },
            { id: 2, nombre: 'Cocina', tipo: 'propia', es_consignacion: 0, activa: 1 },
            { id: 3, nombre: 'Talabartería', tipo: 'propia', es_consignacion: 0, activa: 1 },
            { id: 4, nombre: 'Electrodomésticos', tipo: 'propia', es_consignacion: 0, activa: 1 },
            { id: 5, nombre: 'Jesús electrodomésticos', tipo: 'consignacion', es_consignacion: 1, activa: 1 },
            { id: 6, nombre: 'Consignación general', tipo: 'consignacion', es_consignacion: 1, activa: 1 }
        ];

        const productos = [
            { id: 1, categoria_id: 1, nombre: 'Detergente 1kg', codigo: 'AS-001', tipo_producto: 'propio', consignador: null, costo: 800, precio_venta: 1500, ganancia: 700, unidad: 'unidad', stock_inicial: 30, stock_actual: 24, imagen: '', activa: 1 },
            { id: 2, categoria_id: 1, nombre: 'Jabón en barra', codigo: 'AS-002', tipo_producto: 'propio', consignador: null, costo: 250, precio_venta: 500, ganancia: 250, unidad: 'unidad', stock_inicial: 50, stock_actual: 41, imagen: '', activa: 1 },
            { id: 3, categoria_id: 2, nombre: 'Sartén 24cm', codigo: 'CO-010', tipo_producto: 'propio', consignador: null, costo: 4200, precio_venta: 7500, ganancia: 3300, unidad: 'unidad', stock_inicial: 12, stock_actual: 9, imagen: '', activa: 1 },
            { id: 4, categoria_id: 2, nombre: 'Set 6 vasos', codigo: 'CO-011', tipo_producto: 'propio', consignador: null, costo: 1800, precio_venta: 3200, ganancia: 1400, unidad: 'unidad', stock_inicial: 18, stock_actual: 15, imagen: '', activa: 1 },
            { id: 5, categoria_id: 3, nombre: 'Cinturón cuero', codigo: 'TA-020', tipo_producto: 'propio', consignador: null, costo: 2200, precio_venta: 4500, ganancia: 2300, unidad: 'unidad', stock_inicial: 20, stock_actual: 17, imagen: '', activa: 1 },
            { id: 6, categoria_id: 4, nombre: 'Plancha eléctrica', codigo: 'EL-030', tipo_producto: 'propio', consignador: null, costo: 6500, precio_venta: 11500, ganancia: 5000, unidad: 'unidad', stock_inicial: 8, stock_actual: 6, imagen: '', activa: 1 },
            { id: 7, categoria_id: 5, nombre: 'Licuadora Oster', codigo: 'JE-040', tipo_producto: 'consignacion', consignador: 'Jesús', costo: 0, precio_venta: 22000, ganancia: 0, unidad: 'unidad', stock_inicial: 4, stock_actual: 3, imagen: '', activa: 1 },
            { id: 8, categoria_id: 6, nombre: 'Camiseta talla M', codigo: 'CG-050', tipo_producto: 'consignacion', consignador: 'Sucel', costo: 0, precio_venta: 3500, ganancia: 0, unidad: 'unidad', stock_inicial: 15, stock_actual: 13, imagen: '', activa: 1 }
        ];

        const usuarios = [
            { id: 1, nombre: 'Administrador', usuario: 'admin', clave: 'admin123', rol: 'admin', activo: 1, creado_en: daysAgoIso(60) },
            { id: 2, nombre: 'Lucía Pérez', usuario: 'caja', clave: 'caja123', rol: 'cajero', activo: 1, creado_en: daysAgoIso(40) },
            { id: 3, nombre: 'Carlos Mora', usuario: 'carlos', clave: 'caja456', rol: 'cajero', activo: 1, creado_en: daysAgoIso(20) }
        ];

        const cajaCerradaId = 1;
        const cajaActualId = 2;
        const cajas = [
            { id: cajaCerradaId, fecha_apertura: daysAgoIso(2), fecha_cierre: daysAgoIso(2), efectivo_inicial: 50000, efectivo_contado: 71200, diferencia: -300, estado: 'cerrada', observacion: 'Diferencia menor por vuelto.' },
            { id: cajaActualId, fecha_apertura: daysAgoIso(0), fecha_cierre: null, efectivo_inicial: 50000, efectivo_contado: null, diferencia: null, estado: 'abierta', observacion: '' }
        ];

        const ventas = [
            { id: 1, caja_id: cajaCerradaId, fecha: daysAgoIso(2), tipo_pago: 'efectivo', total: 9000, subtotal_efectivo: 9000, subtotal_transferencia: 0, es_consignacion: 0, estado: 'completada', observacion: '' },
            { id: 2, caja_id: cajaCerradaId, fecha: daysAgoIso(2), tipo_pago: 'mixto', total: 14000, subtotal_efectivo: 8000, subtotal_transferencia: 6000, es_consignacion: 0, estado: 'completada', observacion: '' },
            { id: 3, caja_id: cajaCerradaId, fecha: daysAgoIso(2), tipo_pago: 'transferencia', total: 22000, subtotal_efectivo: 0, subtotal_transferencia: 22000, es_consignacion: 1, estado: 'completada', observacion: 'Venta consignación Jesús.' },
            { id: 4, caja_id: cajaActualId, fecha: daysAgoIso(0), tipo_pago: 'efectivo', total: 5000, subtotal_efectivo: 5000, subtotal_transferencia: 0, es_consignacion: 0, estado: 'completada', observacion: '' },
            { id: 5, caja_id: cajaActualId, fecha: daysAgoIso(0), tipo_pago: 'mixto', total: 11500, subtotal_efectivo: 6000, subtotal_transferencia: 5500, es_consignacion: 0, estado: 'completada', observacion: '' },
            { id: 6, caja_id: cajaActualId, fecha: daysAgoIso(0), tipo_pago: 'efectivo', total: 3500, subtotal_efectivo: 3500, subtotal_transferencia: 0, es_consignacion: 1, estado: 'completada', observacion: 'Camiseta consignación Sucel.' }
        ];

        const venta_detalle = [
            { id: 1, venta_id: 1, producto_id: 3, cantidad: 1, costo_unitario: 4200, precio_unitario: 7500, subtotal: 7500, ganancia_unitaria: 3300, ganancia_total: 3300, es_consignacion: 0 },
            { id: 2, venta_id: 1, producto_id: 2, cantidad: 3, costo_unitario: 250, precio_unitario: 500, subtotal: 1500, ganancia_unitaria: 250, ganancia_total: 750, es_consignacion: 0 },
            { id: 3, venta_id: 2, producto_id: 6, cantidad: 1, costo_unitario: 6500, precio_unitario: 11500, subtotal: 11500, ganancia_unitaria: 5000, ganancia_total: 5000, es_consignacion: 0 },
            { id: 4, venta_id: 2, producto_id: 4, cantidad: 1, costo_unitario: 1800, precio_unitario: 3200, subtotal: 3200, ganancia_unitaria: 1400, ganancia_total: 1400, es_consignacion: 0 },
            { id: 5, venta_id: 3, producto_id: 7, cantidad: 1, costo_unitario: 0, precio_unitario: 22000, subtotal: 22000, ganancia_unitaria: 0, ganancia_total: 0, es_consignacion: 1 },
            { id: 6, venta_id: 4, producto_id: 1, cantidad: 1, costo_unitario: 800, precio_unitario: 1500, subtotal: 1500, ganancia_unitaria: 700, ganancia_total: 700, es_consignacion: 0 },
            { id: 7, venta_id: 4, producto_id: 5, cantidad: 1, costo_unitario: 2200, precio_unitario: 3500, subtotal: 3500, ganancia_unitaria: 1300, ganancia_total: 1300, es_consignacion: 0 },
            { id: 8, venta_id: 5, producto_id: 6, cantidad: 1, costo_unitario: 6500, precio_unitario: 11500, subtotal: 11500, ganancia_unitaria: 5000, ganancia_total: 5000, es_consignacion: 0 },
            { id: 9, venta_id: 6, producto_id: 8, cantidad: 1, costo_unitario: 0, precio_unitario: 3500, subtotal: 3500, ganancia_unitaria: 0, ganancia_total: 0, es_consignacion: 1 }
        ];

        const movimientos_caja = [
            { id: 1, caja_id: cajaCerradaId, fecha: daysAgoIso(2), tipo_movimiento: 'venta', concepto: 'Venta CAJ-1', monto: 9000, metodo_pago: 'efectivo', relacionado_tipo: 'venta', relacionado_id: 1, es_extraccion: 0, es_compra_mercancia: 0 },
            { id: 2, caja_id: cajaCerradaId, fecha: daysAgoIso(2), tipo_movimiento: 'extraccion', concepto: 'Retiro propietario', monto: 5000, metodo_pago: 'efectivo', relacionado_tipo: null, relacionado_id: null, es_extraccion: 1, es_compra_mercancia: 0 },
            { id: 3, caja_id: cajaActualId, fecha: daysAgoIso(0), tipo_movimiento: 'venta', concepto: 'Venta CAJ-4', monto: 5000, metodo_pago: 'efectivo', relacionado_tipo: 'venta', relacionado_id: 4, es_extraccion: 0, es_compra_mercancia: 0 }
        ];

        const compras = [
            { id: 1, fecha: daysAgoIso(3), total: 18000, metodo_pago: 'efectivo', descuenta_fondo: 1, procedencia: 'Mayorista del centro', observacion: 'Reposición sartenes y vasos.' }
        ];

        const compra_detalle = [
            { id: 1, compra_id: 1, producto_id: 3, cantidad: 3, costo_unitario: 4200, subtotal: 12600 },
            { id: 2, compra_id: 1, producto_id: 4, cantidad: 3, costo_unitario: 1800, subtotal: 5400 }
        ];

        const consignaciones = [
            { id: 1, consignador: 'Jesús', categoria_id: 5, fecha_inicio: daysAgoIso(15), fecha_fin: null, estado: 'activa', observacion: 'Electrodomésticos en consignación.' },
            { id: 2, consignador: 'Sucel', categoria_id: 6, fecha_inicio: daysAgoIso(8), fecha_fin: null, estado: 'activa', observacion: 'Ropa de temporada.' }
        ];

        const consignacion_detalle = [
            { id: 1, consignacion_id: 1, producto_id: 7, cantidad_entregada: 4, cantidad_vendida: 1, costo_acordado: 18000, precio_venta: 22000, subtotal_venta: 22000 },
            { id: 2, consignacion_id: 2, producto_id: 8, cantidad_entregada: 15, cantidad_vendida: 2, costo_acordado: 2800, precio_venta: 3500, subtotal_venta: 7000 }
        ];

        return {
            __version: SCHEMA_VERSION,
            secuencias: {
                categorias: 100, productos: 100, usuarios: 100, cajas: 100,
                ventas: 100, venta_detalle: 100, movimientos_caja: 100,
                compras: 100, compra_detalle: 100, consignaciones: 100,
                consignacion_detalle: 100, cierres_semanales: 100
            },
            categorias, productos, usuarios, cajas, ventas, venta_detalle,
            movimientos_caja, compras, compra_detalle, consignaciones,
            consignacion_detalle,
            cierres_semanales: []
        };
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                const fresh = seed();
                save(fresh);
                return fresh;
            }
            const data = JSON.parse(raw);
            if (!data || data.__version !== SCHEMA_VERSION) {
                const fresh = seed();
                save(fresh);
                return fresh;
            }
            return data;
        } catch (error) {
            const fresh = seed();
            save(fresh);
            return fresh;
        }
    }

    function save(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function withStore(mutator) {
        const data = load();
        const result = mutator(data);
        save(data);
        return result;
    }

    function nextId(data, table) {
        data.secuencias[table] = (data.secuencias[table] || 0) + 1;
        return data.secuencias[table];
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    // === Categorías =========================================================
    const categorias = {
        listar: () => wait(clone(load().categorias)),
        crear: (payload) => wait(withStore((data) => {
            const id = nextId(data, 'categorias');
            const row = {
                id,
                nombre: payload.nombre,
                tipo: payload.es_consignacion ? 'consignacion' : 'propia',
                es_consignacion: payload.es_consignacion ? 1 : 0,
                activa: 1
            };
            data.categorias.push(row);
            return clone(row);
        })),
        actualizar: (id, payload) => wait(withStore((data) => {
            const idx = data.categorias.findIndex((c) => c.id === id);
            if (idx < 0) return null;
            data.categorias[idx] = {
                ...data.categorias[idx],
                nombre: payload.nombre ?? data.categorias[idx].nombre,
                tipo: payload.es_consignacion ? 'consignacion' : 'propia',
                es_consignacion: payload.es_consignacion ? 1 : 0
            };
            return clone(data.categorias[idx]);
        })),
        eliminar: (id) => wait(withStore((data) => {
            const enUso = data.productos.some((p) => p.categoria_id === id);
            if (enUso) return { ok: false, reason: 'en_uso' };
            data.categorias = data.categorias.filter((c) => c.id !== id);
            return { ok: true };
        }))
    };

    // === Productos ==========================================================
    const productos = {
        listar: () => wait(load().productos.map((p) => enriquecerProducto(p, load()))),
        crear: (payload) => wait(withStore((data) => {
            const id = nextId(data, 'productos');
            const ganancia = (Number(payload.precio_venta) || 0) - (Number(payload.costo) || 0);
            const row = {
                id,
                categoria_id: Number(payload.categoria_id),
                nombre: payload.nombre,
                codigo: payload.codigo || null,
                tipo_producto: payload.tipo_producto || 'propio',
                consignador: payload.consignador || null,
                costo: Number(payload.costo) || 0,
                precio_venta: Number(payload.precio_venta) || 0,
                ganancia,
                unidad: payload.unidad || 'unidad',
                stock_inicial: Number(payload.stock_inicial) || 0,
                stock_actual: Number(payload.stock_inicial) || 0,
                imagen: payload.imagen || '',
                activa: 1
            };
            data.productos.push(row);
            return enriquecerProducto(row, data);
        })),
        actualizar: (id, payload) => wait(withStore((data) => {
            const idx = data.productos.findIndex((p) => p.id === id);
            if (idx < 0) return null;
            const previo = data.productos[idx];
            const costo = payload.costo !== undefined ? Number(payload.costo) : previo.costo;
            const precio_venta = payload.precio_venta !== undefined ? Number(payload.precio_venta) : previo.precio_venta;
            data.productos[idx] = {
                ...previo,
                categoria_id: payload.categoria_id !== undefined ? Number(payload.categoria_id) : previo.categoria_id,
                nombre: payload.nombre ?? previo.nombre,
                codigo: payload.codigo ?? previo.codigo,
                tipo_producto: payload.tipo_producto ?? previo.tipo_producto,
                consignador: payload.consignador ?? previo.consignador,
                costo,
                precio_venta,
                ganancia: precio_venta - costo,
                unidad: payload.unidad ?? previo.unidad,
                stock_actual: payload.stock_actual !== undefined ? Number(payload.stock_actual) : previo.stock_actual,
                imagen: payload.imagen !== undefined ? payload.imagen : previo.imagen,
                activa: payload.activa !== undefined ? (payload.activa ? 1 : 0) : previo.activa
            };
            return enriquecerProducto(data.productos[idx], data);
        })),
        eliminar: (id) => wait(withStore((data) => {
            data.productos = data.productos.filter((p) => p.id !== id);
            return { ok: true };
        })),
        ajustarStock: (id, nuevoStock, motivo) => wait(withStore((data) => {
            const idx = data.productos.findIndex((p) => p.id === id);
            if (idx < 0) return null;
            data.productos[idx].stock_actual = Number(nuevoStock);
            return enriquecerProducto(data.productos[idx], data);
        }))
    };

    function enriquecerProducto(p, data) {
        const cat = data.categorias.find((c) => c.id === p.categoria_id);
        const vendidos = data.venta_detalle
            .filter((d) => d.producto_id === p.id)
            .reduce((sum, d) => sum + d.cantidad, 0);
        return {
            ...p,
            categoria_nombre: cat ? cat.nombre : 'Sin categoría',
            es_consignacion: p.tipo_producto === 'consignacion' ? 1 : 0,
            vendidos
        };
    }

    // === Usuarios ===========================================================
    const usuarios = {
        listar: () => wait(clone(load().usuarios)),
        autenticar: (usuario, clave) => wait(
            load().usuarios.find((u) => u.usuario === usuario && u.clave === clave && u.activo) || null
        ),
        crear: (payload) => wait(withStore((data) => {
            const id = nextId(data, 'usuarios');
            const row = {
                id,
                nombre: payload.nombre,
                usuario: payload.usuario,
                clave: payload.clave,
                rol: payload.rol || 'cajero',
                activo: 1,
                creado_en: todayIso()
            };
            data.usuarios.push(row);
            return clone(row);
        })),
        actualizar: (id, payload) => wait(withStore((data) => {
            const idx = data.usuarios.findIndex((u) => u.id === id);
            if (idx < 0) return null;
            data.usuarios[idx] = {
                ...data.usuarios[idx],
                nombre: payload.nombre ?? data.usuarios[idx].nombre,
                usuario: payload.usuario ?? data.usuarios[idx].usuario,
                rol: payload.rol ?? data.usuarios[idx].rol,
                ...(payload.clave ? { clave: payload.clave } : {})
            };
            return clone(data.usuarios[idx]);
        })),
        eliminar: (id) => wait(withStore((data) => {
            data.usuarios = data.usuarios.filter((u) => u.id !== id);
            return { ok: true };
        }))
    };

    // === Cajas ==============================================================
    const cajas = {
        actual: () => wait(load().cajas.find((c) => c.estado === 'abierta') || null),
        listar: () => wait(clone(load().cajas)),
        abrir: (efectivo_inicial) => wait(withStore((data) => {
            const yaAbierta = data.cajas.find((c) => c.estado === 'abierta');
            if (yaAbierta) return clone(yaAbierta);
            const id = nextId(data, 'cajas');
            const row = {
                id,
                fecha_apertura: todayIso(),
                fecha_cierre: null,
                efectivo_inicial: Number(efectivo_inicial) || 0,
                efectivo_contado: null,
                diferencia: null,
                estado: 'abierta',
                observacion: ''
            };
            data.cajas.push(row);
            return clone(row);
        })),
        cerrar: (id, efectivo_contado, observacion) => wait(withStore((data) => {
            const idx = data.cajas.findIndex((c) => c.id === id);
            if (idx < 0) return null;
            const desglose = computeDesgloseEfectivo(data, id);
            const diferencia = (Number(efectivo_contado) || 0) - desglose.efectivo_esperado;
            data.cajas[idx] = {
                ...data.cajas[idx],
                fecha_cierre: todayIso(),
                efectivo_contado: Number(efectivo_contado) || 0,
                diferencia,
                estado: 'cerrada',
                observacion: observacion || ''
            };
            return { caja: clone(data.cajas[idx]), desglose };
        })),
        desgloseEfectivo: (id) => wait(computeDesgloseEfectivo(load(), id))
    };

    function computeDesgloseEfectivo(data, caja_id) {
        const caja = data.cajas.find((c) => c.id === caja_id);
        if (!caja) return null;
        const efectivo_inicial = caja.efectivo_inicial;
        const ventas_efectivo = data.ventas
            .filter((v) => v.caja_id === caja_id && v.estado !== 'cancelada')
            .reduce((s, v) => s + v.subtotal_efectivo, 0);
        const ventas_transferencia = data.ventas
            .filter((v) => v.caja_id === caja_id && v.estado !== 'cancelada')
            .reduce((s, v) => s + v.subtotal_transferencia, 0);
        const extracciones = data.movimientos_caja
            .filter((m) => m.caja_id === caja_id && m.es_extraccion)
            .reduce((s, m) => s + m.monto, 0);
        const compras_mercancia = data.movimientos_caja
            .filter((m) => m.caja_id === caja_id && m.es_compra_mercancia)
            .reduce((s, m) => s + m.monto, 0);
        const pagos_varios = data.movimientos_caja
            .filter((m) => m.caja_id === caja_id && m.tipo_movimiento === 'pago' && !m.es_extraccion && !m.es_compra_mercancia)
            .reduce((s, m) => s + m.monto, 0);
        const efectivo_esperado = efectivo_inicial + ventas_efectivo - extracciones - compras_mercancia - pagos_varios;
        return {
            caja_id,
            efectivo_inicial,
            ventas_efectivo,
            ventas_transferencia,
            extracciones,
            compras_mercancia,
            pagos_varios,
            efectivo_esperado
        };
    }

    // === Ventas =============================================================
    const ventas = {
        listar: (filtros = {}) => wait(filtrarVentas(load(), filtros)),
        listarPorCaja: (caja_id) => wait(filtrarVentas(load(), { caja_id })),
        obtener: (id) => wait(detalleVenta(load(), id)),
        registrar: (payload) => wait(withStore((data) => {
            const caja = data.cajas.find((c) => c.estado === 'abierta');
            const caja_id = payload.caja_id || (caja ? caja.id : null);
            const id = nextId(data, 'ventas');
            const fecha = todayIso();
            let subtotal_efectivo = Number(payload.subtotal_efectivo) || 0;
            let subtotal_transferencia = Number(payload.subtotal_transferencia) || 0;
            const total = subtotal_efectivo + subtotal_transferencia;
            const tipo_pago = subtotal_efectivo > 0 && subtotal_transferencia > 0
                ? 'mixto'
                : subtotal_transferencia > 0 ? 'transferencia' : 'efectivo';

            let esConsignacionVenta = false;
            (payload.items || []).forEach((item) => {
                const prod = data.productos.find((p) => p.id === item.producto_id);
                if (!prod) return;
                const cantidad = Number(item.cantidad) || 1;
                const precio_unitario = Number(item.precio_unitario ?? prod.precio_venta);
                const costo_unitario = prod.costo;
                const subtotal = cantidad * precio_unitario;
                const ganancia_unitaria = precio_unitario - costo_unitario;
                const es_cons = prod.tipo_producto === 'consignacion' ? 1 : 0;
                if (es_cons) esConsignacionVenta = true;
                data.venta_detalle.push({
                    id: nextId(data, 'venta_detalle'),
                    venta_id: id,
                    producto_id: prod.id,
                    cantidad,
                    costo_unitario,
                    precio_unitario,
                    subtotal,
                    ganancia_unitaria,
                    ganancia_total: ganancia_unitaria * cantidad,
                    es_consignacion: es_cons
                });
                prod.stock_actual = Math.max(0, prod.stock_actual - cantidad);
            });

            data.ventas.push({
                id, caja_id, fecha, tipo_pago, total,
                subtotal_efectivo, subtotal_transferencia,
                es_consignacion: esConsignacionVenta ? 1 : 0,
                estado: 'completada',
                observacion: payload.observacion || ''
            });

            if (caja_id && subtotal_efectivo > 0) {
                data.movimientos_caja.push({
                    id: nextId(data, 'movimientos_caja'),
                    caja_id, fecha,
                    tipo_movimiento: 'venta',
                    concepto: `Venta CAJ-${id}`,
                    monto: subtotal_efectivo,
                    metodo_pago: 'efectivo',
                    relacionado_tipo: 'venta', relacionado_id: id,
                    es_extraccion: 0, es_compra_mercancia: 0
                });
            }

            return detalleVenta(data, id);
        })),
        cancelar: (id) => wait(withStore((data) => {
            const idx = data.ventas.findIndex((v) => v.id === id);
            if (idx < 0) return null;
            data.ventas[idx].estado = 'cancelada';
            data.ventas[idx].cancelada_en = todayIso();
            // Reponer stock
            data.venta_detalle.filter((d) => d.venta_id === id).forEach((d) => {
                const prod = data.productos.find((p) => p.id === d.producto_id);
                if (prod) prod.stock_actual += d.cantidad;
            });
            return clone(data.ventas[idx]);
        }))
    };

    function detalleVenta(data, id) {
        const venta = data.ventas.find((v) => v.id === id);
        if (!venta) return null;
        const items = data.venta_detalle
            .filter((d) => d.venta_id === id)
            .map((d) => {
                const prod = data.productos.find((p) => p.id === d.producto_id);
                const cat = prod ? data.categorias.find((c) => c.id === prod.categoria_id) : null;
                return {
                    ...d,
                    producto_nombre: prod ? prod.nombre : '(producto eliminado)',
                    categoria_nombre: cat ? cat.nombre : ''
                };
            });
        return { ...venta, items };
    }

    function filtrarVentas(data, filtros) {
        let lista = data.ventas.slice();
        if (filtros.caja_id) lista = lista.filter((v) => v.caja_id === filtros.caja_id);
        if (filtros.estado) lista = lista.filter((v) => v.estado === filtros.estado);
        if (filtros.desde) lista = lista.filter((v) => v.fecha >= filtros.desde);
        if (filtros.hasta) lista = lista.filter((v) => v.fecha <= filtros.hasta);
        return lista
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .map((v) => detalleVenta(data, v.id));
    }

    // === Movimientos de caja ================================================
    const movimientos = {
        listar: (caja_id) => wait(load().movimientos_caja.filter((m) => !caja_id || m.caja_id === caja_id).map(clone)),
        registrarExtraccion: (payload) => wait(withStore((data) => {
            const caja = data.cajas.find((c) => c.estado === 'abierta');
            if (!caja) return { ok: false, reason: 'sin_caja_abierta' };
            const id = nextId(data, 'movimientos_caja');
            const row = {
                id, caja_id: caja.id,
                fecha: todayIso(),
                tipo_movimiento: 'extraccion',
                concepto: payload.concepto || 'Extracción de caja',
                monto: Number(payload.monto) || 0,
                metodo_pago: 'efectivo',
                relacionado_tipo: null, relacionado_id: null,
                es_extraccion: 1, es_compra_mercancia: 0,
                responsable: payload.responsable || null
            };
            data.movimientos_caja.push(row);
            return { ok: true, mov: clone(row) };
        })),
        registrarPago: (payload) => wait(withStore((data) => {
            const caja = data.cajas.find((c) => c.estado === 'abierta');
            if (!caja) return { ok: false, reason: 'sin_caja_abierta' };
            const id = nextId(data, 'movimientos_caja');
            const row = {
                id, caja_id: caja.id,
                fecha: todayIso(),
                tipo_movimiento: 'pago',
                concepto: payload.concepto || 'Pago por caja',
                monto: Number(payload.monto) || 0,
                metodo_pago: payload.metodo_pago || 'efectivo',
                relacionado_tipo: null, relacionado_id: null,
                es_extraccion: 0, es_compra_mercancia: 0
            };
            data.movimientos_caja.push(row);
            return { ok: true, mov: clone(row) };
        }))
    };

    // === Compras ============================================================
    const compras = {
        listar: () => wait(load().compras.map((c) => detalleCompra(load(), c.id))),
        registrar: (payload) => wait(withStore((data) => {
            const id = nextId(data, 'compras');
            const fecha = todayIso();
            const items = payload.items || [];
            const total = items.reduce((sum, it) => sum + (Number(it.cantidad) * Number(it.costo_unitario)), 0);
            const descuenta_fondo = payload.descuenta_fondo !== false;
            data.compras.push({
                id, fecha, total,
                metodo_pago: payload.metodo_pago || 'efectivo',
                descuenta_fondo: descuenta_fondo ? 1 : 0,
                procedencia: payload.procedencia || null,
                observacion: payload.observacion || ''
            });

            items.forEach((item) => {
                data.compra_detalle.push({
                    id: nextId(data, 'compra_detalle'),
                    compra_id: id,
                    producto_id: Number(item.producto_id),
                    cantidad: Number(item.cantidad),
                    costo_unitario: Number(item.costo_unitario),
                    subtotal: Number(item.cantidad) * Number(item.costo_unitario)
                });
                const prod = data.productos.find((p) => p.id === Number(item.producto_id));
                if (prod) {
                    prod.stock_actual += Number(item.cantidad);
                    prod.costo = Number(item.costo_unitario);
                    prod.ganancia = prod.precio_venta - prod.costo;
                }
            });

            if (descuenta_fondo) {
                const caja = data.cajas.find((c) => c.estado === 'abierta');
                if (caja) {
                    data.movimientos_caja.push({
                        id: nextId(data, 'movimientos_caja'),
                        caja_id: caja.id, fecha,
                        tipo_movimiento: 'compra_mercancia',
                        concepto: `Compra mercancía #${id}`,
                        monto: total,
                        metodo_pago: payload.metodo_pago || 'efectivo',
                        relacionado_tipo: 'compra', relacionado_id: id,
                        es_extraccion: 0, es_compra_mercancia: 1
                    });
                }
            }

            return detalleCompra(data, id);
        }))
    };

    function detalleCompra(data, id) {
        const c = data.compras.find((x) => x.id === id);
        if (!c) return null;
        const items = data.compra_detalle
            .filter((d) => d.compra_id === id)
            .map((d) => {
                const prod = data.productos.find((p) => p.id === d.producto_id);
                return { ...d, producto_nombre: prod ? prod.nombre : '(producto eliminado)' };
            });
        return { ...c, items };
    }

    // === Consignaciones =====================================================
    const consignaciones = {
        listar: () => wait(load().consignaciones.map((c) => detalleConsignacion(load(), c.id))),
        crear: (payload) => wait(withStore((data) => {
            const id = nextId(data, 'consignaciones');
            data.consignaciones.push({
                id,
                consignador: payload.consignador,
                categoria_id: payload.categoria_id ? Number(payload.categoria_id) : null,
                fecha_inicio: todayIso(),
                fecha_fin: null,
                estado: 'activa',
                observacion: payload.observacion || ''
            });
            return detalleConsignacion(data, id);
        })),
        agregarEntrega: (consignacion_id, item) => wait(withStore((data) => {
            data.consignacion_detalle.push({
                id: nextId(data, 'consignacion_detalle'),
                consignacion_id: Number(consignacion_id),
                producto_id: Number(item.producto_id),
                cantidad_entregada: Number(item.cantidad),
                cantidad_vendida: 0,
                costo_acordado: Number(item.costo_acordado) || 0,
                precio_venta: Number(item.precio_venta) || 0,
                subtotal_venta: 0
            });
            const prod = data.productos.find((p) => p.id === Number(item.producto_id));
            if (prod) prod.stock_actual += Number(item.cantidad);
            return detalleConsignacion(data, Number(consignacion_id));
        })),
        cerrar: (id) => wait(withStore((data) => {
            const idx = data.consignaciones.findIndex((c) => c.id === id);
            if (idx < 0) return null;
            data.consignaciones[idx].estado = 'cerrada';
            data.consignaciones[idx].fecha_fin = todayIso();
            return detalleConsignacion(data, id);
        }))
    };

    function detalleConsignacion(data, id) {
        const c = data.consignaciones.find((x) => x.id === id);
        if (!c) return null;
        const cat = data.categorias.find((x) => x.id === c.categoria_id);
        const items = data.consignacion_detalle
            .filter((d) => d.consignacion_id === id)
            .map((d) => {
                const prod = data.productos.find((p) => p.id === d.producto_id);
                const vendidos = data.venta_detalle
                    .filter((vd) => vd.producto_id === d.producto_id)
                    .reduce((s, vd) => s + vd.cantidad, 0);
                return {
                    ...d,
                    cantidad_vendida: vendidos,
                    subtotal_venta: vendidos * d.precio_venta,
                    producto_nombre: prod ? prod.nombre : '(producto eliminado)',
                    stock_actual: prod ? prod.stock_actual : 0
                };
            });
        return {
            ...c,
            categoria_nombre: cat ? cat.nombre : '',
            items,
            total_vendido: items.reduce((s, i) => s + i.subtotal_venta, 0)
        };
    }

    // === Reportes ===========================================================
    const reportes = {
        semanal: (desde, hasta) => wait(reporteSemanal(load(), desde, hasta)),
        porCategoria: (desde, hasta) => wait(reportePorCategoria(load(), desde, hasta)),
        utilidadPorProducto: (desde, hasta) => wait(reporteUtilidadProducto(load(), desde, hasta))
    };

    function inRange(fechaIso, desde, hasta) {
        if (desde && fechaIso < desde) return false;
        if (hasta && fechaIso > hasta) return false;
        return true;
    }

    function reporteSemanal(data, desde, hasta) {
        const ventasRango = data.ventas.filter((v) => v.estado !== 'cancelada' && inRange(v.fecha, desde, hasta));
        const propias = ventasRango.filter((v) => !v.es_consignacion);
        const cons = ventasRango.filter((v) => v.es_consignacion);

        const venta_total = propias.reduce((s, v) => s + v.total, 0);
        const transferencia_total = propias.reduce((s, v) => s + v.subtotal_transferencia, 0);
        const efectivo_total = propias.reduce((s, v) => s + v.subtotal_efectivo, 0);
        const consignacion_total = cons.reduce((s, v) => s + v.total, 0);

        const utilidad_total = data.venta_detalle
            .filter((d) => {
                const v = data.ventas.find((x) => x.id === d.venta_id);
                return v && v.estado !== 'cancelada' && !v.es_consignacion && inRange(v.fecha, desde, hasta);
            })
            .reduce((s, d) => s + d.ganancia_total, 0);

        const movs = data.movimientos_caja.filter((m) => inRange(m.fecha, desde, hasta));
        const extracciones_total = movs.filter((m) => m.es_extraccion).reduce((s, m) => s + m.monto, 0);
        const compras_total = movs.filter((m) => m.es_compra_mercancia).reduce((s, m) => s + m.monto, 0);

        return {
            desde, hasta,
            venta_total, transferencia_total, efectivo_total,
            extracciones_total, compras_total,
            consignacion_total, utilidad_total,
            diferencia_caja: 0
        };
    }

    function reportePorCategoria(data, desde, hasta) {
        const acumulado = new Map();
        data.venta_detalle.forEach((d) => {
            const v = data.ventas.find((x) => x.id === d.venta_id);
            if (!v || v.estado === 'cancelada' || !inRange(v.fecha, desde, hasta)) return;
            const prod = data.productos.find((p) => p.id === d.producto_id);
            if (!prod) return;
            const cat = data.categorias.find((c) => c.id === prod.categoria_id);
            const key = cat ? cat.id : 'sin';
            const nombre = cat ? cat.nombre : 'Sin categoría';
            const es_cons = cat && cat.es_consignacion;
            if (!acumulado.has(key)) {
                acumulado.set(key, { categoria_id: cat ? cat.id : null, nombre, es_consignacion: es_cons ? 1 : 0, venta_total: 0, utilidad_total: 0, unidades: 0 });
            }
            const row = acumulado.get(key);
            row.venta_total += d.subtotal;
            row.utilidad_total += d.ganancia_total;
            row.unidades += d.cantidad;
        });
        return Array.from(acumulado.values()).sort((a, b) => b.venta_total - a.venta_total);
    }

    function reporteUtilidadProducto(data, desde, hasta) {
        const acumulado = new Map();
        data.venta_detalle.forEach((d) => {
            const v = data.ventas.find((x) => x.id === d.venta_id);
            if (!v || v.estado === 'cancelada' || !inRange(v.fecha, desde, hasta)) return;
            const prod = data.productos.find((p) => p.id === d.producto_id);
            if (!prod) return;
            if (!acumulado.has(prod.id)) {
                const cat = data.categorias.find((c) => c.id === prod.categoria_id);
                acumulado.set(prod.id, {
                    producto_id: prod.id,
                    nombre: prod.nombre,
                    categoria_nombre: cat ? cat.nombre : 'Sin categoría',
                    es_consignacion: prod.tipo_producto === 'consignacion' ? 1 : 0,
                    unidades: 0,
                    venta_total: 0,
                    utilidad_total: 0
                });
            }
            const row = acumulado.get(prod.id);
            row.unidades += d.cantidad;
            row.venta_total += d.subtotal;
            row.utilidad_total += d.ganancia_total;
        });
        return Array.from(acumulado.values()).sort((a, b) => b.utilidad_total - a.utilidad_total);
    }

    // === Util ===============================================================
    function resetDemo() {
        const fresh = seed();
        save(fresh);
        return fresh;
    }

    window.api = {
        categorias, productos, usuarios, cajas, ventas,
        movimientos, compras, consignaciones, reportes,
        resetDemo
    };
})();
