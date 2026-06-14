# Descripción del Excel: 19.1-SEMANA del 11 al 16 de mayo.xlsx

**Archivo:** `/home/david/Proyectos/test-opencode/SCyF/19.1-SEMANA del 11 al 16 de mayo.xlsx`
**Negocio:** Bazar Ojos Color Sol
**Período:** Semana del 11 al 16 de mayo de 2026 (con fecha de inicio de inventario: 10 de mayo)
**Total de hojas:** 33

---

## Estructura General del Archivo

El archivo se divide en **4 grupos de hojas**:

1. **Hojas de inventario por categoría de producto** (hojas 0 a 17) — 18 hojas con estructura idéntica
2. **Hojas de cuadre/consolidación** (hojas 18 y 19) — resumen financiero semanal
3. **Hojas de inventario por vendedor/persona** (hojas 20 a 27) — 8 hojas con estructura simplificada
4. **Hojas auxiliares** (hojas 28 a 33) — pagos, comparativas, control de transferencias, movimientos de producto

---

## GRUPO 1: Hojas de Inventario por Categoría (Hojas 0 a 17)

Todas comparten **exactamente la misma estructura de columnas y encabezados**. Varían solo en el nombre de la categoría (fila 8, columna E) y los productos listados.

### Estructura común (filas 1 a 8)

| Filas | Contenido |
|-------|-----------|
| 1-4 | Encabezado general: "Basar Ojos Color Sol" + títulos de secciones |
| 5 | **INVENTARIO** + fecha `10/5/2026` + "Semana del 11 al 16 de Mayo" + encabezados de resumen |
| 6 | Subencabezados de días: D-10, L-11, M-12, Mi-13, J-14, V-15, S-16 |
| 7 | Nombres de columnas detallados |
| 8 | **Nombre de la categoría** + totales de la semana |

### Columnas de la Tabla de Inventario (filas 7+, datos desde fila 9)

#### Columnas A-E: Datos básicos del producto
| Columna | Nombre | Descripción |
|---------|--------|-------------|
| **A** | No | Número correlativo del producto |
| **B** | Costo | Precio de costo unitario (en pesos) |
| **C** | Venta | Precio de venta unitario (en pesos) |
| **D** | Gan. | Ganancia por unidad = Venta - Costo |
| **E** | Producto | Nombre/descripción del producto |

#### Columnas F-T: Control diario de entrada/salida (Domingo 10 a Sábado 16)
| Columna | Nombre | Descripción |
|---------|--------|-------------|
| **F** | (D-10) Entra. | Entradas del Domingo 10 |
| **G** | (D-10) Venta | Ventas del Domingo 10 |
| **H** | (L-11) Entra. | Entradas del Lunes 11 |
| **I** | (L-11) Venta | Ventas del Lunes 11 |
| **J** | (M-12) Entra. | Entradas del Martes 12 |
| **K** | (M-12) Venta | Ventas del Martes 12 |
| **L** | (Mi-13) Entra. | Entradas del Miércoles 13 |
| **M** | (Mi-13) Venta | Ventas del Miércoles 13 |
| **N** | (J-14) Entra. | Entradas del Jueves 14 |
| **O** | (J-14) Venta | Ventas del Jueves 14 |
| **P** | (V-15) Entra. | Entradas del Viernes 15 |
| **Q** | (V-15) Venta | Ventas del Viernes 15 |
| **R** | (S-16) Entra. | Entradas del Sábado 16 |
| **S** | (S-16) Venta | Ventas del Sábado 16 |

#### Columnas U-X: Totales semanales
| Columna | Nombre | Descripción |
|---------|--------|-------------|
| **U** | Venta Total | Total de unidades vendidas en la semana |
| **V** | Deuda | Deuda asociada al producto |
| **W** | Baja sem. | Bajas de la semana (productos dados de baja) |
| **X** | F. 16/5/26 | Stock final al 16 de mayo |

#### Columnas Y-Z: Entradas de mercancía
| Columna | Nombre | Descripción |
|---------|--------|-------------|
| **Y** | Entradas totales de la semana | Total de unidades que entraron en la semana |
| **Z** | Importe de las Entradas Semanal | Valor en pesos de las entradas (Costo × cantidad) |

