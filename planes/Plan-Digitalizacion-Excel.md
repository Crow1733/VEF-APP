# Plan de digitalización — Excel → Sistema VEF

> Objetivo: pasar **todo** el Excel semanal `19.1-SEMANA del 11 al 16 de mayo.xlsx`
> (33 hojas, "Bazar Ojos Color Sol") al sistema, **sin perder ninguna funcionalidad
> ni fórmula**. El plan está ordenado **por relaciones de dependencia** (no por
> prioridad): primero lo que no depende de nada y se va escalando, de forma que la
> app **siga funcionando** después de cada capa.
>
> Convención de estado: ✅ hecho · ⚠️ parcial · ❌ falta.

---

## 0. Modelo mental del Excel

El libro es **una semana** de operación. Hay 4 macro-procesos encadenados:

1. **Catálogo + venta diaria** — 16 hojas, una por categoría/proveedor. Cada hoja
   es a la vez inventario y libro de ventas diarias (columnas `Entra./Venta` por día).
2. **Cuadre inicial** (`CUADRE INICIAL`) — **agrega** todas las hojas de producto:
   venta del día, venta al costo/venta/utilidad y valor de la mercancía.
3. **Cuadre de la semana** (`CUADRE DE LA SEMANA`) — el **P&L semanal**: ventas −
   pérdidas − costo − gastos − impuestos = utilidad neta → **reparto entre socios**.
4. **Auxiliares**: liquidación a consignadores (ledgers por proveedor), cuentas por
   pagar / pago de deudas, y comparación multi-semana (`Hoja1`).

Dualidad importante: cada proveedor/área suele tener **dos hojas**:
- una **catálogo** (≈560 filas, con movimiento diario `Entra./Venta`), y
- un **ledger** con punto (`Sucel.`, `Consignacion.`, `cuentas x pagar.`…) que resume
  `Entradas/Deudas/Bajas/Ventas/Importe al costo/Final`.

En el sistema digital **ambas colapsan** en `productos` + `ventas` + un **reporte de
liquidación** (la venta diaria ya la hace el POS).

---

## 1. Inventario de las 33 hojas

