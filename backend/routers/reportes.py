from typing import Optional
from fastapi import APIRouter
from database import get_conn

router = APIRouter(prefix="/api/reportes", tags=["reportes"])


def _norm_dt(s):
    """Normaliza una fecha a "YYYY-MM-DD HH:MM:SS" (formato en que la BD guarda
    las fechas con datetime('now')). El frontend a veces manda ISO con 'T' y 'Z'
    (p.ej. "2026-07-14T00:00:00.000Z"); sin esto, la comparación de texto en SQLite
    descartaba el primer día del rango (el espacio ordena antes que la 'T')."""
    if not s:
        return s
    return s.replace("T", " ").replace("Z", "").strip()[:19]


def _where_ventas(caja_id, desde, hasta) -> tuple[str, list]:
    desde, hasta = _norm_dt(desde), _norm_dt(hasta)
    conds = ["v.estado != 'cancelada'"]
    params = []
    if caja_id is not None:
        conds.append("v.caja_id=?")
        params.append(caja_id)
    if desde:
        conds.append("v.fecha>=?")
        params.append(desde)
    if hasta:
        conds.append("v.fecha<=?")
        params.append(hasta)
    return " AND ".join(conds), params


def _where_movs(caja_id, desde, hasta) -> tuple[str, list]:
    desde, hasta = _norm_dt(desde), _norm_dt(hasta)
    conds = ["1=1"]
    params = []
    if caja_id is not None:
        conds.append("caja_id=?")
        params.append(caja_id)
    if desde:
        conds.append("fecha>=?")
        params.append(desde)
    if hasta:
        conds.append("fecha<=?")
        params.append(hasta)
    return " AND ".join(conds), params


@router.get("/semanal")
def semanal(desde: Optional[str] = None, hasta: Optional[str] = None,
            caja_id: Optional[int] = None):
    with get_conn() as conn:
        cond_v, params_v = _where_ventas(caja_id, desde, hasta)
        cond_m, params_m = _where_movs(caja_id, desde, hasta)

        venta_total = conn.execute(
            f"SELECT COALESCE(SUM(total),0) FROM ventas v WHERE {cond_v} AND es_consignacion=0",
            params_v,
        ).fetchone()[0]
        efectivo_total = conn.execute(
            f"SELECT COALESCE(SUM(subtotal_efectivo),0) FROM ventas v WHERE {cond_v} AND es_consignacion=0",
            params_v,
        ).fetchone()[0]
        transferencia_total = conn.execute(
            f"SELECT COALESCE(SUM(subtotal_transferencia),0) FROM ventas v WHERE {cond_v} AND es_consignacion=0",
            params_v,
        ).fetchone()[0]
        consignacion_total = conn.execute(
            f"SELECT COALESCE(SUM(total),0) FROM ventas v WHERE {cond_v} AND es_consignacion=1",
            params_v,
        ).fetchone()[0]
        utilidad_total = conn.execute(
            f"""SELECT COALESCE(SUM(vd.ganancia_total),0)
                FROM venta_detalle vd
                JOIN ventas v ON vd.venta_id=v.id
                WHERE {cond_v} AND vd.es_consignacion=0""",
            params_v,
        ).fetchone()[0]
        extracciones_total = conn.execute(
            f"SELECT COALESCE(SUM(monto),0) FROM movimientos_caja WHERE {cond_m} AND es_extraccion=1",
            params_m,
        ).fetchone()[0]
        compras_total = conn.execute(
            f"SELECT COALESCE(SUM(monto),0) FROM movimientos_caja WHERE {cond_m} AND es_compra_mercancia=1",
            params_m,
        ).fetchone()[0]

    return {
        "desde": desde, "hasta": hasta, "caja_id": caja_id,
        "venta_total": venta_total, "efectivo_total": efectivo_total,
        "transferencia_total": transferencia_total, "consignacion_total": consignacion_total,
        "utilidad_total": utilidad_total, "extracciones_total": extracciones_total,
        "compras_total": compras_total, "diferencia_caja": 0,
    }