#### Columnas AA-AG: Desglose de ventas por día (en pesos)
| Columna | Nombre | Descripción |
|---------|--------|-------------|
| **AA** | Domingo | Ventas en pesos del Domingo |
| **AB** | Lunes | Ventas en pesos del Lunes |
| **AC** | Martes | Ventas en pesos del Martes |
| **AD** | Miércoles | Ventas en pesos del Miércoles |
| **AE** | Jueves | Ventas en pesos del Jueves |
| **AF** | Viernes | Ventas en pesos del Viernes |
| **AG** | Sábado | Ventas en pesos del Sábado |

#### Columnas AH-AN: Cuadre en efectivo de la semana
| Columna | Nombre | Descripción |
|---------|--------|-------------|
| **AH** | Cuadre en efectivo de la Semana (Domingo) | Efectivo del Domingo |
| **AI** | (Lunes) | Efectivo del Lunes |
| **AJ** | (Martes) | Efectivo del Martes |
| **AK** | (Miércoles) | Efectivo del Miércoles |
| **AL** | (Jueves) | Efectivo del Jueves |
| **AM** | (Viernes) | Efectivo del Viernes |
| **AN** | (Sábado) | Efectivo del Sábado |

#### Columnas AO-AS: Resumen financiero
| Columna | Nombre | Descripción |
|---------|--------|-------------|
| **AO** | No | Número correlativo (repetido, mismo que columna A) |
| **AP** | Total al costo | Valor total al costo de los productos (Costo × stock) |
| **AQ** | Total a la Venta | Valor total a precio de venta (Venta × stock) |
| **AR** | Utilidad Total | Utilidad total = AQ - AP |
| **AS** | $ en Mercancía | Valor en pesos de la mercancía en inventario |

#### Columnas adicionales (presentes en algunas hojas)
| Columna | Hoja | Descripción |
|---------|------|-------------|
| **AT** | Aseo | Marca "ok" (verificación de producto) |
| **AT** | COCINA, Madera-Utiles del hogar, Stan Especial | Cantidad numérica (posiblemente stock de verificación) |
| **AU** | COCINA | Valor adicional (presente en algunas filas) |
| **AY-AZ-BA** | TALABARTERIA | Datos adicionales de ventas (posiblemente desglose por tipo de pago o cuentas) |

### Relaciones entre columnas (misma tabla)

- **Ganancia (D)** = Venta (C) - Costo (B)
- **Venta Total (U)** = suma de ventas diarias (H+J+L+N+P+R+T)
- **Stock final (X)** = Stock inicial (F) + Entradas semanales (Y) - Venta Total (U) - Bajas (W)
- **Importe Entradas (Z)** = Entradas totales (Y) × Costo (B)
- **Total al costo (AP)** = Stock final (X) × Costo (B)
- **Total a la Venta (AQ)** = Stock final (X) × Venta (C)
- **Utilidad Total (AR)** = AQ - AP
- **$ en Mercancía (AS)** = AP (es el mismo valor que Total al costo)

### Listado de las 18 hojas de inventario

| # | Nombre Hoja | Categoría (fila 8, col E) | Productos | Filas con datos |
|---|-------------|---------------------------|-----------|-----------------|
| 0 | Lienzos y espejos | Lienzoz y Espejos | Lonas, cuadros, espejos | ~550 productos |
| 1 | Ceramica y Reloj | Relojes | Relojes, ceniceros, cerámica | ~550 productos |
| 2 | Aseo | Aseo | Cremas, tintes, champús, jabones | ~550 productos |
| 3 | COSITAS | Cositas | Postalitas, bolsas, jabas de regalo | ~600 productos |
| 4 | TALABARTERIA | Talabalteria | Sandalias, calzado | ~550 productos |
| 5 | Madera-Utiles del hogar | Madera | Palos de cartera, toalleros, cortineros, zapateras | ~550 productos |
| 6 | COCINA | Stand Cocina-Ceramica | Palos de madera, soportes, copas, tazas | ~555 productos |
| 7 | ARREGLOS FLORALES,BICHOS | Arreglos florales | Orquídeas, árboles, arreglos florales | ~550 productos |
| 8 | CONSIGNACION | Por consignación | Productos en consignación de terceros (Delenis, Dayami, etc.) | ~550 productos |
| 9 | Jesus otros | JESUS Bisuteria | Pulsos, pinzas, pellizcos, bisutería | ~550 productos |
| 10 | Jesus ropa calzado | Ropa -Calzado-carteras | Carteras, mochilas, blusas, chores, calzado | ~550 productos |
| 11 | Jesus electrodomesticos | JESUS | Calderos, fogones, ollas, electrodomésticos | ~550 productos |
| 12 | Electrodomestico Bazar | Equipos Electrodomesticos | Microondas, lámparas (sin ventas esta semana) | ~550 productos |
| 13 | Sucel | Sucel | Cosméticos, maquillaje (compactos, rubor, delineadores) | ~550 productos |
| 14 | Cusco-Yanley | Plata (Yanley y Melanie) | Anillos, aretes, joyería de plata/acero | ~550 productos |
| 15 | cuentas xpagar | CUENTAS X PAGAR | Perfumes, peluches, esponjas, batas | ~550 productos |
| 16 | Stan Especial | Stan Especial | Juegos de platos, estuche, arreglos, termos | ~550 productos |
| 17 | disponible | ZAPATOS CUSCO | (vacía — sin productos registrados esta semana, solo filas con correlativos y ceros. Se observan 2 filas con W=1 y X=-1, posiblemente ajustes) | ~550 filas vacías |