| # | Hoja | Qué es | Estado | Tabla(s) BD | Depende de (hojas Excel) |
|---|------|--------|--------|-------------|--------------------------|
| 0 | `Lienzos y espejos` | Catálogo propia (**hoja maestra** de las fórmulas diarias `AH..AN`) | ✅ | `categorias`,`productos`,`ventas` | — |
| 1 | `Ceramica y Reloj` | Catálogo propia | ✅ | `productos`,`ventas` | — |
| 2 | `Aseo` | Catálogo propia | ✅ | `productos`,`ventas` | — |
| 3 | `COSITAS ` | Catálogo propia | ✅ | `productos`,`ventas` | — |
| 4 | `TALABARTERIA ` | Catálogo propia | ✅ | `productos`,`ventas` | — |
| 5 | `Madera-Utiles del hogar` | Catálogo propia | ✅ | `productos`,`ventas` | — |
| 6 | `COCINA ` | Catálogo propia | ✅ | `productos`,`ventas` | — |
| 7 | `ARREGLOS FLORALES,BICHOS` | Catálogo propia | ✅ | `productos`,`ventas` | — |
| 12 | `Electrodomestico Bazar` | Catálogo propia | ✅ | `productos`,`ventas` | — |
| 8 | `CONSIGNACION ` | Catálogo consignación general | ✅ catálogo / ⚠️ liquidación | `productos(consignador)` | — |
| 9 | `Jesus otros` | Catálogo consignación (Jesús) | ✅ / ⚠️ | `productos` | — |
| 10 | `Jesus ropa calzado` | Catálogo consignación (Jesús) | ✅ / ⚠️ | `productos` | — |
| 11 | `Jesus electrodomesticos` | Catálogo consignación (Jesús) | ✅ / ⚠️ | `productos` | — |
| 13 | `Sucel` | Catálogo consignación (Sucel) | ✅ / ⚠️ | `productos` | — |
| 14 | `Cusco-Yanley` | Catálogo consignación (Cusco/Yanley) | ✅ / ⚠️ | `productos` | — |
| 15 | `cuentas xpagar` | Catálogo **mercancía a deuda** (estilo producto + días) | ❌ | `cuentas_por_pagar` (nueva) | — |
| 16 | `Stan Especial` | Catálogo **stand especial** (estilo producto + días) | ❌ | `categorias`/`productos` (+flag stand) | — |
| 17 | `disponible` | Catálogo "Zapatos Cusco" (estilo producto + días) | ❌ | `productos` | — |
| 20 | `CUSCO` | **Ledger** consignador Cusco (a pagar) | ❌ | `liquidaciones_consignacion` (reporte) | catálogo Cusco, `ventas` |
| 21 | `Jesus` | **Ledger** consignador Jesús (a pagar) | ❌ | idem | catálogo Jesús, `ventas` |
| 22 | `Consignacion.` | **Ledger** consignación general | ❌ | idem | `CONSIGNACION `, `ventas` |
| 23 | `Sucel.` | **Ledger** consignador Sucel | ❌ | idem | `Sucel`, `ventas` |
| 25 | `cuevita.` | **Ledger** consignador Cuevita | ❌ | idem | catálogo cuevita, `ventas` |
| 27 | `Yani` | **Ledger** consignador Yani | ❌ | idem | catálogo Yani, `ventas` |
| 26 | `Stan Especial.` | **Ledger** del stand especial | ❌ | reporte inventario | `Stan Especial`, `ventas` |
| 24 | `cuentas x pagar.` | **Ledger** de cuentas por pagar | ❌ | `cuentas_por_pagar` | `cuentas xpagar`, `ventas` |
| 28 | `Pago de Deudas por Semana ` | Pagos de deudas de la semana | ❌ | `pagos_deuda` (nueva) | `cuentas_por_pagar` |
| 18 | `CUADRE INICIAL ` | **Agregación** de catálogos (venta diaria, costo, mercancía) | ❌ | `semanas`/reporte | TODAS las de producto |
| 19 | `CUADRE DE LA SEMANA ` | **P&L semanal + reparto** | ❌ | `cierres_semanales`,`gastos`,`semanas` | `CUADRE INICIAL`, ledgers, `gastos` |
| 29 | `Hoja1` | Comparación **multi-semana** + reparto | ❌ | `cierres_semanales` | varios `CUADRE` |
| 30-32 | `Hoja2/3/4` | Borradores/scratch | n/a | — | — |

---

## 2. Estado del modelo de datos

### Tablas existentes (backend/schema.sql)
| Tabla | Cubre del Excel | Estado |
|-------|-----------------|--------|
| `usuarios` | login (no estaba en Excel, es nuevo) | ✅ |
| `categorias` | nombre de cada hoja de catálogo | ✅ |
| `productos` | filas de las hojas de catálogo (costo, venta, ganancia, stock, consignador) | ✅ |
| `cajas_config` | qué categorías ve cada caja (1/2/3) | ✅ |
| `cajas` | apertura/cierre por registradora (faltante/sobrante = `diferencia`) | ✅ |
| `ventas` + `venta_detalle` | venta diaria de las hojas de producto | ✅ |
| `movimientos_caja` | extracciones, pagos, compras de mercancía | ✅ |
| `compras` + `compra_detalle` | reposición de stock (columnas `Entra.`) | ⚠️ solo al contado |
| `consignaciones` + `consignacion_detalle` | entregas de consignación | ⚠️ sin UI ni liquidación |
| `cierres_semanales` | **el cuadre semanal** | ❌ existe en schema pero **sin usar** |

### Tablas nuevas propuestas
| Tabla | Para qué | Hojas |
|-------|----------|-------|
| `semanas` | entidad "semana" (rango de fechas, estado) que agrupa el cierre | el archivo entero = 1 semana |
| `gastos` | gastos categorizados (salario, transporte, ONAT, arrendamiento, contador, estimulación, individual por socio) | `CUADRE DE LA SEMANA` cols F,G,H,I,J + E24..E26 |
| `cuentas_por_pagar` | mercancía comprada a deuda (saldo pendiente) | `cuentas xpagar`, `cuentas x pagar.` |
| `pagos_deuda` | pagos de deuda por semana | `Pago de Deudas por Semana ` |
| `liquidaciones_consignacion` | snapshot de lo pagado a cada consignador por semana (opcional; lo demás es reporte) | ledgers `CUSCO`,`Jesus`,… |
| `socios` (opcional) | socios para el reparto (Jesús, Enrique, Noslen) | `CUADRE`/`Hoja1` reparto |

