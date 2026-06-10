from typing import Optional
from fastapi import APIRouter
from database import get_conn

router = APIRouter(prefix="/api/reportes", tags=["reportes"])


def _where_ventas(caja_id, desde, hasta) -> tuple[str, list]:
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

    def _date_clause(col: str):
        c, p = "", []
        if desde:
            c += f" AND {col}>=?"
            p.append(desde)
        if hasta:
            c += f" AND {col}<=?"
            p.append(hasta)
        return c, p

    with get_conn() as conn:
        def sv(expr):
            return conn.execute(f"SELECT COALESCE({expr},0) FROM ventas v WHERE {cond_v}", pv).fetchone()[0]

        venta_total = sv("SUM(total)")
        efectivo = sv("SUM(subtotal_efectivo)")
        transferencia = sv("SUM(subtotal_transferencia)")
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
        g_estim = sg("estimulacion")
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

    # ── P&L ──────────────────────────────────────────────────────────────────
    # Pérdida de ganancia = descuentos capturados en ventas + ajuste manual opcional.
    perdida_total = perdida_detalle + perdida_ganancia
    venta_real = venta_total - perdida_total
    utilidad_bruta = venta_real - venta_costo
    gastos_operativos = g_salarios + g_transporte
    onat_arrend = g_onat + g_arrend
    utilidad_neta = utilidad_bruta - gastos_operativos - onat_arrend - g_contador - g_estim
    reserva = utilidad_neta * reserva_pct / 100
    dividendos = utilidad_neta - reserva
    por_socio = dividendos / socios if socios else dividendos
    efectivo_caja = efectivo - extracciones - compras_merc - pagos_caja - deudas_pagadas

    return {
        "desde": desde, "hasta": hasta,
        "venta_total": venta_total, "efectivo": efectivo, "transferencia": transferencia,
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
    }


@router.get("/cuadre")
def cuadre(desde: Optional[str] = None, hasta: Optional[str] = None,
           socios: int = 2, reserva_pct: float = 20.0, perdida_ganancia: float = 0.0):
    return compute_cuadre(desde, hasta, socios, reserva_pct, perdida_ganancia)


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