### Relaciones entre hojas de inventario

- **No existe una clave primaria compartida** entre hojas. Cada hoja tiene su propio correlativo (columna A) independiente.
- Los productos NO se repiten entre hojas — cada categoría es mutuamente excluyente.
- La columna **E (Producto)** es el identificador único del producto dentro de cada hoja.
- Los totales de cada hoja (fila 8, columnas AP-AS) alimentan las hojas de **CUADRE INICIAL** y **CUADRE DE LA SEMANA**.

---

## GRUPO 2: Hojas de Cuadre/Consolidación (Hojas 18 y 19)

### Hoja 18: CUADRE INICIAL

**Propósito:** Resumen del balance inicial de la semana.

**Estructura:**

| Filas | Contenido |
|-------|-----------|
| 1-2 | Título: "Bazar Ojos Color Sol Cierre de la semana del 11 al 16 de Mayo" |
| 3-5 | **Tabla 1: Cuadre en efectivo de la Semana** |
| 4 | Días: Domingo a Sábado |
| 5 | Valores de efectivo por día + Total Semanal = **$1,306,800** |
| 6-7 | **Tabla 2: Totales financieros** |
| 6 | Conceptos: Total Venta al Costo, Total Venta a la Venta, Utilidad Total, Importe en Mercancía, Pago de Deudas, Stan, Mercancía del Bazar |
| 7 | Valores: Costo=$912,370, Venta=$1,306,800, Utilidad=$394,430, Mercancía=$5,759,690 |
| 8-16 | **Tabla 3: Desglose de mercancía por categoría** (columna F-G) |
| | Cocina-cerámica=$437,930, Lienzos=$15,000, Cerámica y reloj=$86,240, Cositas=$114,185, Aseo=$410,700, Talabartería=$451,800, Madera=$258,010, Flores=$154,150, Consignación=$653,600 |
| 10-14 | **Tabla 4: Importes de inicio de semana** (columnas A-C) |
| | Importe Inicial=$1,830,865, Entradas=$882,780, Total=$2,713,645 |
| 15 | Total de inicio de semana |
| 21-24 | **Tabla 5: STAN - Entradas y Ventas** (columnas A-C) |
| | Cocina (Entradas=$273,670, Ventas=$127,480), Lienzos ($0/$0), Cerámica ($33,880/$16,190), Cositas ($22,150/$10,680), Aseo ($314,770/$120,420), Talabartería ($72,210/$63,090), Madera ($61,600/$80,240), Flores ($5,800/$4,700), Cuentas x pagar ($98,700/$6,880), Stan Especial ($0/$27,000), Electrodomésticos ($0/$0) |
| 16-25 | **Tabla 6: Totales por vendedor** (columnas F-H) |
| | Cusco Plata=$362,265, Cusco Zapatos=$0, Jesús ropa=$391,150, Jesús=$598,430, Jesús Electrodoméstico=$624,980, Stan Especial=$79,600, Electrodomésticos=$0, Sucel=$981,600, Cuentas Por Pagar=$140,050 |
| 30 | **Total** de Entradas=$882,780, Ventas=$456,680 |

**Relaciones:**
- Los valores de la columna G (Mercancía del Bazar) son los totales de la columna AS de cada hoja de inventario.
- El Total Semanal ($1,306,800) es la suma de las ventas diarias de todas las categorías.

---

### Hoja 19: CUADRE DE LA SEMANA

**Propósito:** Cuadre financiero detallado de la semana con gastos, transferencias, salarios y utilidades.

**Estructura:**