@router.get("/por-categoria")
def por_categoria(desde: Optional[str] = None, hasta: Optional[str] = None,
                  caja_id: Optional[int] = None):
    cond_v, params_v = _where_ventas(caja_id, desde, hasta)
    query = f"""
        SELECT c.id AS categoria_id, c.nombre, c.es_consignacion,
               COALESCE(SUM(vd.subtotal),0) AS venta_total,
               COALESCE(SUM(vd.ganancia_total),0) AS utilidad_total,
               COALESCE(SUM(vd.cantidad),0) AS unidades
        FROM venta_detalle vd
        JOIN ventas v ON vd.venta_id=v.id
        JOIN productos p ON vd.producto_id=p.id
        JOIN categorias c ON p.categoria_id=c.id
        WHERE {cond_v}
        GROUP BY c.id
        ORDER BY venta_total DESC
    """
    with get_conn() as conn:
        rows = conn.execute(query, params_v).fetchall()
    return [dict(r) for r in rows]


@router.get("/consignaciones")
def consignaciones(desde: Optional[str] = None, hasta: Optional[str] = None,
                   caja_id: Optional[int] = None):
    """Liquidación por consignador (equivale a 'IMPORTE AL COSTO' de los ledgers
    Jesus/CUSCO/Sucel…): por cada consignador, lo vendido de sus productos en el
    rango y cuánto se le debe pagar = Σ(cantidad × costo).
    """
    cond_v, params_v = _where_ventas(caja_id, desde, hasta)
    query = f"""
        SELECT COALESCE(NULLIF(TRIM(p.consignador), ''), 'Sin consignador') AS consignador,
               COALESCE(SUM(vd.cantidad), 0)                     AS unidades,
               COALESCE(SUM(vd.cantidad * vd.costo_unitario), 0)  AS a_pagar,
               COALESCE(SUM(vd.subtotal), 0)                      AS venta
        FROM venta_detalle vd
        JOIN ventas v ON vd.venta_id = v.id
        JOIN productos p ON vd.producto_id = p.id
        WHERE {cond_v} AND p.tipo_producto = 'consignacion'
        GROUP BY consignador
        ORDER BY a_pagar DESC
    """
    with get_conn() as conn:
        rows = conn.execute(query, params_v).fetchall()

    consignadores = []
    total = {"unidades": 0, "a_pagar": 0.0, "venta": 0.0, "utilidad_bazar": 0.0}
    for r in rows:
        d = dict(r)
        d["utilidad_bazar"] = d["venta"] - d["a_pagar"]
        consignadores.append(d)
        total["unidades"] += d["unidades"]
        total["a_pagar"] += d["a_pagar"]
        total["venta"] += d["venta"]
        total["utilidad_bazar"] += d["utilidad_bazar"]
    return {"consignadores": consignadores, "total": total}


