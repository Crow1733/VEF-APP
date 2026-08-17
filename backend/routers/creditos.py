from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_conn, norm_fecha

router = APIRouter(prefix="/api/creditos", tags=["creditos"])


class ItemCredito(BaseModel):
    producto_id: int
    cantidad: float = 1
    precio_unitario: Optional[float] = None


class CreditoPayload(BaseModel):
    cliente: str = ""
    items: list[ItemCredito] = []
    observacion: str = ""
    fecha: Optional[str] = None
    caja_id: Optional[int] = None
    cajero_id: Optional[int] = None
    cajero_nombre: Optional[str] = None


class PagoCreditoPayload(BaseModel):
    monto: float
    metodo_pago: str = "efectivo"
    fecha: Optional[str] = None
    caja_id: Optional[int] = None
    cajero_id: Optional[int] = None
    cajero_nombre: Optional[str] = None


def _detalle_credito(conn, credito_id: int) -> Optional[dict]:
    credito = conn.execute("SELECT * FROM creditos WHERE id=?", (credito_id,)).fetchone()
    if not credito:
        return None
    items = conn.execute(
        "SELECT cd.*, p.nombre AS producto_nombre, c.nombre AS categoria_nombre "
        "FROM credito_detalle cd "
        "JOIN productos p ON cd.producto_id=p.id "
        "JOIN categorias c ON p.categoria_id=c.id "
        "WHERE cd.credito_id=?",
        (credito_id,),
    ).fetchall()
    result = dict(credito)
    result["items"] = [dict(r) for r in items]
    return result


@router.get("")
def listar(estado: Optional[str] = None, cliente: Optional[str] = None,
           desde: Optional[str] = None, hasta: Optional[str] = None):
    query = "SELECT id FROM creditos WHERE 1=1"
    params: list = []
    if estado:
        query += " AND estado=?"
        params.append(estado)
    if cliente:
        query += " AND cliente LIKE ?"
        params.append(f"%{cliente}%")
    if desde:
        query += " AND date(fecha)>=date(?)"
        params.append(desde)
    if hasta:
        query += " AND date(fecha)<=date(?)"
        params.append(hasta)
    query += " ORDER BY (estado='pagada'), fecha DESC, id DESC"
    with get_conn() as conn:
        ids = [r[0] for r in conn.execute(query, params).fetchall()]
        return [_detalle_credito(conn, cid) for cid in ids]


@router.get("/{id}")
def obtener(id: int):
    with get_conn() as conn:
        result = _detalle_credito(conn, id)
    if not result:
        raise HTTPException(status_code=404, detail="Crédito no encontrado")
    return result


@router.get("/{id}/pagos")
def pagos(id: int):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM pagos_credito WHERE credito_id=? ORDER BY fecha DESC, id DESC", (id,)
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("")
def registrar(payload: CreditoPayload):
    """Venta a crédito/libreta: descuenta stock y crea la cuenta por cobrar.
    Base caja: NO genera movimiento de efectivo (se cobra después con /pago)."""
    with get_conn() as conn:
        caja_row = conn.execute(
            "SELECT id FROM cajas WHERE estado='abierta' LIMIT 1"
        ).fetchone()
        caja_id = payload.caja_id or (caja_row["id"] if caja_row else None)

        fecha_sql = "datetime('now')"
        base_cols = "(cliente, total, saldo, estado, observacion, caja_id, cajero_id, cajero_nombre"
        base_vals = [payload.cliente, 0, 0, "activa", payload.observacion, caja_id,
                     payload.cajero_id, payload.cajero_nombre]
        if payload.fecha:
            cur = conn.execute(
                f"INSERT INTO creditos {base_cols}, fecha) VALUES (?,?,?,?,?,?,?,?,?)",
                (*base_vals, norm_fecha(payload.fecha)),
            )
        else:
            cur = conn.execute(
                f"INSERT INTO creditos {base_cols}) VALUES (?,?,?,?,?,?,?,?)",
                tuple(base_vals),
            )
        credito_id = cur.lastrowid

        total = 0.0
        for item in payload.items:
            prod = conn.execute(
                "SELECT * FROM productos WHERE id=?", (item.producto_id,)
            ).fetchone()
            if not prod:
                continue
            cantidad = item.cantidad
            # Misma validación que en una venta normal: sin esto se podía fiar
            # más mercancía de la existente y el stock quedaba en 0, perdiendo
            # el rastro de las unidades que nunca hubo.
            if prod["stock_actual"] < cantidad:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Stock insuficiente para '{prod['nombre']}': "
                        f"disponible {prod['stock_actual']}, solicitado {cantidad}"
                    ),
                )
            precio_unitario = (item.precio_unitario if item.precio_unitario is not None
                               else prod["precio_venta"])
            costo_unitario = prod["costo"]
            subtotal = cantidad * precio_unitario
            total += subtotal
            conn.execute(
                """INSERT INTO credito_detalle
                   (credito_id, producto_id, cantidad, costo_unitario, precio_unitario, subtotal)
                   VALUES (?,?,?,?,?,?)""",
                (credito_id, prod["id"], cantidad, costo_unitario, precio_unitario, subtotal),
            )
            nuevo_stock = max(0, prod["stock_actual"] - cantidad)
            conn.execute(
                "UPDATE productos SET stock_actual=? WHERE id=?", (nuevo_stock, prod["id"])
            )

        conn.execute(
            "UPDATE creditos SET total=?, saldo=? WHERE id=?", (total, total, credito_id)
        )
        result = _detalle_credito(conn, credito_id)
    return result


