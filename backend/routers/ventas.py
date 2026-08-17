from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_conn

router = APIRouter(prefix="/api/ventas", tags=["ventas"])


class ItemVenta(BaseModel):
    producto_id: int
    cantidad: float = 1
    precio_unitario: Optional[float] = None


class VentaPayload(BaseModel):
    items: list[ItemVenta]
    subtotal_efectivo: float = 0
    subtotal_transferencia: float = 0
    observacion: str = ""
    caja_id: Optional[int] = None
    cajero_id: Optional[int] = None
    cajero_nombre: Optional[str] = None
    transferencia_socio: Optional[str] = None


class FiltrosVenta(BaseModel):
    caja_id: Optional[int] = None
    estado: Optional[str] = None
    desde: Optional[str] = None
    hasta: Optional[str] = None


def _detalle_venta(conn, venta_id: int) -> dict:
    venta = conn.execute("SELECT * FROM ventas WHERE id=?", (venta_id,)).fetchone()
    if not venta:
        return None
    items_rows = conn.execute(
        "SELECT vd.*, p.nombre AS producto_nombre, c.nombre AS categoria_nombre "
        "FROM venta_detalle vd "
        "JOIN productos p ON vd.producto_id=p.id "
        "JOIN categorias c ON p.categoria_id=c.id "
        "WHERE vd.venta_id=?",
        (venta_id,),
    ).fetchall()
    result = dict(venta)
    result["items"] = [dict(r) for r in items_rows]
    if result.get("caja_id"):
        caja_row = conn.execute(
            "SELECT numero FROM cajas WHERE id=?", (result["caja_id"],)
        ).fetchone()
        result["caja_numero"] = caja_row["numero"] if caja_row else result["caja_id"]
    else:
        result["caja_numero"] = None
    return result


@router.get("")
def listar(caja_id: Optional[int] = None, estado: Optional[str] = None,
           desde: Optional[str] = None, hasta: Optional[str] = None):
    with get_conn() as conn:
        query = "SELECT id FROM ventas WHERE 1=1"
        params = []
        if caja_id is not None:
            query += " AND caja_id=?"
            params.append(caja_id)
        if estado:
            query += " AND estado=?"
            params.append(estado)
        if desde:
            query += " AND date(fecha)>=date(?)"
            params.append(desde)
        if hasta:
            query += " AND date(fecha)<=date(?)"
            params.append(hasta)
        query += " ORDER BY fecha DESC"
        ids = [r[0] for r in conn.execute(query, params).fetchall()]
        return [_detalle_venta(conn, vid) for vid in ids]


@router.get("/{id}")
def obtener(id: int):
    with get_conn() as conn:
        result = _detalle_venta(conn, id)
    if not result:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return result


