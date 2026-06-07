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
    fecha_apertura  TEXT NOT NULL DEFAULT (datetime('now')),
    fecha_cierre    TEXT,
    efectivo_inicial REAL NOT NULL DEFAULT 0,
    efectivo_contado REAL,
    diferencia      REAL,
    estado          TEXT NOT NULL DEFAULT 'abierta',
    observacion     TEXT DEFAULT ''
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
    FOREIGN KEY (caja_id) REFERENCES cajas(id)
);

CREATE TABLE IF NOT EXISTS compras (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha          TEXT NOT NULL DEFAULT (datetime('now')),
    total          REAL NOT NULL DEFAULT 0,
    metodo_pago    TEXT NOT NULL DEFAULT 'efectivo',
    descuenta_fondo INTEGER NOT NULL DEFAULT 1,
    procedencia    TEXT,
    observacion    TEXT DEFAULT ''
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
    observacion           TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_caja ON ventas(caja_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_caja_fecha ON movimientos_caja(fecha);
CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras(fecha);
CREATE INDEX IF NOT EXISTS idx_consignaciones_estado ON consignaciones(estado);
