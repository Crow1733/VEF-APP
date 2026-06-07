from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_conn

router = APIRouter(prefix="/api/consignaciones", tags=["consignaciones"])


class ConsignacionPayload(BaseModel):
    consignador: str
    categoria_id: Optional[int] = None
    observacion: str = ""


class EntregaPayload(BaseModel):
    producto_id: int
    cantidad: float
    costo_acordado: float = 0
    precio_venta: float = 0


def _detalle(conn, cid: int) -> dict:
    c = conn.execute("SELECT * FROM consignaciones WHERE id=?", (cid,)).fetchone()
    if not c:
        return None
    cat = conn.execute("SELECT nombre FROM categorias WHERE id=?", (c["categoria_id"],)).fetchone()
    items = conn.execute(
        "SELECT cd.*, p.nombre AS producto_nombre, p.stock_actual FROM consignacion_detalle cd "
        "JOIN productos p ON cd.producto_id=p.id WHERE cd.consignacion_id=?",
        (cid,),
    ).fetchall()
    enriched_items = []
    for item in items:
        d = dict(item)
        vendidos = conn.execute(
            "SELECT COALESCE(SUM(vd.cantidad),0) FROM venta_detalle vd "
            "JOIN ventas v ON vd.venta_id=v.id "
            "WHERE vd.producto_id=? AND v.estado!='cancelada'",
            (d["producto_id"],),
        ).fetchone()[0]
        d["cantidad_vendida"] = vendidos
        d["subtotal_venta"] = vendidos * d["precio_venta"]
        enriched_items.append(d)

    result = dict(c)
    result["categoria_nombre"] = cat["nombre"] if cat else ""
    result["items"] = enriched_items
    result["total_vendido"] = sum(i["subtotal_venta"] for i in enriched_items)
    return result


@router.get("")
def listar():
    with get_conn() as conn:
        ids = [r[0] for r in conn.execute("SELECT id FROM consignaciones ORDER BY id DESC").fetchall()]
        return [_detalle(conn, cid) for cid in ids]


@router.post("")
def crear(payload: ConsignacionPayload):
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO consignaciones (consignador, categoria_id, observacion) VALUES (?,?,?)",
            (payload.consignador, payload.categoria_id, payload.observacion),
        )
        return _detalle(conn, cur.lastrowid)


@router.post("/{id}/entrega")
def agregar_entrega(id: int, payload: EntregaPayload):
    with get_conn() as conn:
        c = conn.execute("SELECT id FROM consignaciones WHERE id=?", (id,)).fetchone()
        if not c:
            raise HTTPException(status_code=404, detail="Consignación no encontrada")
        conn.execute(
            """INSERT INTO consignacion_detalle
               (consignacion_id, producto_id, cantidad_entregada, costo_acordado, precio_venta)
               VALUES (?,?,?,?,?)""",
            (id, payload.producto_id, payload.cantidad, payload.costo_acordado, payload.precio_venta),
        )
        conn.execute(
            "UPDATE productos SET stock_actual=stock_actual+? WHERE id=?",
            (payload.cantidad, payload.producto_id),
        )
        return _detalle(conn, id)


@router.post("/{id}/cerrar")
def cerrar(id: int):
    with get_conn() as conn:
        c = conn.execute("SELECT id FROM consignaciones WHERE id=?", (id,)).fetchone()
        if not c:
            raise HTTPException(status_code=404, detail="Consignación no encontrada")
        conn.execute(
            "UPDATE consignaciones SET estado='cerrada', fecha_fin=datetime('now') WHERE id=?", (id,)
        )
        return _detalle(conn, id)