---

## 3. Diccionario de columnas y fórmulas (para no perder nada)

### 3.1 Hoja de PRODUCTO (Aseo, Cocina, … — 16 hojas)
Encabezados en fila 7; totales en fila 8; productos desde fila 9.

| Col | Significado | Fórmula |
|-----|-------------|---------|
| A | No. orden | — |
| B | Costo | — |
| C | Venta (precio) | — |
| D | Ganancia | `=C-B` |
| E | Producto (nombre) | — |
| F | Stock inicial (inventario inicio semana) | — |
| G,I,K,M,O,Q,S | **Entradas** por día (Dom..Sáb) | — |
| H,J,L,N,P,R,T | **Ventas** (uds) por día (Dom..Sáb) | — |
| U | Venta total (uds) | `=H+J+L+N+P+R+T` |
| V | Deuda · W | Baja semanal | — |
| X | **Stock final** | `=F + (G+I+K+M+O+Q+S) − (H+J+L+N+P+R+T)` |
| Y | Entradas (uds) | `=G+I+K+M+O+Q+S` |
| Z | Entradas ($) | `=Y*B` |
| AA..AG | Venta ($) por día | `=H*C`, `=J*C`, … |
| AH..AN | Venta ($) por día (total columna, Dom..Sáb) | `=ΣAA9.. , ΣAB9..` |
| AP | **Venta al costo** | `=U*B` (total fila 8: `=SUM(AP9:AP170)`) |
| AQ | **Venta a la venta** | `=U*C` |
| AR | **Utilidad** | `=AQ-AP` |
| AS | **$ en Mercancía** (inventario al costo) | `=X*B` |

> En digital: `venta_detalle` ya guarda `cantidad`, `costo_unitario`, `precio_unitario`,
> `subtotal`, `ganancia_total`. Por tanto `AP/AQ/AR` por producto = sumas sobre
> `venta_detalle`; `AS` (mercancía) = `Σ productos.stock_actual * costo`; `Z` (entradas)
> = `Σ compra_detalle.cantidad * costo`. La venta diaria = `ventas` agrupadas por fecha.

### 3.2 Hoja LEDGER de consignador / cuentas por pagar (`Jesus`, `CUSCO`, `Sucel.`, `Consignacion.`, `cuentas x pagar.`)
| Col | Significado | Fórmula |
|-----|-------------|---------|
| A | No · B | Costo · C | Producto | — |
| D | Inicio (stock inicial) | — |
| E | Entradas · F | Deudas · G | Bajas | — |
| H | **Ventas (uds)** | — |
| I | **Importe al costo (a pagar)** | `=H*B` |
| J | **Final (stock)** | `=D+E-G-H` |
| (fin) | Total a pagar al consignador | `=SUM(I6:I259)`  (ej. `Jesus!I260`) |

> En digital: la **liquidación** de un consignador en una semana =
> `Σ (venta_detalle.cantidad * venta_detalle.costo_unitario)` de los productos cuyo
> `productos.consignador = X` y `ventas.fecha` dentro de la semana. No requiere las
> "entregas" del modelo `consignaciones`; basta un **reporte** (+ snapshot opcional).

### 3.3 `Pago de Deudas por Semana `
Cols: `No | Fecha compra | Nombre | Producto | Costo | Vendido | Cantidad | Pagado(Si/No) | Fecha`.
`EFECTIVO PAGADO = Vendido * Cantidad`; totales en fila 30 (`=Σ`).

