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