@router.post("")
def registrar(payload: VentaPayload):
    with get_conn() as conn:
        caja_row = conn.execute(
            "SELECT id FROM cajas WHERE estado='abierta' LIMIT 1"
        ).fetchone()
        caja_id = payload.caja_id or (caja_row["id"] if caja_row else None)

        subtotal_efectivo = payload.subtotal_efectivo
        subtotal_transferencia = payload.subtotal_transferencia
        total = subtotal_efectivo + subtotal_transferencia
        if subtotal_efectivo > 0 and subtotal_transferencia > 0:
            tipo_pago = "mixto"
        elif subtotal_transferencia > 0:
            tipo_pago = "transferencia"
        else:
            tipo_pago = "efectivo"

        es_consignacion_venta = 0
        cur = conn.execute(
            """INSERT INTO ventas (caja_id, tipo_pago, total, subtotal_efectivo,
               subtotal_transferencia, es_consignacion, observacion,
               cajero_id, cajero_nombre, transferencia_socio)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (caja_id, tipo_pago, total, subtotal_efectivo,
             subtotal_transferencia, 0, payload.observacion,
             payload.cajero_id, payload.cajero_nombre, payload.transferencia_socio),
        )
        venta_id = cur.lastrowid

        for item in payload.items:
            prod = conn.execute("SELECT * FROM productos WHERE id=?", (item.producto_id,)).fetchone()
            if not prod:
                continue
            cantidad = item.cantidad
            if prod["stock_actual"] < cantidad:
                raise HTTPException(
                    status_code=422,
                    detail=f"Stock insuficiente para '{prod['nombre']}': disponible {prod['stock_actual']}, solicitado {cantidad}",
                )
            precio_unitario = item.precio_unitario if item.precio_unitario is not None else prod["precio_venta"]
            costo_unitario = prod["costo"]
            subtotal = cantidad * precio_unitario
            ganancia_unitaria = precio_unitario - costo_unitario
            # Pérdida de ganancia: si se vende por debajo del precio normal (descuento).
            perdida_ganancia = max(0.0, prod["precio_venta"] - precio_unitario) * cantidad
            # Ganancia por elevación: si se vende por encima del precio de lista (inverso).
            ganancia_elevacion = max(0.0, precio_unitario - prod["precio_venta"]) * cantidad
            es_cons = 1 if prod["tipo_producto"] == "consignacion" else 0
            if es_cons:
                es_consignacion_venta = 1
            conn.execute(
                """INSERT INTO venta_detalle
                   (venta_id, producto_id, cantidad, costo_unitario, precio_unitario,
                    subtotal, ganancia_unitaria, ganancia_total, es_consignacion,
                    perdida_ganancia, ganancia_elevacion)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (venta_id, prod["id"], cantidad, costo_unitario, precio_unitario,
                 subtotal, ganancia_unitaria, ganancia_unitaria * cantidad, es_cons,
                 perdida_ganancia, ganancia_elevacion),
            )
            nuevo_stock = max(0, prod["stock_actual"] - cantidad)
            conn.execute("UPDATE productos SET stock_actual=? WHERE id=?", (nuevo_stock, prod["id"]))

        conn.execute(
            "UPDATE ventas SET es_consignacion=? WHERE id=?", (es_consignacion_venta, venta_id)
        )

        if caja_id and subtotal_efectivo > 0:
            conn.execute(
                """INSERT INTO movimientos_caja
                   (caja_id, tipo_movimiento, concepto, monto, metodo_pago,
                    relacionado_tipo, relacionado_id, es_extraccion, es_compra_mercancia,
                    cajero_id, cajero_nombre)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (caja_id, "venta", f"Venta #{venta_id}", subtotal_efectivo,
                 "efectivo", "venta", venta_id, 0, 0,
                 payload.cajero_id, payload.cajero_nombre),
            )

        return _detalle_venta(conn, venta_id)


@router.post("/{id}/cancelar")
def cancelar(id: int):
    with get_conn() as conn:
        venta = conn.execute("SELECT * FROM ventas WHERE id=?", (id,)).fetchone()
        if not venta:
            raise HTTPException(status_code=404, detail="Venta no encontrada")
        # Sin este corte, cancelar dos veces devolvía el stock dos veces e inflaba
        # el inventario con unidades que nunca existieron.
        if venta["estado"] == "cancelada":
            raise HTTPException(status_code=409, detail="La venta ya estaba cancelada")
        conn.execute(
            "UPDATE ventas SET estado='cancelada', cancelada_en=datetime('now') WHERE id=?", (id,)
        )
        items = conn.execute("SELECT * FROM venta_detalle WHERE venta_id=?", (id,)).fetchall()
        for item in items:
            conn.execute(
                "UPDATE productos SET stock_actual=stock_actual+? WHERE id=?",
                (item["cantidad"], item["producto_id"]),
            )
        # Revertir el movimiento de efectivo asociado: si no, el historial de
        # movimientos de la caja seguiría mostrando una entrada de una venta anulada.
        conn.execute(
            "DELETE FROM movimientos_caja WHERE relacionado_tipo='venta' AND relacionado_id=?",
            (id,),
        )
        return _detalle_venta(conn, id)


@router.delete("/{id}")
def eliminar(id: int):
    """Elimina una venta por completo (acción del administrador). Restaura el stock
    vendido, borra el detalle y el movimiento de efectivo asociado. Si la venta ya
    estaba cancelada, NO restaura stock de nuevo (la cancelación ya lo había devuelto)."""
    with get_conn() as conn:
        venta = conn.execute("SELECT * FROM ventas WHERE id=?", (id,)).fetchone()
        if not venta:
            raise HTTPException(status_code=404, detail="Venta no encontrada")
        items = conn.execute("SELECT * FROM venta_detalle WHERE venta_id=?", (id,)).fetchall()
        if venta["estado"] != "cancelada":
            for item in items:
                conn.execute(
                    "UPDATE productos SET stock_actual=stock_actual+? WHERE id=?",
                    (item["cantidad"], item["producto_id"]),
                )
        conn.execute("DELETE FROM venta_detalle WHERE venta_id=?", (id,))
        conn.execute(
            "DELETE FROM movimientos_caja WHERE relacionado_tipo='venta' AND relacionado_id=?",
            (id,),
        )
        conn.execute("DELETE FROM ventas WHERE id=?", (id,))
    return {"ok": True}
