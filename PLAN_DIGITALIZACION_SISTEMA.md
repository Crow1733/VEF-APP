# Plan de digitalización del sistema VEF

## 1. Objetivo
Digitalizar el sistema actual basado en Excel para que el negocio pueda registrar inventario, ventas, compras, extracciones, consignaciones y cierres semanales con más control, menos errores y reportes más claros.

## 2. Lo que se ve hoy en el Excel
El archivo fuente no es una sola tabla: está armado como un libro con varias hojas y cada una tiene sus propias fórmulas.

Se ve una estructura de este tipo:

- Una hoja base principal con inventario, entradas por día, ventas por día, costo, venta, ganancia y cuadre.
- Varias hojas de categorías que repiten la misma lógica, pero con referencias cruzadas a la hoja base o a otras hojas.
- Hojas especiales de control como cuadre inicial, cuadre semanal y pagos de deudas.
- Hojas operativas especiales como CUSCO, Jesus, Consignacion., Sucel., cuevita. y otras variantes que manejan su propia lógica de entradas, deudas, bajas y ventas.

Eso indica que el negocio ya trabaja con una lógica semanal, por categorías y con cortes de caja, pero además con dependencias entre hojas. La digitalización debe respetar esa forma de trabajo, conservar las reglas de cada bloque y reemplazar la red de fórmulas por cálculos controlados en el sistema.

Por eso el sistema no debe pensar solo en "productos", sino también en "plantillas de hoja", "resúmenes", "cuadres" y "movimientos relacionados".

## 3. Alcance funcional de la nueva versión
El sistema digital debe cubrir estas áreas:

- Catálogo de productos con costo, precio de venta, ganancia y tipo de producto.
- Registro de ventas por método de pago.
- Registro de extracciones de caja separado de las ventas.
- Registro de compras de mercancía como salida de fondo, no como gasto operativo.
- Manejo de consignación como mercancía externa.
- Reportes semanales y por categoría.
- Desglose de efectivo y cuadre de caja.
- Filtros por categoría y por tipo de producto.

## 4. Reglas de negocio que debe respetar el sistema

### 4.1 Ventas y métodos de pago
Cada venta debe poder desglosarse en:

- Efectivo.
- Transferencia.
- Venta total.

La venta total debe consolidar el total del día o del periodo, pero el desglose debe seguir visible para conciliación y auditoría.

### 4.2 Extracciones de caja
Las extracciones no deben mezclarse con ventas ni con compras.

Se debe separar:

- Pagos por caja.
- Extracciones de caja.

Esto permite saber cuánto dinero salió realmente de la caja por retiro, y cuánto salió por operaciones normales.

### 4.3 Compras de mercancía
La compra de mercancía no se debe tratar como gasto operativo.

Debe registrarse como una reducción del fondo o del dinero disponible para inventario, porque representa reposición de mercancía y no pérdida del negocio.

### 4.4 Consignación
Los productos en consignación son productos externos.

Reglas necesarias:

- No totalizarlos como venta propia en el reporte semanal.
- Separarlos de la mercancía propia.
- Mostrar su venta, pero sin inflar utilidad ni inventario propio.
- Marcar cada producto de consignación con una categoría especial.

### 4.5 Categorías especiales para consignación
Debe existir una categoría o subcategoría especial para consignación, por ejemplo:

- Jesus electrodomésticos.
- Consignación general.
- Consignación ropa.

Estas categorías deben identificarse como externas para que el sistema sepa cuándo incluirlas y cuándo excluirlas en reportes financieros propios.

### 4.6 Desglose de efectivo
El sistema debe mostrar el flujo real de efectivo con claridad:

- Efectivo inicial.
- Entradas por ventas en efectivo.
- Salidas por extracciones.
- Salidas por compras de mercancía.
- Pagos varios si existen.
- Efectivo final esperado.
- Efectivo contado.
- Diferencia de cuadre.

## 5. Estructura recomendada del sistema

### 5.1 Módulo de productos
Cada producto debe guardar:

- Nombre.
- Categoría.
- Si es propio o de consignación.
- Precio de coste.
- Precio de venta.
- Ganancia calculada.
- Stock inicial.
- Entradas.
- Salidas.
- Observaciones.

### 5.2 Módulo de ventas
Cada venta debe registrar:

- Fecha.
- Producto o productos.
- Categoría.
- Cantidad.
- Total.
- Forma de pago.
- Si pertenece a consignación.

### 5.3 Módulo de caja
Debe manejar:

- Apertura de caja.
- Cierre de caja.
- Ventas en efectivo.
- Transferencias.
- Extracciones de caja.
- Pagos por caja.
- Compras que descuentan del fondo.

### 5.4 Módulo de compras
Cada compra debe guardar:

- Fecha.
- Producto.
- Cantidad.
- Costo unitario.
- Total.
- Si descuenta del fondo o de una cuenta específica.
- Observación libre (donde se compró, a quién, etc.).

El negocio no trabaja con un catálogo fijo de proveedores, por eso no existe entidad "proveedor". Si hace falta dejar registro de la procedencia, se anota como texto libre dentro de la observación.

### 5.5 Módulo de reportes
Debe permitir:

- Reporte semanal.
- Reporte por día.
- Reporte por categoría.
- Reporte por forma de pago.
- Reporte de consignación separado.
- Reporte de caja y extracciones.
- Reporte de utilidad por producto.

### 5.6 Base de datos local con SQLite
La aplicación debe usar SQLite como base local principal para guardar toda la información del sistema.

Razones:

- Funciona bien en un entorno local o de escritorio.
- No requiere un servidor externo para empezar.
- Permite relaciones claras entre productos, ventas, caja, compras y consignación.
- Es suficiente para reemplazar la lógica distribuida del Excel con una estructura única y consistente.

La idea es que cada hoja del Excel quede representada por una combinación de tablas y vistas, no por una hoja suelta con fórmulas manuales.

## 6. Requisitos de reportes

### 6.1 Reporte semanal
Debe incluir:

- Venta total.
- Transferencia.
- Efectivo.
- Extracciones separadas.
- Compras de mercancía separadas.
- Utilidad total.
- Diferencia de caja.

Debe excluir de la suma principal los productos de consignación, o mostrarlos en un bloque aparte para que no alteren el rendimiento real del negocio.

### 6.2 Filtro por categorías
El usuario debe poder filtrar reportes por categoría para ver resultados de una familia de productos concreta.

Ejemplos:

- Aseo.
- Cocina.
- Talabartería.
- Electrodomésticos.
- Consignación.

### 6.3 Reporte de utilidad
La utilidad debe calcularse con base en:

- Precio de venta.
- Precio de coste.
- Cantidad vendida.

Debe ser visible por producto, por categoría y por periodo.

## 7. Modelo de datos sugerido

### 7.1 Entidades principales
- Productos.
- Categorías.
- Ventas.
- Detalle de ventas.
- Caja.
- Movimientos de caja.
- Compras.
- Consignaciones.
- Cierres semanales.
- Usuarios.

> Nota: el negocio no maneja un catálogo fijo de proveedores. La consignación se identifica con un nombre de consignador en texto libre (por ejemplo "Jesús electrodomésticos") y las compras dejan la procedencia en su observación. No existe la tabla `proveedores`.

### 7.2 Campos clave para productos
- id.
- nombre.
- categoria_id.
- tipo_producto: propio o consignación.
- costo.
- precio_venta.
- ganancia.
- activo.

### 7.3 Campos clave para movimientos de caja
- id.
- fecha.
- tipo_movimiento.
- concepto.
- monto.
- método_pago.
- relacionado_con_venta.
- relacionado_con_compra.
- relacionado_con_extracción.