@router.post("/{id}/pago")
def pagar(id: int, payload: PagoCreditoPayload):
    """Cobro de un crédito. Reduce el saldo y registra la entrada de efectivo en caja
    (movimiento_caja) — aquí es cuando el dinero entra al cuadre."""
    with get_conn() as conn:
        credito = conn.execute("SELECT * FROM creditos WHERE id=?", (id,)).fetchone()
        if not credito:
            raise HTTPException(status_code=404, detail="Crédito no encontrado")
        monto = payload.monto
        if monto <= 0:
            raise HTTPException(status_code=400, detail="El monto debe ser mayor que cero")

        caja_row = conn.execute(
            "SELECT id FROM cajas WHERE estado='abierta' LIMIT 1"
        ).fetchone()
        caja_id = payload.caja_id or (caja_row["id"] if caja_row else None)

        if payload.fecha:
            conn.execute(
                """INSERT INTO pagos_credito
                   (credito_id, fecha, monto, metodo_pago, caja_id, cajero_id, cajero_nombre)
                   VALUES (?,?,?,?,?,?,?)""",
                (id, norm_fecha(payload.fecha), monto, payload.metodo_pago, caja_id,
                 payload.cajero_id, payload.cajero_nombre),
            )
        else:
            conn.execute(
                """INSERT INTO pagos_credito
                   (credito_id, monto, metodo_pago, caja_id, cajero_id, cajero_nombre)
                   VALUES (?,?,?,?,?,?)""",
                (id, monto, payload.metodo_pago, caja_id,
                 payload.cajero_id, payload.cajero_nombre),
            )

        nuevo_saldo = max(0.0, credito["saldo"] - monto)
        estado = "pagada" if nuevo_saldo <= 0 else "activa"
        conn.execute(
            "UPDATE creditos SET saldo=?, estado=? WHERE id=?", (nuevo_saldo, estado, id)
        )

        # El cobro entra como efectivo/transferencia a la caja abierta.
        if caja_id and payload.metodo_pago == "efectivo":
            conn.execute(
                """INSERT INTO movimientos_caja
                   (caja_id, tipo_movimiento, concepto, monto, metodo_pago,
                    relacionado_tipo, relacionado_id, es_extraccion, es_compra_mercancia,
                    cajero_id, cajero_nombre)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (caja_id, "ingreso", f"Cobro crédito #{id} ({credito['cliente']})", monto,
                 payload.metodo_pago, "credito", id, 0, 0,
                 payload.cajero_id, payload.cajero_nombre),
            )
        result = _detalle_credito(conn, id)
    return result


@router.delete("/{id}")
def eliminar(id: int):
    """Borra el crédito. Si sigue activo, restaura el stock descontado."""
    with get_conn() as conn:
        credito = conn.execute("SELECT * FROM creditos WHERE id=?", (id,)).fetchone()
        if not credito:
            raise HTTPException(status_code=404, detail="Crédito no encontrado")
        if credito["estado"] == "activa":
            items = conn.execute(
                "SELECT * FROM credito_detalle WHERE credito_id=?", (id,)
            ).fetchall()
            for item in items:
                conn.execute(
                    "UPDATE productos SET stock_actual=stock_actual+? WHERE id=?",
                    (item["cantidad"], item["producto_id"]),
                )
        conn.execute("DELETE FROM creditos WHERE id=?", (id,))
    return {"ok": True}