#### Tabla 1: Control diario de efectivo (filas 7-17)
| Columna | Descripción |
|---------|-------------|
| A | Día de la semana (Domingo a Sábado) |
| B | Fecha |
| C | Venta diaria (en pesos) |
| D | Transferencia a Jesús |
| E | Transferencia (genérica) |
| F | Salarios |
| G | Carros Corriente y Otras (gastos de transporte) |
| H | Pagos de la Caja |
| I | Jesús (gastos individuales de Jesús) |
| J | Enrique (gastos individuales de Enrique) |
| K | Faltante |
| L | Perdida de ganancia por venta al COSTO |
| M | Ganancias por Venta (Elevación de Precios) |
| N | Sobrante |
| O | EFECTIVO (efectivo real del día) |
| Q | Venta x libreta (venta registrada) |
| R | Diferencias por ajustes |
| S | Notas/observaciones (ej: "3000 cesta con gel marin") |
| T-V | Datos de semanas anteriores (domingo 8, lunes 9) |

**Datos diarios:**
| Día | Venta | Efectivo | Transferencia | Gastos varios |
|-----|-------|----------|---------------|---------------|
| Domingo 10 | $0 | $0 | — | — |
| Lunes 11 | $272,850 | $244,380 | $12,300 | $8,520 |
| Martes 12 | $141,200 | $119,900 | $9,200 | $8,100 |
| Miércoles 13 | $222,350 | $164,000 | $13,550 | $3,450 |
| Jueves 14 | $162,050 | $117,140 | $10,350 | $15,220 |
| Viernes 15 | $229,150 | $192,030 | $0 | $1,000 |
| Sábado 16 | $279,200 | $218,850 | $11,600 | $7,200 |
| **Total** | **$1,306,800** | **$1,056,300** | **$57,000** | **$43,490** |

#### Tabla 2: Resumen financiero (filas 18-30)
| Concepto | Valor |
|----------|-------|
| Total Venta Semanal por Sistema | $1,306,800 |
| Pérdida de ganancia por venta al COSTO | $65,210 |
| Venta Real | $1,241,590 |
| Total Venta al Precio de Costo | $912,370 |
| Utilidad Bruta | $329,220 |
| Gastos Semanal | $75,290 |
| ONAT y Arrendamiento | $15,000 |
| Pago de Estimulación | $7,945 |
| **Utilidad Neta** | **$230,985** |
| 20% (impuesto/ahorro) | $46,197 |
| Dividendos a Repartir | $184,788 |
| Entre 2 | $92,394 |

#### Tabla 3: Desglose de Entradas del Bazar (filas 35-51)
| Categoría | Importe Entradas |
|-----------|-----------------|
| Cocina-cerámica cuevita | $273,670 |
| Cerámica | $0 |
| Cuadros | $33,880 |
| Cositas | $22,150 |
| Aseo | $314,770 |
| Talabartería | $72,210 |
| Madera-Útiles del hogar | $61,600 |
| Flores | $5,800 |
| Cuentas x pagar | $98,700 |
| Stan Especial | $0 |
| Electrodoméstico | $0 |
| **Total** | **$882,780** |

#### Tabla 3b: Desglose Semanal Adicional (filas 35-54)
| Concepto | Valor | Descripción |
|----------|-------|-------------|
| Inicio de Semana | $1,830,865 | Importe al inicio antes de ventas |
| Entradas Semanal | $882,780 | Total de entradas de mercancía |
| Total Semanal | $2,713,645 | Inicio + Entradas |
| Importe de Efectivo | $1,113,300 | Total de efectivo del bazar |
| Cusco | $10,850 | Efectivo de Cusco (Yanley y Melanie) |
| Cuentas por pagar | $6,880 | Efectivo de cuentas por pagar |
| Consignación | $67,000 | Efectivo de consignación |
| Jesús | $341,410 | Efectivo de Jesús |
| Sucel | $36,430 | Efectivo de Sucel |
| 20% (impuesto) | $46,197 | 20% de la utilidad |
| ONAT y Arrendamiento | $15,000 | Impuesto/arrendamiento |
| ESTIMULACIÓN | $7,945 | Pago de estimulación |
| Salario Jesús | $87,394 | Salario de Jesús |
| Salario Enrique | $51,394 | Salario de Enrique |
| Total del Bazar | $442,800 | Suma de efectivo de todas las categorías |