### 7.4 Esquema SQLite propuesto
Este es el sistema base de tablas recomendado para manejar toda la información del Excel:

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE usuarios (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	nombre TEXT NOT NULL,
	usuario TEXT NOT NULL UNIQUE,
	clave_hash TEXT NOT NULL,
	rol TEXT NOT NULL DEFAULT 'usuario',
	activo INTEGER NOT NULL DEFAULT 1,
	creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categorias (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	nombre TEXT NOT NULL UNIQUE,
	tipo TEXT NOT NULL DEFAULT 'propia',
	es_consignacion INTEGER NOT NULL DEFAULT 0,
	activa INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE productos (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	categoria_id INTEGER NOT NULL,
	nombre TEXT NOT NULL,
	codigo TEXT,
	tipo_producto TEXT NOT NULL DEFAULT 'propio',
	consignador TEXT,
	costo REAL NOT NULL DEFAULT 0,
	precio_venta REAL NOT NULL DEFAULT 0,
	ganancia REAL NOT NULL DEFAULT 0,
	unidad TEXT DEFAULT 'unidad',
	stock_inicial REAL NOT NULL DEFAULT 0,
	stock_actual REAL NOT NULL DEFAULT 0,
	activa INTEGER NOT NULL DEFAULT 1,
	FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE TABLE cajas (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	fecha_apertura TEXT NOT NULL,
	fecha_cierre TEXT,
	efectivo_inicial REAL NOT NULL DEFAULT 0,
	efectivo_contado REAL,
	diferencia REAL,
	estado TEXT NOT NULL DEFAULT 'abierta',
	observacion TEXT
);

CREATE TABLE ventas (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	caja_id INTEGER,
	fecha TEXT NOT NULL,
	tipo_pago TEXT NOT NULL,
	total REAL NOT NULL DEFAULT 0,
	subtotal_efectivo REAL NOT NULL DEFAULT 0,
	subtotal_transferencia REAL NOT NULL DEFAULT 0,
	es_consignacion INTEGER NOT NULL DEFAULT 0,
	observacion TEXT,
	FOREIGN KEY (caja_id) REFERENCES cajas(id)
);

CREATE TABLE venta_detalle (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	venta_id INTEGER NOT NULL,
	producto_id INTEGER NOT NULL,
	cantidad REAL NOT NULL DEFAULT 1,
	costo_unitario REAL NOT NULL DEFAULT 0,
	precio_unitario REAL NOT NULL DEFAULT 0,
	subtotal REAL NOT NULL DEFAULT 0,
	ganancia_unitaria REAL NOT NULL DEFAULT 0,
	ganancia_total REAL NOT NULL DEFAULT 0,
	es_consignacion INTEGER NOT NULL DEFAULT 0,
	FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
	FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE movimientos_caja (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	caja_id INTEGER,
	fecha TEXT NOT NULL,
	tipo_movimiento TEXT NOT NULL,
	concepto TEXT NOT NULL,
	monto REAL NOT NULL DEFAULT 0,
	metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
	relacionado_tipo TEXT,
	relacionado_id INTEGER,
	es_extraccion INTEGER NOT NULL DEFAULT 0,
	es_compra_mercancia INTEGER NOT NULL DEFAULT 0,
	FOREIGN KEY (caja_id) REFERENCES cajas(id)
);

CREATE TABLE compras (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	fecha TEXT NOT NULL,
	total REAL NOT NULL DEFAULT 0,
	metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
	descuenta_fondo INTEGER NOT NULL DEFAULT 1,
	procedencia TEXT,
	observacion TEXT
);

CREATE TABLE compra_detalle (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	compra_id INTEGER NOT NULL,
	producto_id INTEGER NOT NULL,
	cantidad REAL NOT NULL DEFAULT 1,
	costo_unitario REAL NOT NULL DEFAULT 0,
	subtotal REAL NOT NULL DEFAULT 0,
	FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE,
	FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE consignaciones (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	consignador TEXT NOT NULL,
	categoria_id INTEGER,
	fecha_inicio TEXT,
	fecha_fin TEXT,
	estado TEXT NOT NULL DEFAULT 'activa',
	observacion TEXT,
	FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE TABLE consignacion_detalle (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	consignacion_id INTEGER NOT NULL,
	producto_id INTEGER NOT NULL,
	cantidad_entregada REAL NOT NULL DEFAULT 0,
	cantidad_vendida REAL NOT NULL DEFAULT 0,
	costo_acordado REAL NOT NULL DEFAULT 0,
	precio_venta REAL NOT NULL DEFAULT 0,
	subtotal_venta REAL NOT NULL DEFAULT 0,
	FOREIGN KEY (consignacion_id) REFERENCES consignaciones(id) ON DELETE CASCADE,
	FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE cierres_semanales (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	fecha_inicio TEXT NOT NULL,
	fecha_fin TEXT NOT NULL,
	venta_total REAL NOT NULL DEFAULT 0,
	transferencia_total REAL NOT NULL DEFAULT 0,
	efectivo_total REAL NOT NULL DEFAULT 0,
	extracciones_total REAL NOT NULL DEFAULT 0,
	compras_total REAL NOT NULL DEFAULT 0,
	consignacion_total REAL NOT NULL DEFAULT 0,
	utilidad_total REAL NOT NULL DEFAULT 0,
	efectivo_esperado REAL NOT NULL DEFAULT 0,
	efectivo_contado REAL NOT NULL DEFAULT 0,
	diferencia REAL NOT NULL DEFAULT 0,
	observacion TEXT
);

CREATE TABLE cierre_semanal_detalle_categoria (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	cierre_semanal_id INTEGER NOT NULL,
	categoria_id INTEGER NOT NULL,
	venta_total REAL NOT NULL DEFAULT 0,
	utilidad_total REAL NOT NULL DEFAULT 0,
	consignacion_total REAL NOT NULL DEFAULT 0,
	FOREIGN KEY (cierre_semanal_id) REFERENCES cierres_semanales(id) ON DELETE CASCADE,
	FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_ventas_fecha ON ventas(fecha);
CREATE INDEX idx_ventas_caja ON ventas(caja_id);
CREATE INDEX idx_movimientos_caja_fecha ON movimientos_caja(fecha);
CREATE INDEX idx_compras_fecha ON compras(fecha);
CREATE INDEX idx_consignaciones_estado ON consignaciones(estado);
```

### 7.5 Cómo se mapea el Excel a SQLite
- Las hojas de categoría pasan a ser registros en `categorias` y `productos`.
- Las columnas de costo, venta y ganancia pasan a `productos` y `venta_detalle`.
- Los totales por día y semana pasan a `ventas` y `cierres_semanales`.
- Las extracciones y pagos de caja pasan a `movimientos_caja`.
- Las mercancías compradas pasan a `compras` y `compra_detalle`.
- La mercancía externa o de consignación pasa a `consignaciones` y `consignacion_detalle`.
- Las hojas de cuadre inicial y cuadre semanal pasan a `cajas` y `cierres_semanales`.

## 8. Reglas de cálculo recomendadas

### 8.1 Ganancia por producto
Ganancia = precio de venta - precio de coste.

### 8.2 Ganancia total
Ganancia total = suma de ganancia por unidad vendida multiplicada por cantidad vendida.

### 8.3 Efectivo esperado
Efectivo esperado = efectivo inicial + ventas en efectivo - extracciones - compras pagadas desde caja + otros ingresos menos otras salidas autorizadas.

### 8.4 Tratamiento de consignación
La venta de consignación puede registrarse para control operativo, pero no debe sumarse igual que la venta de mercancía propia en el cierre semanal principal.

## 9. Migración desde el Excel

### Fase 1. Levantamiento
- Identificar todas las hojas por categoría.
- Unificar nombres duplicados o con variantes de ortografía.
- Detectar productos propios y productos de consignación.

### Fase 2. Limpieza de datos
- Normalizar categorías.
- Corregir productos repetidos.
- Separar cuentas de caja, extracciones y compras.

### Fase 3. Carga inicial
- Cargar categorías.
- Cargar productos.
- Cargar consignadores (nombres) que ya hayan dejado mercancía en el negocio.
- Cargar saldos iniciales y fondos.

### Fase 4. Validación
- Comparar totales del sistema con los del Excel.
- Revisar cuadre de efectivo.
- Verificar que la consignación no infle el semanal.

## 10. Roadmap de implementación

### Etapa 1. Base operativa
- Login y usuarios.
- Catálogo de categorías y productos.
- Coste, precio y ganancia.

### Etapa 2. Caja y ventas
- Registro de ventas.
- Efectivo, transferencia y venta total.
- Extracciones separadas.
- Compras descontadas del fondo.

### Etapa 3. Consignación y reportes
- Tipo de producto consignación.
- Categorías especiales externas.
- Reporte semanal excluyendo consignación.
- Filtros por categoría.

### Etapa 4. Cuadre y control
- Desglose de efectivo.
- Cierres diarios y semanales.
- Alertas de diferencias.
- Historial de movimientos.

## 11. Prioridades de negocio
Orden recomendado de construcción:

1. Caja y ventas.
2. Productos con costo, venta y ganancia.
3. Extracciones separadas.
4. Compras como reducción de fondo.
5. Consignación con categoría especial.
6. Reportes por categoría y semanal.
7. Desglose de efectivo y cuadre final.

## 12. Criterios de aceptación
El sistema se puede considerar bien digitalizado cuando:

- Una venta puede registrarse por efectivo o transferencia.
- Las extracciones quedan separadas de las ventas.
- Las compras de mercancía descuentan del fondo y no se confunden con gasto.
- Cada producto tiene coste, venta y ganancia.
- Los reportes permiten filtrar por categorías.
- La consignación no se suma al total semanal propio.
- Las categorías especiales de consignación quedan claramente identificadas.
- El cuadre de efectivo muestra entradas, salidas y diferencia final.

## 13. Resultado esperado
Al terminar la digitalización, el negocio debería poder operar sin depender del Excel como sistema principal, manteniendo la lógica que ya usa, pero con mejor trazabilidad, menos errores de cálculo y reportes claros para ventas, caja, consignación y utilidad real.