def compute_cuadre(desde: Optional[str] = None, hasta: Optional[str] = None,
                   socios: int = 2, reserva_pct: float = 20.0, perdida_ganancia: float = 0.0):
    """Cuadre / cierre semanal (CUADRE DE LA SEMANA). P&L global del bazar en el
    rango: ventas − pérdida − costo = utilidad bruta; − gastos − ONAT/arriendo −
    contador − estimulación = utilidad neta; reserva % → dividendos → reparto.
    Es global (todas las cajas), como en el Excel."""
    cond_v, pv = _where_ventas(None, desde, hasta)
    cond_m, pm = _where_movs(None, desde, hasta)

    d_desde, d_hasta = _norm_dt(desde), _norm_dt(hasta)

    def _date_clause(col: str):
        c, p = "", []
        if d_desde:
            c += f" AND {col}>=?"
            p.append(d_desde)
        if d_hasta:
            c += f" AND {col}<=?"
            p.append(d_hasta)
        return c, p

    with get_conn() as conn:
        def sv(expr):
            return conn.execute(f"SELECT COALESCE({expr},0) FROM ventas v WHERE {cond_v}", pv).fetchone()[0]

        venta_total = sv("SUM(total)")
        efectivo = sv("SUM(subtotal_efectivo)")
        transferencia = sv("SUM(subtotal_transferencia)")
        # Desglose por tipo: venta_total YA incluye la consignación; aquí la
        # separamos para poder mostrar cuánto del total es propio vs consignación.
        venta_consignacion = conn.execute(
            f"SELECT COALESCE(SUM(total),0) FROM ventas v WHERE {cond_v} AND es_consignacion=1", pv
        ).fetchone()[0]
        venta_propia = venta_total - venta_consignacion
        venta_costo = conn.execute(
            f"""SELECT COALESCE(SUM(vd.cantidad*vd.costo_unitario),0)
                FROM venta_detalle vd JOIN ventas v ON vd.venta_id=v.id WHERE {cond_v}""",
            pv,
        ).fetchone()[0]
        perdida_detalle = conn.execute(
            f"""SELECT COALESCE(SUM(vd.perdida_ganancia),0)
                FROM venta_detalle vd JOIN ventas v ON vd.venta_id=v.id WHERE {cond_v}""",
            pv,
        ).fetchone()[0]
        consig_a_pagar = conn.execute(
            f"""SELECT COALESCE(SUM(vd.cantidad*vd.costo_unitario),0)
                FROM venta_detalle vd JOIN ventas v ON vd.venta_id=v.id
                JOIN productos p ON vd.producto_id=p.id
                WHERE {cond_v} AND p.tipo_producto='consignacion'""",
            pv,
        ).fetchone()[0]

        # Gastos por tipo (tabla gastos)
        gc, gp = _date_clause("fecha")

        def sg(tipo):
            return conn.execute(
                f"SELECT COALESCE(SUM(monto),0) FROM gastos WHERE tipo=?{gc}", [tipo, *gp]
            ).fetchone()[0]

        g_salarios = sg("salario")
        g_transporte = sg("transporte")
        g_onat = sg("onat")
        g_arrend = sg("arrendamiento")
        g_contador = sg("contador")
        g_individual = sg("individual")

        # Movimientos de caja
        def sm(extra):
            return conn.execute(
                f"SELECT COALESCE(SUM(monto),0) FROM movimientos_caja WHERE {cond_m} AND {extra}", pm
            ).fetchone()[0]

        extracciones = sm("es_extraccion=1")
        compras_merc = sm("es_compra_mercancia=1")
        pagos_caja = sm("tipo_movimiento='pago' AND es_extraccion=0 AND es_compra_mercancia=0")

        # Deudas pagadas en el rango
        dc, dp = _date_clause("fecha")
        deudas_pagadas = conn.execute(
            f"SELECT COALESCE(SUM(monto),0) FROM pagos_deuda WHERE 1=1{dc}", dp
        ).fetchone()[0]

        # Faltante/sobrante: suma de diferencias de cajas cerradas en el rango
        fc, fp = _date_clause("fecha_cierre")
        faltante_sobrante = conn.execute(
            f"SELECT COALESCE(SUM(diferencia),0) FROM cajas WHERE estado='cerrada'{fc}", fp
        ).fetchone()[0]

        # Ganancia por elevación de precios (sobreprecio sobre precio de lista)
        ganancia_elevacion = conn.execute(
            f"""SELECT COALESCE(SUM(vd.ganancia_elevacion),0)
                FROM venta_detalle vd JOIN ventas v ON vd.venta_id=v.id WHERE {cond_v}""",
            pv,
        ).fetchone()[0]

        # Ventas a libreta/crédito y cobros del rango (base caja: memo, no entra a venta_total)
        venta_libreta = conn.execute(
            f"SELECT COALESCE(SUM(total),0) FROM creditos WHERE 1=1{dc}", dp
        ).fetchone()[0]
        cobros_libreta = conn.execute(
            f"SELECT COALESCE(SUM(monto),0) FROM pagos_credito WHERE 1=1{dc}", dp
        ).fetchone()[0]

        # Bajas / mermas valoradas al costo
        bajas_total = conn.execute(
            f"SELECT COALESCE(SUM(cantidad*costo_unitario),0) FROM bajas WHERE 1=1{dc}", dp
        ).fetchone()[0]

        # Entradas (compras de mercancía) valoradas al costo en el rango
        cc, cp = _date_clause("c.fecha")
        entradas_costo = conn.execute(
            f"""SELECT COALESCE(SUM(cd.subtotal),0)
                FROM compra_detalle cd JOIN compras c ON cd.compra_id=c.id
                WHERE 1=1{cc}""",
            cp,
        ).fetchone()[0]

        # Transferencia desglosada por persona/socio ("Transferencia jesus" vs general)
        ts_rows = conn.execute(
            f"""SELECT COALESCE(NULLIF(v.transferencia_socio,''),'general') soc,
                       COALESCE(SUM(v.subtotal_transferencia),0) m
                FROM ventas v WHERE {cond_v} AND v.subtotal_transferencia>0
                GROUP BY COALESCE(NULLIF(v.transferencia_socio,''),'general')""",
            pv,
        ).fetchall()
        transferencia_por_socio = {r[0]: r[1] for r in ts_rows}

    # ── P&L ──────────────────────────────────────────────────────────────────
    # Pérdida de ganancia = descuentos capturados en ventas + ajuste manual opcional.
    perdida_total = perdida_detalle + perdida_ganancia
    venta_real = venta_total - perdida_total
    utilidad_bruta = venta_real - venta_costo
    gastos_operativos = g_salarios + g_transporte
    onat_arrend = g_onat + g_arrend
    # Estimulación: calculada automáticamente (reemplaza el gasto manual).
    # 1% de (ventas totales − base fija − ventas al costo); nunca negativa.
    ESTIM_BASE = 300000.0
    ESTIM_PCT = 0.01
    g_estim = max(0.0, (venta_total - ESTIM_BASE - venta_costo) * ESTIM_PCT)
    utilidad_neta = utilidad_bruta - gastos_operativos - onat_arrend - g_contador - g_estim
    reserva = utilidad_neta * reserva_pct / 100
    dividendos = utilidad_neta - reserva
    por_socio = dividendos / socios if socios else dividendos
    efectivo_caja = efectivo - extracciones - compras_merc - pagos_caja - deudas_pagadas

    return {
        "desde": desde, "hasta": hasta,
        "venta_total": venta_total, "efectivo": efectivo, "transferencia": transferencia,
        "venta_propia": venta_propia, "venta_consignacion": venta_consignacion,
        "perdida_ganancia": perdida_total, "venta_real": venta_real,
        "venta_costo": venta_costo, "utilidad_bruta": utilidad_bruta,
        "gastos": {
            "salarios": g_salarios, "transporte": g_transporte,
            "onat": g_onat, "arrendamiento": g_arrend, "contador": g_contador,
            "estimulacion": g_estim, "individual": g_individual,
            "operativos": gastos_operativos,
        },
        "utilidad_neta": utilidad_neta,
        "reserva_pct": reserva_pct, "reserva": reserva,
        "dividendos": dividendos, "socios": socios, "por_socio": por_socio,
        "movimientos": {
            "extracciones": extracciones, "compras_mercancia": compras_merc,
            "pagos_caja": pagos_caja, "deudas_pagadas": deudas_pagadas,
        },
        "consignadores_a_pagar": consig_a_pagar,
        "faltante_sobrante": faltante_sobrante,
        "efectivo_caja": efectivo_caja,
        "ganancia_elevacion": ganancia_elevacion,
        "venta_libreta": venta_libreta,
        "cobros_libreta": cobros_libreta,
        "bajas_total": bajas_total,
        "entradas_costo": entradas_costo,
        "transferencia_por_socio": transferencia_por_socio,
    }


