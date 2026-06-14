PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT NOT NULL,
    usuario     TEXT NOT NULL UNIQUE,
    clave_hash  TEXT NOT NULL,
    rol         TEXT NOT NULL DEFAULT 'cajero',
    activo      INTEGER NOT NULL DEFAULT 1,
    creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categorias (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre          TEXT NOT NULL UNIQUE,
    tipo            TEXT NOT NULL DEFAULT 'propia',
    es_consignacion INTEGER NOT NULL DEFAULT 0,
    activa          INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS productos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria_id  INTEGER NOT NULL,
    nombre        TEXT NOT NULL,
    codigo        TEXT,
    tipo_producto TEXT NOT NULL DEFAULT 'propio',
    consignador   TEXT,
    costo         REAL NOT NULL DEFAULT 0,
    precio_venta  REAL NOT NULL DEFAULT 0,
    ganancia      REAL NOT NULL DEFAULT 0,
    unidad        TEXT DEFAULT 'unidad',
    stock_inicial REAL NOT NULL DEFAULT 0,
    stock_actual  REAL NOT NULL DEFAULT 0,
    imagen        TEXT DEFAULT '',
    activa        INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE TABLE IF NOT EXISTS cajas_config (
    caja_id      INTEGER NOT NULL,
    categoria_id INTEGER NOT NULL,
    PRIMARY KEY (caja_id, categoria_id),
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE TABLE IF NOT EXISTS cajas (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    numero          INTEGER,
    fecha_apertura  TEXT NOT NULL DEFAULT (datetime('now')),
    fecha_cierre    TEXT,
    efectivo_inicial REAL NOT NULL DEFAULT 0,
    efectivo_contado REAL,
    diferencia      REAL,
    estado          TEXT NOT NULL DEFAULT 'abierta',
    observacion     TEXT DEFAULT '',
    abierta_por_id  INTEGER,
    abierta_por     TEXT
);

CREATE TABLE IF NOT EXISTS ventas (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    caja_id                INTEGER,
    fecha                  TEXT NOT NULL DEFAULT (datetime('now')),
    tipo_pago              TEXT NOT NULL,
    total                  REAL NOT NULL DEFAULT 0,
    subtotal_efectivo      REAL NOT NULL DEFAULT 0,
    subtotal_transferencia REAL NOT NULL DEFAULT 0,
    es_consignacion        INTEGER NOT NULL DEFAULT 0,
    estado                 TEXT NOT NULL DEFAULT 'completada',
    cancelada_en           TEXT,
    observacion            TEXT DEFAULT '',
    cajero_id              INTEGER,
    cajero_nombre          TEXT,
    FOREIGN KEY (caja_id) REFERENCES cajas(id)
);

CREATE TABLE IF NOT EXISTS venta_detalle (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id         INTEGER NOT NULL,
    producto_id      INTEGER NOT NULL,
    cantidad         REAL NOT NULL DEFAULT 1,
    costo_unitario   REAL NOT NULL DEFAULT 0,
    precio_unitario  REAL NOT NULL DEFAULT 0,
    subtotal         REAL NOT NULL DEFAULT 0,
    ganancia_unitaria REAL NOT NULL DEFAULT 0,
    ganancia_total   REAL NOT NULL DEFAULT 0,
    es_consignacion  INTEGER NOT NULL DEFAULT 0,
    perdida_ganancia REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS movimientos_caja (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    caja_id             INTEGER,
    fecha               TEXT NOT NULL DEFAULT (datetime('now')),
    tipo_movimiento     TEXT NOT NULL,
    concepto            TEXT NOT NULL,
    monto               REAL NOT NULL DEFAULT 0,
    metodo_pago         TEXT NOT NULL DEFAULT 'efectivo',
    relacionado_tipo    TEXT,
    relacionado_id      INTEGER,
    es_extraccion       INTEGER NOT NULL DEFAULT 0,
    es_compra_mercancia INTEGER NOT NULL DEFAULT 0,
    responsable         TEXT,
    cajero_id           INTEGER,
    cajero_nombre       TEXT,
    FOREIGN KEY (caja_id) REFERENCES cajas(id)
);

CREATE TABLE IF NOT EXISTS compras (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha          TEXT NOT NULL DEFAULT (datetime('now')),
    total          REAL NOT NULL DEFAULT 0,
    metodo_pago    TEXT NOT NULL DEFAULT 'efectivo',
    descuenta_fondo INTEGER NOT NULL DEFAULT 1,
    procedencia    TEXT,
    observacion    TEXT DEFAULT '',
    cajero_id      INTEGER,
    cajero_nombre  TEXT
);

CREATE TABLE IF NOT EXISTS compra_detalle (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    compra_id     INTEGER NOT NULL,
    producto_id   INTEGER NOT NULL,
    cantidad      REAL NOT NULL DEFAULT 1,
    costo_unitario REAL NOT NULL DEFAULT 0,
    subtotal      REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS consignaciones (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    consignador  TEXT NOT NULL,
    categoria_id INTEGER,
    fecha_inicio TEXT DEFAULT (datetime('now')),
    fecha_fin    TEXT,
    estado       TEXT NOT NULL DEFAULT 'activa',
    observacion  TEXT DEFAULT '',
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE TABLE IF NOT EXISTS consignacion_detalle (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    consignacion_id   INTEGER NOT NULL,
    producto_id       INTEGER NOT NULL,
    cantidad_entregada REAL NOT NULL DEFAULT 0,
    cantidad_vendida  REAL NOT NULL DEFAULT 0,
    costo_acordado    REAL NOT NULL DEFAULT 0,
    precio_venta      REAL NOT NULL DEFAULT 0,
    subtotal_venta    REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (consignacion_id) REFERENCES consignaciones(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS cierres_semanales (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_inicio          TEXT NOT NULL,
    fecha_fin             TEXT NOT NULL,
    venta_total           REAL NOT NULL DEFAULT 0,
    transferencia_total   REAL NOT NULL DEFAULT 0,
    efectivo_total        REAL NOT NULL DEFAULT 0,
    extracciones_total    REAL NOT NULL DEFAULT 0,
    compras_total         REAL NOT NULL DEFAULT 0,
    consignacion_total    REAL NOT NULL DEFAULT 0,
    utilidad_total        REAL NOT NULL DEFAULT 0,
    efectivo_esperado     REAL NOT NULL DEFAULT 0,
    efectivo_contado      REAL NOT NULL DEFAULT 0,
    diferencia            REAL NOT NULL DEFAULT 0,
    observacion           TEXT DEFAULT '',
    venta_costo           REAL,
    utilidad_neta         REAL,
    dividendos            REAL,
    por_socio             REAL,
    socios                INTEGER,
    reserva_pct           REAL,
    deudas_pagadas        REAL,
    faltante_sobrante     REAL,
    cerrada_en            TEXT,
    snapshot              TEXT
);

CREATE TABLE IF NOT EXISTS gastos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha         TEXT NOT NULL DEFAULT (datetime('now')),
    tipo          TEXT NOT NULL DEFAULT 'otro',
    concepto      TEXT DEFAULT '',
    monto         REAL NOT NULL DEFAULT 0,
    socio         TEXT,
    caja_id       INTEGER,
    cajero_id     INTEGER,
    cajero_nombre TEXT,
    FOREIGN KEY (caja_id) REFERENCES cajas(id)
);

CREATE TABLE IF NOT EXISTS cuentas_por_pagar (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha       TEXT NOT NULL DEFAULT (datetime('now')),
    proveedor   TEXT NOT NULL DEFAULT '',
    concepto    TEXT DEFAULT '',
    monto       REAL NOT NULL DEFAULT 0,
    saldo       REAL NOT NULL DEFAULT 0,
    estado      TEXT NOT NULL DEFAULT 'pendiente',
    observacion TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pagos_deuda (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cuenta_id   INTEGER NOT NULL,
    fecha       TEXT NOT NULL DEFAULT (datetime('now')),
    monto       REAL NOT NULL DEFAULT 0,
    metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
    FOREIGN KEY (cuenta_id) REFERENCES cuentas_por_pagar(id) ON DELETE CASCADE
);

-- Bajas / mermas de inventario (roturas, pérdidas, retiros). Descuentan stock.
CREATE TABLE IF NOT EXISTS bajas (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha          TEXT NOT NULL DEFAULT (datetime('now')),
    producto_id    INTEGER NOT NULL,
    cantidad       REAL NOT NULL DEFAULT 0,
    costo_unitario REAL NOT NULL DEFAULT 0,
    razon          TEXT NOT NULL DEFAULT 'merma',
    observacion    TEXT DEFAULT '',
    caja_id        INTEGER,
    cajero_id      INTEGER,
    cajero_nombre  TEXT,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- Ventas a crédito / libreta (fiado). Descuentan stock y crean cuenta por cobrar.
-- Base caja: NO entran al cuadre hasta que se cobran (ver pagos_credito).
CREATE TABLE IF NOT EXISTS creditos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha         TEXT NOT NULL DEFAULT (datetime('now')),
    cliente       TEXT NOT NULL DEFAULT '',
    total         REAL NOT NULL DEFAULT 0,
    saldo         REAL NOT NULL DEFAULT 0,
    estado        TEXT NOT NULL DEFAULT 'activa',
    observacion   TEXT DEFAULT '',
    caja_id       INTEGER,
    cajero_id     INTEGER,
    cajero_nombre TEXT,
    FOREIGN KEY (caja_id) REFERENCES cajas(id)
);

CREATE TABLE IF NOT EXISTS credito_detalle (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    credito_id      INTEGER NOT NULL,
    producto_id     INTEGER NOT NULL,
    cantidad        REAL NOT NULL DEFAULT 1,
    costo_unitario  REAL NOT NULL DEFAULT 0,
    precio_unitario REAL NOT NULL DEFAULT 0,
    subtotal        REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (credito_id) REFERENCES creditos(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS pagos_credito (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    credito_id    INTEGER NOT NULL,
    fecha         TEXT NOT NULL DEFAULT (datetime('now')),
    monto         REAL NOT NULL DEFAULT 0,
    metodo_pago   TEXT NOT NULL DEFAULT 'efectivo',
    caja_id       INTEGER,
    cajero_id     INTEGER,
    cajero_nombre TEXT,
    FOREIGN KEY (credito_id) REFERENCES creditos(id) ON DELETE CASCADE
);

-- Foto del stock por producto al inicio de cada semana (para "stock inicial" del Excel).
CREATE TABLE IF NOT EXISTS stock_snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha       TEXT NOT NULL DEFAULT (datetime('now')),
    producto_id INTEGER NOT NULL,
    stock       REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);
CREATE INDEX IF NOT EXISTS idx_pagos_deuda_cuenta ON pagos_deuda(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_bajas_fecha ON bajas(fecha);
CREATE INDEX IF NOT EXISTS idx_bajas_producto ON bajas(producto_id);
CREATE INDEX IF NOT EXISTS idx_creditos_fecha ON creditos(fecha);
CREATE INDEX IF NOT EXISTS idx_credito_detalle_credito ON credito_detalle(credito_id);
CREATE INDEX IF NOT EXISTS idx_pagos_credito_credito ON pagos_credito(credito_id);
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_fecha ON stock_snapshots(fecha);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_caja ON ventas(caja_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_caja_fecha ON movimientos_caja(fecha);
CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras(fecha);
CREATE INDEX IF NOT EXISTS idx_consignaciones_estado ON consignaciones(estado);
