from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
from database import get_conn

router = APIRouter(prefix="/api/compras", tags=["compras"])


class ItemCompra(BaseModel):
    producto_id: int
    cantidad: float
    costo_unitario: float


class CompraPayload(BaseModel):
    items: list[ItemCompra]
    metodo_pago: str = "efectivo"
    descuenta_fondo: bool = True
    procedencia: Optional[str] = None
    observacion: str = ""
    caja_id: Optional[int] = None
    cajero_id: Optional[int] = None
    cajero_nombre: Optional[str] = None


def _detalle_compra(conn, compra_id: int) -> dict:
    c = conn.execute("SELECT * FROM compras WHERE id=?", (compra_id,)).fetchone()
    if not c:
        return None
    items = conn.execute(
        "SELECT cd.*, p.nombre AS producto_nombre FROM compra_detalle cd "
        "JOIN productos p ON cd.producto_id=p.id WHERE cd.compra_id=?",
        (compra_id,),
    ).fetchall()
    result = dict(c)
    result["items"] = [dict(r) for r in items]
    return result


@router.get("")
def listar():
    with get_conn() as conn:
        ids = [r[0] for r in conn.execute("SELECT id FROM compras ORDER BY id DESC").fetchall()]
        return [_detalle_compra(conn, cid) for cid in ids]


@router.post("")
def registrar(payload: CompraPayload):
    with get_conn() as conn:
        total = sum(i.cantidad * i.costo_unitario for i in payload.items)
        cur = conn.execute(
            """INSERT INTO compras (total, metodo_pago, descuenta_fondo, procedencia,
               observacion, cajero_id, cajero_nombre)
               VALUES (?,?,?,?,?,?,?)""",
            (total, payload.metodo_pago, 1 if payload.descuenta_fondo else 0,
             payload.procedencia, payload.observacion,
             payload.cajero_id, payload.cajero_nombre),
        )
        compra_id = cur.lastrowid

        for item in payload.items:
            subtotal = item.cantidad * item.costo_unitario
            conn.execute(
                """INSERT INTO compra_detalle (compra_id, producto_id, cantidad, costo_unitario, subtotal)
                   VALUES (?,?,?,?,?)""",
                (compra_id, item.producto_id, item.cantidad, item.costo_unitario, subtotal),
            )
            conn.execute(
                "UPDATE productos SET stock_actual=stock_actual+?, costo=?, ganancia=precio_venta-? WHERE id=?",
                (item.cantidad, item.costo_unitario, item.costo_unitario, item.producto_id),
            )

        if payload.descuenta_fondo:
            if payload.caja_id is not None:
                caja = conn.execute(
                    "SELECT id FROM cajas WHERE id=? AND estado='abierta'", (payload.caja_id,)
                ).fetchone()
            else:
                caja = conn.execute("SELECT id FROM cajas WHERE estado='abierta' LIMIT 1").fetchone()
            if caja:
                conn.execute(
                    """INSERT INTO movimientos_caja
                       (caja_id, tipo_movimiento, concepto, monto, metodo_pago,
                        relacionado_tipo, relacionado_id, es_extraccion, es_compra_mercancia,
                        cajero_id, cajero_nombre)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                    (caja["id"], "compra_mercancia", f"Compra mercancía #{compra_id}",
                     total, payload.metodo_pago, "compra", compra_id, 0, 1,
                     payload.cajero_id, payload.cajero_nombre),
                )

        return _detalle_compra(conn, compra_id)