#### Tabla 4: Control de Transferencias Semanal (filas 35-44)
| Día | Fecha | Transferencia |
|-----|------|---------------|
| Domingo | 10/5 | $0 |
| Lunes | 11/5 | $12,300 |
| Martes | 12/5 | $9,200 |
| Miércoles | 13/5 | $13,550 |
| Jueves | 14/5 | $10,350 |
| Viernes | 15/5 | $0 |
| Sábado | 16/5 | $11,600 |
| **Total** | | **$57,000** |

#### Tabla 5: Salarios
| Persona | Salario |
|---------|---------|
| Jesús | $87,394 |
| Enrique | $51,394 |
| **Total** | **$138,788** |

#### Tabla 6: Efectivo del Bazar por categoría (filas 48-60)
| Categoría | Efectivo |
|-----------|----------|
| Cocina | $127,480 |
| Lienzos espejo | $0 |
| Cerámica reloj | $16,190 |
| Cositas | $10,680 |
| Aseo | $120,420 |
| Talabartería | $63,090 |
| Madera-útiles | $80,240 |
| Flores | $4,700 |
| Stan Especial | $27,000 |
| Electrodoméstico | $0 |
| **Total** | **$449,800** |

**Relaciones:**
- La **Venta Real** ($1,241,590) = Venta Total ($1,306,800) - Pérdida de ganancia ($65,210)
- La **Utilidad Neta** ($230,985) = Utilidad Bruta ($329,220) - Gastos ($75,290) - ONAT ($15,000) - Estimulación ($7,945)
- Los **Dividendos a Repartir** ($184,788) = Utilidad Neta ($230,985) - 20% ($46,197)
- Las **Transferencias** totales ($57,000) se corresponden con la columna E de la tabla diaria
- Los valores de **Efectivo del Bazar** por categoría se corresponden con las ventas de cada hoja de inventario

---

## GRUPO 3: Hojas de Inventario por Vendedor (Hojas 20 a 27)

Estas hojas tienen una **estructura simplificada** respecto al Grupo 1. Son inventarios individuales por persona/vendedor.

### Estructura común

| Filas | Contenido |
|-------|-----------|
| 1-2 | Encabezado: "Basar Ojos Color Sol de 11 al 16 de Mayo" |
| 3-4 | Nombre del vendedor |
| 5 | Encabezados de columna: No, Costo, Producto |
| 6+ | Datos de productos |

### Columnas
| Columna | Nombre | Descripción |
|---------|--------|-------------|
| **A** | No | Número correlativo |
| **B** | Costo | Precio de costo unitario |
| **C** | Producto | Nombre del producto |
| **D** | (Inicio) | Stock al inicio de la semana (10/5) |
| **E** | Entradas | Unidades que entraron en la semana |
| **F** | Deudas | Deudas asociadas |
| **G** | Bajas | Unidades dadas de baja |
| **H** | Ventas | Unidades vendidas en la semana |
| **I** | IMPORTE AL COSTO | Valor de las ventas al costo (H × B) |
| **J** | Final: 16/5 | Stock final = D + E - H - G |

### Relaciones entre columnas
- **Stock final (J)** = Inicio (D) + Entradas (E) - Ventas (H) - Bajas (G)
- **Importe al costo (I)** = Ventas (H) × Costo (B)

### Listado de hojas

| # | Nombre Hoja | Vendedor | Productos |
|---|-------------|----------|-----------|
| 20 | CUSCO | Plata (Yanley y Melanie) | Anillos, aretes, cadenas, manillas, gafas, chancletas, zapatos, tacones (175 productos) |
| 21 | Jesus | Jesus | Pulsos, pellizcos, peluches, audífonos, carteras, ropa, calzado, bisutería, cosméticos (266 productos) |
| 22 | Consignacion. | Múltiples (Delenis, Dayami, Aníbal, Katia, Laura, Héctor, Walter, TRD, Yoham, Yoel, Yaly) | Ropa, espejos, perfumes, cosméticos, juguetes, relojes (176 productos) |
| 23 | Sucel. | Sucel | Cosméticos, aretes, argollas, cadenas, manillas, tobilleras, dijes, zapatos (197 productos) |
| 24 | cuentas x pagar. | (vacía) | Sin productos registrados esta semana (81 filas, solo correlativos, sin datos de productos) |
| 25 | cuevita. | (vacía) | Sin productos registrados esta semana (246 filas, solo correlativos, sin datos de productos) |
| 26 | Stan Especial. | (vacía) | Sin productos registrados esta semana (42 filas, solo correlativos, sin datos de productos) |
| 27 | Yani | Yani | Plantilla vacía — solo contiene números correlativos del 1 al 40, sin nombres de producto, costos, stocks ni ventas. Sin datos registrados esta semana. |