### 3.4 `CUADRE INICIAL ` (agregación de catálogos)
| Celda | Significado | Fórmula |
|-------|-------------|---------|
| A5..G5 | Venta del día (Dom..Sáb) | `=ΣHoja!AH9 ... ΣHoja!AN9` (suma de TODAS las hojas) |
| H5 | Venta semanal | `=A5+…+G5` |
| A7 | **Total venta al costo** | `=Σ Hoja!AP8` |
| B7 | **Total venta a la venta** | `=Σ Hoja!AQ8` |
| C7 | **Utilidad total** | `=Σ Hoja!AR8` |
| D7 | **Importe en mercancía** | `=Σ Hoja!AS8` |
| G8..G25 | Mercancía ($) por categoría/proveedor | `='COCINA '!AS8`, `=Consignacion!AR8`, … |
| B15 | Importe de entradas semanal | `=Σ Hoja!Z8` |
| A15 | Importe al inicio (manual) | — |
| C15 | Total en mercancía | `=A15+B15` |

### 3.5 `CUADRE DE LA SEMANA ` (P&L + reparto) — núcleo
Filas diarias 10..16 (Dom..Sáb), columnas:
`C Venta diaria · D Transferencia Jesús · E Transferencia · F Salarios · G Carros/Corriente/Otras · H Pagos de la Caja · I Jesús(indiv.) · J Enrique(indiv.) · K Faltante · L Pérdida de ganancia · M Ganancia por elevación · N Sobrante · O Efectivo`.

| Celda | Significado | Fórmula |
|-------|-------------|---------|
| C10..C16 | Venta diaria | `='CUADRE INICIAL '!A5..G5` |
| O (día) | **Efectivo neto del día** | `=C - D - E - F - G - H - I - J - K` |
| fila 17 | Totales | `=ΣC10:C16`, … |
| E18 | Total venta semanal | `=C17` |
| E19 | Pérdida de ganancia | `=L17` |
| E20 | **Venta real** | `=E18-E19` |
| E21 | Venta al costo | `='CUADRE INICIAL '!A7` |
| E22 | **Utilidad bruta** | `=E18-E19-E21` |
| E23 | Gastos semanal | `=F17+G17` |
| E24 | ONAT y arrendamiento | manual |
| E25 | (Salario contador) | manual |
| E26 | Pago de estimulación | `=U29` |
| E27 | **Utilidad neta** | `=E22-E23-E24-E25-E26` |
| E28 | Reserva 20% | `=E27*20/100` |
| E29 | **Dividendos a repartir** | `=E27-E28` |
| E30 | Entre 2 (por socio) | `=E29/2` |
| I21 | Salario Jesús | `=E30 - I17 - D17` |
| J21 | Salario Enrique | `=E30 - J17` |
| G36 | Importe de efectivo | `=O17 + E17 + D17` |
| G37..G43 | A pagar a consignadores | `=CUSCO!I120`, `=Consignacion.!I174`, `=Jesus!I260`, `=Sucel.!I194` |
| G39 | Cuentas por pagar | `='cuentas xpagar'!AP8` |
| G54 | **Total del Bazar (efectivo que queda)** | `=G36 − Cusco − cxp − Consig − Jesus − Sucel − 20% − ONAT − Estim − SalJesus − SalEnrique` |

### 3.6 `Hoja1` (multi-semana + reparto entre 3)
Compara semanas (col E,F = semanas; G = unión `=E+F`). Reparto:
`Total = Utilidad − Gastos − Pérdida − ONAT − SalContador − Estimulación`;
`20% = Total*20%`; `Diferencia a repartir = Total − 20%`; `Entre 3 = /3`
(socios: Jesús, Enrique, Noslen). Lado derecho: efectivo por proveedor y por socio.

---

## 4. Plan por **capas de dependencia** (orden de construcción)

> Regla: cada capa **solo consume** tablas de capas anteriores → la app sigue
> funcional después de cada una. No es orden de prioridad, es orden topológico.

### Capa 0 — Fundacionales (sin dependencias) — ✅ HECHO
- `usuarios`, `categorias`.
- `productos` → depende de `categorias`. (hojas de catálogo)
- `cajas_config` → depende de `categorias`. (3 cajas × categorías)

**Funcional tras la capa:** catálogo navegable, login, config de cajas.