@router.get("/cuadre")
def cuadre(desde: Optional[str] = None, hasta: Optional[str] = None,
           socios: int = 2, reserva_pct: float = 20.0, perdida_ganancia: float = 0.0):
    return compute_cuadre(desde, hasta, socios, reserva_pct, perdida_ganancia)


@router.get("/ventas-por-dia")
def ventas_por_dia(desde: Optional[str] = None, hasta: Optional[str] = None,
                   caja_id: Optional[int] = None):
    """Historial de ventas agrupado por día (registro persistente y accesible por
    el admin). El total incluye la consignación y se desglosa. Solo lectura."""
    cond, params = _where_ventas(caja_id, desde, hasta)
    with get_conn() as conn:
        rows = conn.execute(
            f"""SELECT substr(v.fecha,1,10) AS dia,
                       COUNT(*) AS num_ventas,
                       COALESCE(SUM(v.total),0) AS venta_total,
                       COALESCE(SUM(v.subtotal_efectivo),0) AS efectivo,
                       COALESCE(SUM(v.subtotal_transferencia),0) AS transferencia,
                       COALESCE(SUM(CASE WHEN v.es_consignacion=1 THEN v.total ELSE 0 END),0) AS venta_consignacion,
                       COALESCE(SUM(CASE WHEN v.es_consignacion=0 THEN v.total ELSE 0 END),0) AS venta_propia
                FROM ventas v
                WHERE {cond}
                GROUP BY substr(v.fecha,1,10)
                ORDER BY dia DESC""",
            params,
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/movimientos-caja")
def movimientos_caja(desde: Optional[str] = None, hasta: Optional[str] = None,
                     caja_id: Optional[int] = None):
    """Libro de movimientos de caja: cada entrada/salida de efectivo con su
    dirección, más un resumen (entra/sale/neto). 'Todo lo que se mueve'."""
    d1, d2 = _norm_dt(desde), _norm_dt(hasta)
    conds, params = ["1=1"], []
    if caja_id is not None:
        conds.append("m.caja_id=?")
        params.append(caja_id)
    if d1:
        conds.append("m.fecha>=?")
        params.append(d1)
    if d2:
        conds.append("m.fecha<=?")
        params.append(d2)
    where = " AND ".join(conds)
    with get_conn() as conn:
        rows = conn.execute(
            f"""SELECT m.*, c.numero AS caja_numero
                FROM movimientos_caja m
                LEFT JOIN cajas c ON m.caja_id=c.id
                WHERE {where}
                ORDER BY m.fecha DESC, m.id DESC""",
            params,
        ).fetchall()
    entra = sale = 0.0
    movimientos = []
    for r in rows:
        d = dict(r)
        monto = d.get("monto") or 0
        # Sale el dinero si es extracción, compra de mercancía o pago; si no, entra.
        if d.get("es_extraccion") or d.get("es_compra_mercancia") or d.get("tipo_movimiento") == "pago":
            d["direccion"] = "sale"
            sale += monto
        else:
            d["direccion"] = "entra"
            entra += monto
        movimientos.append(d)
    return {
        "movimientos": movimientos,
        "resumen": {"entra": entra, "sale": sale, "neto": entra - sale, "n": len(movimientos)},
    }


@router.get("/inventario-movimientos")
def inventario_movimientos(desde: Optional[str] = None, hasta: Optional[str] = None):
    """Resumen + detalle de ENTRADAS (compras) y BAJAS (mermas) del rango,
    valoradas al costo. Solo lectura."""
    d1, d2 = _norm_dt(desde), _norm_dt(hasta)

    def clause(col):
        c, p = "", []
        if d1:
            c += f" AND {col}>=?"
            p.append(d1)
        if d2:
            c += f" AND {col}<=?"
            p.append(d2)
        return c, p

    with get_conn() as conn:
        ec, ep = clause("co.fecha")
        ent_cat = conn.execute(
            f"""SELECT cat.nombre AS categoria,
                       COALESCE(SUM(cd.cantidad),0) AS uds,
                       COALESCE(SUM(cd.subtotal),0) AS valor
                FROM compra_detalle cd
                JOIN compras co ON cd.compra_id=co.id
                JOIN productos p ON cd.producto_id=p.id
                JOIN categorias cat ON p.categoria_id=cat.id
                WHERE 1=1{ec} GROUP BY cat.id ORDER BY valor DESC""", ep).fetchall()
        ent_det = conn.execute(
            f"""SELECT co.fecha, p.nombre AS producto, cat.nombre AS categoria,
                       cd.cantidad, cd.costo_unitario, cd.subtotal AS valor
                FROM compra_detalle cd
                JOIN compras co ON cd.compra_id=co.id
                JOIN productos p ON cd.producto_id=p.id
                JOIN categorias cat ON p.categoria_id=cat.id
                WHERE 1=1{ec} ORDER BY co.fecha DESC, cd.id DESC""", ep).fetchall()
        bc, bp = clause("b.fecha")
        baj_cat = conn.execute(
            f"""SELECT cat.nombre AS categoria,
                       COALESCE(SUM(b.cantidad),0) AS uds,
                       COALESCE(SUM(b.cantidad*b.costo_unitario),0) AS valor
                FROM bajas b
                JOIN productos p ON b.producto_id=p.id
                JOIN categorias cat ON p.categoria_id=cat.id
                WHERE 1=1{bc} GROUP BY cat.id ORDER BY valor DESC""", bp).fetchall()
        baj_det = conn.execute(
            f"""SELECT b.fecha, p.nombre AS producto, cat.nombre AS categoria,
                       b.cantidad, b.costo_unitario,
                       (b.cantidad*b.costo_unitario) AS valor, b.razon, b.observacion
                FROM bajas b
                JOIN productos p ON b.producto_id=p.id
                JOIN categorias cat ON p.categoria_id=cat.id
                WHERE 1=1{bc} ORDER BY b.fecha DESC, b.id DESC""", bp).fetchall()

    def suma(rows, k):
        return sum((r[k] or 0) for r in rows)

    return {
        "entradas": {
            "total_uds": suma(ent_cat, "uds"),
            "total_valor": suma(ent_cat, "valor"),
            "por_categoria": [dict(r) for r in ent_cat],
            "detalle": [dict(r) for r in ent_det],
        },
        "bajas": {
            "total_uds": suma(baj_cat, "uds"),
            "total_valor": suma(baj_cat, "valor"),
            "por_categoria": [dict(r) for r in baj_cat],
            "detalle": [dict(r) for r in baj_det],
        },
    }


@router.get("/inventario")
def inventario(caja_id: Optional[int] = None):
    """Inventario valorado por categoría (equivale a 'IMPORTE EN MERCANCIA' del
    CUADRE INICIAL): unidades en stock, valor al costo, valor a la venta y
    utilidad potencial. Si se pasa caja_id, limita a las categorías de esa caja.
    """
    cat_filter = ""
    params: list = []
    if caja_id is not None:
        cat_filter = "AND c.id IN (SELECT categoria_id FROM cajas_config WHERE caja_id=?)"
        params.append(caja_id)
    query = f"""
        SELECT c.id AS categoria_id, c.nombre, c.es_consignacion,
               COUNT(p.id) AS productos,
               COALESCE(SUM(p.stock_actual), 0)                AS unidades,
               COALESCE(SUM(p.stock_actual * p.costo), 0)       AS valor_costo,
               COALESCE(SUM(p.stock_actual * p.precio_venta), 0) AS valor_venta
        FROM categorias c
        LEFT JOIN productos p ON p.categoria_id = c.id AND p.activa = 1
        WHERE c.activa = 1 {cat_filter}
        GROUP BY c.id
        ORDER BY valor_costo DESC
    """
    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()

    categorias = []
    total = {"productos": 0, "unidades": 0, "valor_costo": 0.0,
             "valor_venta": 0.0, "utilidad_potencial": 0.0}
    for r in rows:
        d = dict(r)
        d["utilidad_potencial"] = d["valor_venta"] - d["valor_costo"]
        categorias.append(d)
        total["productos"] += d["productos"]
        total["unidades"] += d["unidades"]
        total["valor_costo"] += d["valor_costo"]
        total["valor_venta"] += d["valor_venta"]
        total["utilidad_potencial"] += d["utilidad_potencial"]
    return {"categorias": categorias, "total": total}


@router.get("/utilidad-por-producto")
def utilidad_por_producto(desde: Optional[str] = None, hasta: Optional[str] = None,
                          caja_id: Optional[int] = None):
    cond_v, params_v = _where_ventas(caja_id, desde, hasta)
    query = f"""
        SELECT p.id AS producto_id, p.nombre, c.nombre AS categoria_nombre,
               p.tipo_producto,
               CASE WHEN p.tipo_producto='consignacion' THEN 1 ELSE 0 END AS es_consignacion,
               COALESCE(SUM(vd.cantidad),0) AS unidades,
               COALESCE(SUM(vd.subtotal),0) AS venta_total,
               COALESCE(SUM(vd.ganancia_total),0) AS utilidad_total
        FROM venta_detalle vd
        JOIN ventas v ON vd.venta_id=v.id
        JOIN productos p ON vd.producto_id=p.id
        JOIN categorias c ON p.categoria_id=c.id
        WHERE {cond_v}
        GROUP BY p.id
        ORDER BY utilidad_total DESC
    """
    with get_conn() as conn:
        rows = conn.execute(query, params_v).fetchall()
    return [dict(r) for r in rows]


def _dias_semana(desde: str, hasta: str) -> list[str]:
    from datetime import datetime, timedelta
    d = datetime.strptime(desde[:10], "%Y-%m-%d")
    h = datetime.strptime(hasta[:10], "%Y-%m-%d")
    dias = []
    while d <= h:
        dias.append(d.strftime("%Y-%m-%d"))
        d += timedelta(days=1)
    return dias


def _dia_nombre(fecha_iso: str) -> str:
    nombres = {0: "Domingo", 1: "Lunes", 2: "Martes", 3: "Miercoles",
               4: "Jueves", 5: "Viernes", 6: "Sabado"}
    from datetime import datetime
    return nombres[datetime.strptime(fecha_iso[:10], "%Y-%m-%d").weekday()]


def _serie_por_dia(conn, query: str, params) -> dict:
    """Ejecuta una consulta agrupada por fecha (substr 1..10) y devuelve
    {'YYYY-MM-DD': valor} para mapear rapido sobre el rango de dias."""
    return {r[0]: r[1] for r in conn.execute(query, params).fetchall()}


@router.get("/movimientos-diarios")
def movimientos_diarios(desde: Optional[str] = None, hasta: Optional[str] = None,
                        caja_id: Optional[int] = None):
    """Movimientos de inventario diarios por producto: entradas (compras+consignaciones),
    ventas, y stock final por cada dia de la semana, agrupados por categoria."""
    if not desde or not hasta:
        return {"categorias": [], "dias": []}

    dias = _dias_semana(desde, hasta)
    with get_conn() as conn:
        cats = conn.execute(
            "SELECT id, nombre FROM categorias WHERE activa=1 ORDER BY nombre"
        ).fetchall()

        categorias_out = []
        for cat in cats:
            prods = conn.execute(
                "SELECT id, nombre, costo, precio_venta, stock_actual "
                "FROM productos WHERE categoria_id=? AND activa=1 ORDER BY nombre",
                (cat["id"],),
            ).fetchall()

            productos_out = []
            cat_venta_total = 0
            cat_utilidad_total = 0
            cat_stock_final = 0

            for p in prods:
                prod_dias = []
                total_entradas = 0
                total_ventas = 0

                for dia in dias:
                    dia_sig = dia + " 23:59:59"
                    entradas = conn.execute(
                        """SELECT COALESCE(SUM(cd.cantidad),0)
                           FROM compra_detalle cd
                           JOIN compras c ON cd.compra_id=c.id
                           WHERE cd.producto_id=? AND c.fecha>=? AND c.fecha<=?""",
                        (p["id"], dia, dia_sig),
                    ).fetchone()[0]
                    entradas_consig = conn.execute(
                        """SELECT COALESCE(SUM(cd.cantidad_entregada),0)
                           FROM consignacion_detalle cd
                           JOIN consignaciones c ON cd.consignacion_id=c.id
                           WHERE cd.producto_id=? AND c.fecha_inicio>=? AND c.fecha_inicio<=?""",
                        (p["id"], dia, dia_sig),
                    ).fetchone()[0]
                    ventas_dia = conn.execute(
                        """SELECT COALESCE(SUM(vd.cantidad),0)
                           FROM venta_detalle vd
                           JOIN ventas v ON vd.venta_id=v.id
                           WHERE vd.producto_id=? AND v.estado!='cancelada'
                           AND v.fecha>=? AND v.fecha<=?""",
                        (p["id"], dia, dia_sig),
                    ).fetchone()[0]

                    total_entradas += entradas + entradas_consig
                    total_ventas += ventas_dia
                    prod_dias.append({
                        "fecha": dia,
                        "dia": _dia_nombre(dia),
                        "entradas": entradas + entradas_consig,
                        "ventas": ventas_dia,
                    })

                venta_prod = conn.execute(
                    """SELECT COALESCE(SUM(vd.subtotal),0), COALESCE(SUM(vd.ganancia_total),0)
                       FROM venta_detalle vd JOIN ventas v ON vd.venta_id=v.id
                       WHERE vd.producto_id=? AND v.estado!='cancelada'
                       AND v.fecha>=? AND v.fecha<=?""",
                    (p["id"], desde, hasta + " 23:59:59"),
                ).fetchone()

                stock_final = p["stock_actual"]
                cat_venta_total += venta_prod[0]
                cat_utilidad_total += venta_prod[1]
                cat_stock_final += stock_final

                productos_out.append({
                    "producto_id": p["id"],
                    "nombre": p["nombre"],
                    "costo": p["costo"],
                    "precio_venta": p["precio_venta"],
                    "dias": prod_dias,
                    "venta_total": venta_prod[0],
                    "utilidad_total": venta_prod[1],
                    "stock_final": stock_final,
                })

            if productos_out:
                categorias_out.append({
                    "categoria_id": cat["id"],
                    "categoria_nombre": cat["nombre"],
                    "productos": productos_out,
                    "venta_total": cat_venta_total,
                    "utilidad_total": cat_utilidad_total,
                    "stock_final": cat_stock_final,
                })

    return {"categorias": categorias_out, "dias": dias}


@router.get("/cobro-diario")
def cobro_diario(desde: Optional[str] = None, hasta: Optional[str] = None,
                 caja_id: Optional[int] = None):
    """Cobro en efectivo por dia y por categoria (columnas AA-AN del Excel)."""
    if not desde or not hasta:
        return {"dias": [], "categorias": [], "totales_por_dia": {}}

    dias = _dias_semana(desde, hasta)
    cond_v, params_v = _where_ventas(caja_id, desde, hasta + " 23:59:59")

    with get_conn() as conn:
        cats = conn.execute(
            "SELECT id, nombre FROM categorias WHERE activa=1 ORDER BY nombre"
        ).fetchall()

        cat_dias = {}
        for cat in cats:
            cat_dias[cat["id"]] = {"nombre": cat["nombre"], "montos": {}}
            for dia in dias:
                dia_sig = dia + " 23:59:59"
                monto = conn.execute(
                    f"""SELECT COALESCE(SUM(vd.subtotal),0)
                        FROM venta_detalle vd
                        JOIN ventas v ON vd.venta_id=v.id
                        JOIN productos p ON vd.producto_id=p.id
                        WHERE p.categoria_id=? AND v.estado!='cancelada'
                        AND v.fecha>=? AND v.fecha<=?""",
                    (cat["id"], dia, dia_sig),
                ).fetchone()[0]
                cat_dias[cat["id"]]["montos"][dia] = monto

        totales_por_dia = {}
        for dia in dias:
            totales_por_dia[dia] = sum(
                cat_dias[c["id"]]["montos"].get(dia, 0) for c in cats
            )

    return {
        "dias": dias,
        "categorias": [
            {"categoria_id": c["id"], "nombre": cat_dias[c["id"]]["nombre"],
             "montos": cat_dias[c["id"]]["montos"]}
            for c in cats
        ],
        "totales_por_dia": totales_por_dia,
    }