### Relaciones entre hojas de inventario por vendedor y hojas de inventario por categoría

- **CUSCO (hoja 20)** se corresponde con **Cusco-Yanley (hoja 14)** — misma persona (Yanley y Melanie), misma categoría "Plata"
- **Jesus (hoja 21)** agrupa los productos de **Jesus otros (hoja 9)**, **Jesus ropa calzado (hoja 10)** y **Jesus electrodomesticos (hoja 11)** — es el inventario consolidado de Jesús
- **Consignacion. (hoja 22)** se corresponde con **CONSIGNACION (hoja 8)** — productos en consignación
- **Sucel. (hoja 23)** se corresponde con **Sucel (hoja 13)** — productos de Sucel
- **cuentas x pagar. (hoja 24)** se corresponde con **cuentas xpagar (hoja 15)**
- **Stan Especial. (hoja 26)** se corresponde con **Stan Especial (hoja 16)**
- **cuevita. (hoja 25)** y **Yani (hoja 27)** no tienen correspondencia directa con ninguna hoja del Grupo 1

La diferencia clave: las hojas del Grupo 1 tienen el desglose diario detallado (ventas por día, cuadre en efectivo), mientras que las del Grupo 3 solo tienen el resumen semanal (stock inicial, entradas, ventas, bajas, stock final).

---

## GRUPO 4: Hojas Auxiliares (Hojas 28 a 33)

### Hoja 28: Pago de Deudas por Semana

**Propósito:** Registro de pagos de deudas de la semana.

**Nota importante:** El título dice "Pago de Deudas del 10 al 16 de Septiembre" — posiblemente una plantilla de un período anterior, no de la semana actual de mayo.

**Estructura:**
| Columna | Descripción |
|---------|-------------|
| A | No (correlativo) |
| B | Fecha de Compra |
| C | Nombre (del deudor) |
| D | Producto |
| E | Precio de Costo |
| F | Precio Vendido |
| G | Cantidad |
| H | Pagado: Si |
| I | Pagado: No |
| J | Fecha (de pago) |
| K | EFECTIVO PAGADO |

**Nota:** Todas las filas están vacías (sin datos esta semana). Solo existe la estructura de la tabla.

---

### Hoja 29: Hoja1

**Propósito:** Comparativa de dos semanas (4-10 febrero y 11-17 febrero) con unificación.

**Estructura:**

#### Tabla 1: Comparativa semanal (columnas B-G)
| Concepto | Semana 4-10 feb | Semana 11-17 feb | Unión |
|----------|----------------|------------------|-------|
| Total de Venta Semanal | $804,370 | $1,287,130 | $2,091,500 |
| Venta al Costo | $538,977 | $870,695 | $1,409,672 |
| Pago de Deudas al Costo | $0 | $0 | $0 |
| Utilidad Total | $265,393 | $416,435 | $681,828 |
| Gastos Semanal | $16,650 | $12,670 | $29,320 |
| Pérdida de ganancia | $4,655 | $8,625 | $13,280 |
| ONAT y Arrendamiento | $7,700 | $7,700 | $15,400 |
| Salario Contador | $2,500 | $2,500 | $5,000 |
| Pago de Estimulación | — | — | $17,580 |
| **Total** | — | — | **$601,248** |
| 20% | — | — | $120,249.60 |
| Diferencia a Repartir | — | — | $480,998.40 |
| Entre 3 | — | — | $160,332.80 |

#### Tabla 2: Efectivo por persona (columnas J-N)
| Persona/Concepto | Semana 4-10 feb | Semana 11-17 feb | Unión |
|------------------|----------------|------------------|-------|
| Importe de Efectivo | $1,261,235 | $776,415 | $2,037,650 |
| Cusco | $180,710 | $153,490 | $334,200 |
| Jesús | $10,050 | $6,435 | $16,485 |
| Daniela | $0 | $0 | $0 |
| Yanet | $0 | $0 | $0 |
| Consignación | $55,845 | $18,075 | $73,920 |
| Katia | $81,950 | $8,120 | $90,070 |
| Yoel Primo | $0 | $0 | $0 |
| STAN Especial | $0 | $0 | $0 |