### Capa 1 — Operación de caja (depende de Capa 0) — ✅ HECHO
- `cajas` (apertura/cierre por registradora; `diferencia` = faltante/sobrante).
- `ventas` + `venta_detalle` → cubre la **venta diaria** de las hojas de producto.
  Fórmulas: `subtotal = cantidad*precio`, `ganancia = (precio-costo)*cantidad`.
- `movimientos_caja` (extracción, pago, compra_mercancia).
- `compras` + `compra_detalle` (reposición → columnas `Entra.`). ⚠️ solo contado.

**Funcional tras la capa:** vender, cobrar, abrir/cerrar caja. (Estado actual del sistema.)

### Capa 2 — Inventario valorado (depende de Capa 1) — ✅ HECHO

> `GET /api/reportes/inventario` + Admin → Economía → **Inventario**. Por categoría y
> total: productos, unidades, valor al costo, valor a la venta, utilidad potencial.
> (Verificado con datos reales: 916 productos, $4.929.920 al costo.)

Reporte (sin tabla nueva obligatoria):
- **$ en mercancía** = `Σ productos.stock_actual * costo`, por categoría y total
  (Excel: `AS8` por hoja → `CUADRE INICIAL!D7`).
- **Entradas valoradas** = `Σ compra_detalle.cantidad * costo` (Excel: `Z8`).
- Stock final por producto (ya es `stock_actual`).
- (Opcional) tabla `inventario_snapshot(semana_id, categoria_id, valor)` para histórico.

**Depende de hojas:** todas las de producto. **Funcional:** añade reporte; no rompe nada.

### Capa 3 — Gastos (depende de Capa 0; alimenta el cuadre) — ✅ HECHO

> Tabla `gastos` + router `/api/gastos` (listar/crear/eliminar) + Admin → Economía →
> **Gastos** (formulario por tipo + lista con total). Cada gasto se etiqueta con el
> cajero que lo registró.

- **Nueva tabla `gastos`**: `id, fecha, tipo, concepto, monto, socio_id?, caja_id?, semana_id?`.
  `tipo ∈ {salario, transporte, onat, arrendamiento, contador, estimulacion, individual, otro}`.
- Mapeo Excel → `gastos`: `CUADRE DE LA SEMANA` cols F (salarios), G (carros/corriente),
  H (pagos de caja), I/J (individual Jesús/Enrique), E24 (ONAT/arrendamiento), E25
  (contador), E26 (estimulación).
- Decisión: los "pagos de caja" ya existen como `movimientos_caja(tipo='pago')`; o se
  unifican como vista, o `gastos` referencia el movimiento. (Recomendado: `gastos`
  aparte y, si descuenta caja, además crea un `movimiento_caja`.)

**Depende de hojas:** `CUADRE DE LA SEMANA`. **Funcional:** módulo de gastos independiente.

### Capa 4 — Liquidación de consignaciones (depende de Capa 1) — ✅ HECHO

> `GET /api/reportes/consignaciones` + Admin → Economía → **Consignaciones** (filtro de
> período + cajas). Por consignador: unidades vendidas, **a pagar = Σ(cantidad×costo)**,
> venta y utilidad del bazar. Verificado (2×$300 → a pagar $600).

- **Reporte de liquidación por consignador** y semana:
  `a_pagar = Σ (venta_detalle.cantidad * costo_unitario)` de productos con
  `consignador = X` y `ventas.fecha` en el rango (Excel: `I=H*B`, total `I260`).
- (Opcional) tabla `liquidaciones_consignacion(semana_id, consignador, vendido,
  a_pagar, pagado, fecha_pago)` para registrar lo realmente pagado.
- UI: pantalla de consignaciones (hoy el backend existe pero sin frontend).

**Depende de hojas:** ledgers `CUSCO/Jesus/Sucel./Consignacion./cuevita./Yani` (+ sus
catálogos). **Funcional:** reporte nuevo; no afecta el POS.

### Capa 5 — Cuentas por pagar y deudas (depende de Capas 1 y 4) — ✅ HECHO

> Tablas `cuentas_por_pagar` + `pagos_deuda` + router `/api/deudas`
> (listar/crear/pago/pagos/eliminar) + Admin → Economía → **Cuentas x pagar**
> (alta de deuda, lista con saldo/estado, modal "Registrar pago" que baja el saldo →
> `pagada` al llegar a 0, total adeudado). Verificado (50.000 − 20.000 − 30.000 = pagada).