#### Tabla 3: Salarios (filas 18-22)
| Persona | Salario |
|---------|---------|
| Jesús | $160,332.80 |
| Enrique | $153,452.80 |
| Noslen | $160,332.80 |
| Contador | $5,000 |
| **Total del Bazar** | **$890,627** |

#### Tabla 4: Lista de valores sueltos (filas 30-72, columna K)
Una lista de 43 valores numéricos que suman **$205,200** (la fila 72 con $102,600 es un subtotal parcial, no el total general). Posiblemente deudas o pagos individuales.

**Relaciones:**
- Esta hoja es un **análisis histórico** de semanas anteriores (febrero), no de la semana actual (mayo).
- Los conceptos y la estructura son similares a **CUADRE DE LA SEMANA** pero de un período anterior.

---

### Hoja 30: Hoja3

**Propósito:** Control de transferencias de dos semanas de febrero.

**Estructura:**

#### Semana del 4 al 10 de Febrero
| Día | Fecha | Transferencia | Sobrante |
|-----|-------|---------------|----------|
| Domingo | 4/2/24 | $8,000 | — |
| Lunes | 5/2/24 | $800 | $100 |
| Martes | 6/2/24 | $1,200 | — |
| Miércoles | 7/2/24 | $8,450 | — |
| Jueves | 8/2/24 | $0 | — |
| Viernes | 9/2/24 | $6,400 | $1,500 |
| Sábado | 10/2/24 | $3,750 | $230 |
| **Total** | | **$28,600** | **$1,830** |

#### Semana del 11 al 17 de Febrero
| Día | Fecha | Transferencia | Sobrante |
|-----|-------|---------------|----------|
| Domingo | 11/2/24 | $0 | $15 |
| Lunes | 12/2/24 | $8,250 | $2,135 |
| Martes | 13/2/24 | $6,010 | $500 |
| Miércoles | 14/2/24 | $15,950 | $6,600 |
| Jueves | 15/2/24 | $0 | — |
| Viernes | 16/2/24 | $0 | — |
| Sábado | 17/2/24 | $0 | — |
| **Total** | | **$30,210** | **$9,250** |

**Total Unificado:** Transferencias = **$58,810**, Sobrantes = **$11,080**

**Relaciones:**
- Esta hoja complementa a **Hoja1** con el detalle diario de las transferencias de esas mismas semanas.
- El concepto "Transferencia" aquí se corresponde con la columna E de **CUADRE DE LA SEMANA**.

---

### Hoja 31: Hoja2

**Propósito:** Control de inventario de dos productos específicos: **HISOPO** y **CHUPITO**.

**Estructura:**

#### Producto: HISOPO
| Concepto | Fecha | Cantidad |
|----------|-------|----------|
| INV 18/6 | — | 6 |
| ENTRADAS | 20/6/25 | 5 |
| | 2/7/25 | 4 |
| | 9/7/25 | 3 |
| **Total Entradas** | | **18** |
| SALIDAS | 20/6/25 | 1 |
| | 21/6/25 | 1 |
| | 26/6/25 | 2 |
| | 27/6/25 | 1 |
| | 30/6/25 | 2 |
| | 2/7/25 | 1 |
| | 3/7/25 | 1 |
| | 4/7/25 | 1 |
| | 5/7/25 | 1 |
| | 7/7/25 | 1 |
| | 8/7/25 | 1 |
| | 9/7/25 | 1 |
| | 10/7/25 | 1 |
| | 11/7/25 | 1 |
| | 13/7/25 | 1 |
| | 15/7/25 | 2 |
| **Total Salidas** | | **19** |

#### Producto: CHUPITO
| Concepto | Fecha | Cantidad |
|----------|-------|----------|
| INV 18/6 | — | 5 |
| ENTRADAS | 20/6/25 | 2 |
| | 26/6/25 | 4 |
| **Total Entradas** | | **11** |
| SALIDAS | 20/6/25 | 1 |
| | 3/7/25 | 4 |
| | 19/7/25 | 2 |
| BAJAS | — | 5 |
| **Total Salidas+Bajas** | | **12** |

**Relaciones:**
- No se relaciona directamente con ninguna otra hoja del archivo. Es un control de inventario independiente de dos productos específicos, de un período diferente (junio-julio 2025).

---

### Hoja 32: Hoja4

**Propósito:** Hoja de cálculos sueltos. Contiene operaciones matemáticas rápidas (precio × cantidad) sin estructura de tabla definida ni nombres de producto.

**Estructura:**
| Columna | Descripción |
|---------|-------------|
| B | Precio unitario |
| D | Cantidad |
| E | Total (B × D) |
| F | Valor adicional (presente en algunas filas, ej: $68,840 y $64,980) |

**Datos (primeros registros):**
| Precio Unit. | Cant. | Total |
|-------------|-------|-------|
| $800 | 2 | $1,600 |
| $2,600 | 1 | $2,600 |
| $5,500 | 1 | $5,500 |
| $650 | 15 | $9,750 |
| ... | ... | ... |

(51 filas en total, sin nombres de producto — solo valores numéricos sueltos, probablemente cálculos temporales)

**Filas de total al final:**
| Fila | Concepto | Valor |
|------|----------|-------|
| 48 | (sin etiqueta) | $133,820 |
| 49 | (sin etiqueta) | $8,000 |
| 50 | (sin etiqueta) | $1,500 |
| 51 | (sin etiqueta) | $34,410 |
| 52 | "total" | $89,910 |

**Relaciones:**
- No se relaciona directamente con ninguna otra hoja. Es una hoja de trabajo auxiliar.

---

## RELACIONES ENTRE HOJAS (Diagrama General)

```
HOJAS DE INVENTARIO POR CATEGORÍA (0-17)
  Lienzos y espejos
  Ceramica y Reloj
  Aseo
  COSITAS
  TALABARTERIA
  Madera-Utiles del hogar
  COCINA
  ARREGLOS FLORALES,BICHOS
  CONSIGNACION  ──────────────►  Consignacion. (22)
  Jesus otros    ─┐
  Jesus ropa     ─┤──────────►  Jesus (21)
  Jesus electro  ─┘
  Electrodomestico Bazar
  Sucel          ──────────────►  Sucel. (23)
  Cusco-Yanley   ──────────────►  CUSCO (20)
  cuentas xpagar ──────────────►  cuentas x pagar. (24)
  Stan Especial  ──────────────►  Stan Especial. (26)
  disponible
         │
         │ (totales AS)
         ▼
  CUADRE INICIAL (18) ────────►  CUADRE DE LA SEMANA (19)
         │                           │
         │ (ventas diarias)          │ (gastos, salarios, utilidad)
         ▼                           ▼
  (alimenta análisis)          (resultado financiero final)

HOJAS AUXILIARES (28-33):
  Pago de Deudas (28)  ── (vacía esta semana)
  Hoja1 (29) ──── Hoja3 (30)  ── (análisis histórico de febrero)
  Hoja2 (31) ── (control de inventario Hisopo/Chupito, jun-jul 2025)
  Hoja4 (32) ── (lista de precios)
```

### Resumen de relaciones clave

1. **Cada hoja de inventario del Grupo 1** tiene una **hoja correspondiente en el Grupo 3** con el mismo contenido pero estructura simplificada (solo stock inicial/final, sin desglose diario).

2. **Los totales de las hojas de inventario** (columna AS = $ en Mercancía, columna AP = Total al costo, columna AQ = Total a la Venta) **alimentan la hoja CUADRE INICIAL**.

3. **Las ventas diarias de todas las categorías** se consolidan en **CUADRE DE LA SEMANA**, donde se aplican gastos, transferencias, salarios y se calcula la utilidad neta.

4. **Las hojas Hoja1 y Hoja3** son de **períodos anteriores (febrero 2024)** y no corresponden a la semana actual (mayo 2026).

5. **Las hojas Hoja2 y Hoja4** son **independientes** y no se relacionan con el resto del archivo.

6. **La hoja "disponible" (17)** y las hojas **"cuentas x pagar." (24), "cuevita." (25), "Stan Especial." (26) y "Yani" (27)** están **vacías** (sin datos de productos registrados esta semana, solo filas con números correlativos).

---

## Notas adicionales

- **Moneda:** Pesos ($). Todos los valores están en pesos.
- **Fechas:** La semana principal es del 11 al 16 de mayo de 2026, con inventario inicial al 10 de mayo.
- **Vendedores identificados:** Jesús, Enrique, Sucel, Yanley, Melanie, Delenis, Dayami, Aníbal, Katia, Laura, Héctor, Walter, TRD, Yoham, Yoel, Yaly, Noslen (contador).
- **Gastos semanales:** $75,290 (incluye salarios, transporte, ONAT/arrendamiento).
- **Utilidad neta de la semana:** $230,985.
- **Total de ventas semanales:** $1,306,800.
- **Total de mercancía en inventario:** $5,759,690.