- **Nueva tabla `cuentas_por_pagar`**: `id, fecha, proveedor, producto/concepto, costo,
  cantidad, saldo, semana_id`. (Excel: `cuentas xpagar` / `cuentas x pagar.`,
  `Final = D+E-G-H`.)
- **Nueva tabla `pagos_deuda`**: `id, cuenta_id?, fecha, nombre, producto, costo,
  vendido, cantidad, efectivo_pagado (=vendido*cantidad)`. (Excel: `Pago de Deudas`.)
- Extiende `compras` con `descuenta_fondo=false` → genera deuda en `cuentas_por_pagar`.

**Depende de hojas:** `cuentas xpagar`, `cuentas x pagar.`, `Pago de Deudas`.
**Funcional:** módulo de deudas; las compras al contado siguen igual.

### Capa 6 — Cuadre / cierre semanal (depende de Capas 1-5) — ✅ HECHO (6a + 6b)

> **6a:** `GET /api/reportes/cuadre?desde&hasta&socios&reserva_pct` + Admin → Economía
> → **Cuadre**. P&L global en vivo: venta (efvo/transf) − pérdida − costo = utilidad
> bruta; − salarios − transporte − ONAT/arriendo − contador − estimulación = utilidad
> neta; reserva % → dividendos → por socio. Más extracciones, compras, pagos de caja,
> deudas pagadas, a-pagar consignadores, faltante/sobrante y efectivo en caja.
>
> **6b:** router `/api/cierres` (listar/obtener/crear/eliminar) + columnas snapshot en
> `cierres_semanales` + botón **"Cerrar semana"** en el panel Cuadre que **congela** el
> cuadre (JSON) + lista "Cierres guardados". `compute_cuadre()` se reutiliza desde el
> reporte y el cierre. Verificado (cierre con snapshot, lista y detalle).
>
> **Descuentos (hecho):** el POS permite **editar el precio por línea**; el backend
> guarda `venta_detalle.perdida_ganancia = (precio normal − cobrado) × cantidad` y el
> cuadre la suma automáticamente. Verificado ($350→$250 ×2 → pérdida $200).

- **Nueva tabla `semanas`**: `id, fecha_inicio, fecha_fin, estado(abierta/cerrada)`.
  Agrupa por rango de fechas todo lo anterior (no requiere FK dura: `ventas.fecha`,
  `gastos.fecha`, etc. caen en el rango).
- **Wirear `cierres_semanales`** (ya existe en schema) con el cálculo del cuadre:
  - `venta_total = Σ ventas` ; `perdida = Σ descuentos` ; `venta_real = venta-perdida`
  - `venta_costo = Σ(cantidad*costo)` ; `utilidad_bruta = venta_real - venta_costo`
  - `gastos = Σ gastos(salario,transporte)` ; `onat`, `contador`, `estimulacion`
  - `utilidad_neta = utilidad_bruta - gastos - onat - contador - estimulacion`
  - `reserva = neta*0.2` ; `dividendos = neta - reserva` ; `por_socio = dividendos/N`
  - `salario_socio = por_socio - gastos_individuales - transferencias`
  - `faltante/sobrante = Σ cajas.diferencia` de la semana
  - **Desglose de efectivo**: `efectivo_bazar = efectivo - consignadores - cxp -
    reserva - salarios` (Excel `G54`).
- Requiere **Capa 7-prev**: registrar **pérdida de ganancia/descuentos** en `ventas`
  (col L/M del cuadre). Sugerencia: campo `descuento`/`perdida_ganancia` en `ventas`.

**Depende de hojas:** `CUADRE INICIAL` + `CUADRE DE LA SEMANA` + ledgers + gastos +
deudas. **Funcional:** el cierre lee de todo lo ya construido; si una pieza falta, su
término entra como 0 (no rompe).

### Capa 7 — Multi-semana y reparto histórico (depende de Capa 6) — ✅ HECHO

> `GET /api/cierres/resumen` (lee el snapshot de cada cierre) + Admin → Economía →
> **Multi-semana**: una fila por semana cerrada + la **unión** (totales acumulados) y
> el reparto acumulado. Verificado con 2 semanas.

- Consultas sobre `cierres_semanales`: comparar semanas, unión, reparto final
  (Excel `Hoja1`: `Total → 20% → /N socios`, por persona y por proveedor).
- (Opcional) tabla `socios` para parametrizar el reparto (Jesús/Enrique/Noslen) y los
  porcentajes (20%, estimulación).

**Depende de hojas:** `Hoja1`. **Funcional:** dashboard/reportes sobre cierres ya guardados.

---

## 5. Mapa de dependencias (resumen topológico)

```
Capa 0: categorias ─┬─> productos ──┐
                    └─> cajas_config │
Capa 1: cajas ──> ventas/venta_detalle ──> movimientos_caja ; compras/compra_detalle
Capa 2: (reporte) inventario_valorado            [usa productos, compras, ventas]
Capa 3: gastos                                   [independiente; alimenta cuadre]
Capa 4: liquidaciones_consignacion (reporte)     [usa productos.consignador, ventas]
Capa 5: cuentas_por_pagar ──> pagos_deuda        [usa compras, productos]
Capa 6: semanas ──> cierres_semanales            [usa TODO: 1..5 + cajas.diferencia]
Capa 7: reporte multi-semana / reparto           [usa cierres_semanales (+socios)]
```

**✅ TODAS LAS CAPAS (0-7) IMPLEMENTADAS.** La digitalización del Excel está completa:
catálogo, operación de caja, inventario valorado, gastos, liquidación de
consignaciones, cuentas por pagar, cuadre/cierre semanal (con descuentos) y
comparación multi-semana.

---

## 6. Glosario consolidado de fórmulas clave

| Concepto | Fórmula (Excel) | Equivalente digital |
|----------|-----------------|---------------------|
| Ganancia unitaria | `Venta - Costo` | `precio_venta - costo` |
| Venta al costo (prod) | `U*B` | `Σ cantidad*costo_unitario` |
| Venta a la venta (prod) | `U*C` | `Σ subtotal` |
| Utilidad (prod) | `AQ-AP` | `Σ ganancia_total` |
| Mercancía valorada | `X*B` | `Σ stock_actual*costo` |
| Entradas valoradas | `Y*B` | `Σ compra_detalle.cantidad*costo` |
| A pagar a consignador | `Σ (H*B)` | `Σ cantidad*costo` de sus productos vendidos |
| Venta real | `Venta - Pérdida` | `venta_total - descuentos` |
| Utilidad bruta | `VentaReal - VentaCosto` | idem |
| Utilidad neta | `Bruta - Gastos - ONAT - Contador - Estim.` | idem |
| Reserva | `Neta*0.2` | idem |
| Dividendos | `Neta - Reserva` | idem |
| Por socio | `Dividendos / N` | idem (N = nº socios) |
| Salario socio | `PorSocio - GastosIndiv - Transferencias` | idem |
| Faltante/Sobrante | (manual por día) | `Σ cajas.diferencia` |
| Efectivo del Bazar | `Efectivo - Consign - CxP - Reserva - Salarios` | idem |

---

## 7. Notas / decisiones abiertas

1. **Stands extra** (`Stan Especial`, `disponible/Zapatos Cusco`): ¿son categorías
   nuevas o un concepto "stand" aparte? Hoy lo más simple es tratarlas como categorías.
2. **Consignaciones**: ya existe `consignaciones`/`consignacion_detalle` (modelo de
   entregas). Para el Excel basta el **reporte** desde `ventas`; decidir si se usa el
   modelo de entregas o se simplifica.
3. **Semana**: ¿se cierra manualmente (botón "cerrar semana") o automático por fechas?
   Recomendado: entidad `semanas` con cierre manual que congela el `cierre_semanal`.
4. **Pérdida de ganancia / descuentos**: hace falta capturarlos en la venta (campo en
   `ventas`) para que el cuadre cuadre.
5. **Reparto**: parametrizar nº de socios y % (20%, estimulación) en `socios`/config.
```
