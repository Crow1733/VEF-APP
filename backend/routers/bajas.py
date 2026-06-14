from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_conn

router = APIRouter(prefix="/api/bajas", tags=["bajas"])

# Razones válidas de baja/merma. Cualquier otro valor cae en "otro".
RAZONES = {"merma", "rotura", "vencimiento", "robo", "otro"}


class BajaPayload(BaseModel):
    producto_id: int
    cantidad: float = 0
    razon: str = "merma"
    observacion: str = ""
    fecha: Optional[str] = None
    caja_id: Optional[int] = None
    cajero_id: Optional[int] = None
    cajero_nombre: Optional[str] = None


@router.get("")
def listar(desde: Optional[str] = None, hasta: Optional[str] = None,
           producto_id: Optional[int] = None, categoria_id: Optional[int] = None):
    query = (
        "SELECT b.*, p.nombre AS producto_nombre, p.categoria_id, "
        "c.nombre AS categoria_nombre "
        "FROM bajas b "
        "JOIN productos p ON b.producto_id=p.id "
        "JOIN categorias c ON p.categoria_id=c.id WHERE 1=1"
    )
    params: list = []
    if desde:
        query += " AND b.fecha>=?"
        params.append(desde)
    if hasta:
        query += " AND b.fecha<=?"
        params.append(hasta)
    if producto_id is not None:
        query += " AND b.producto_id=?"
        params.append(producto_id)
    if categoria_id is not None:
        query += " AND p.categoria_id=?"
        params.append(categoria_id)
    query += " ORDER BY b.fecha DESC, b.id DESC"
    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


@router.post("")
def registrar(payload: BajaPayload):
    razon = payload.razon if payload.razon in RAZONES else "otro"
    with get_conn() as conn:
        prod = conn.execute(
            "SELECT * FROM productos WHERE id=?", (payload.producto_id,)
        ).fetchone()
        if not prod:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        cantidad = payload.cantidad
        if cantidad <= 0:
            raise HTTPException(status_code=400, detail="La cantidad debe ser mayor que cero")
        costo_unitario = prod["costo"]
        if payload.fecha:
            cur = conn.execute(
                """INSERT INTO bajas
                   (fecha, producto_id, cantidad, costo_unitario, razon, observacion,
                    caja_id, cajero_id, cajero_nombre)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (payload.fecha, prod["id"], cantidad, costo_unitario, razon,
                 payload.observacion, payload.caja_id, payload.cajero_id, payload.cajero_nombre),
            )
        else:
            cur = conn.execute(
                """INSERT INTO bajas
                   (producto_id, cantidad, costo_unitario, razon, observacion,
                    caja_id, cajero_id, cajero_nombre)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (prod["id"], cantidad, costo_unitario, razon, payload.observacion,
                 payload.caja_id, payload.cajero_id, payload.cajero_nombre),
            )
        nuevo_stock = max(0, prod["stock_actual"] - cantidad)
        conn.execute(
            "UPDATE productos SET stock_actual=? WHERE id=?", (nuevo_stock, prod["id"])
        )
        row = conn.execute("SELECT * FROM bajas WHERE id=?", (cur.lastrowid,)).fetchone()
    return dict(row)


@router.delete("/{id}")
def eliminar(id: int):
    """Borra la baja y restaura el stock descontado (espejo de ventas.cancelar)."""
    with get_conn() as conn:
        baja = conn.execute("SELECT * FROM bajas WHERE id=?", (id,)).fetchone()
        if not baja:
            raise HTTPException(status_code=404, detail="Baja no encontrada")
        conn.execute(
            "UPDATE productos SET stock_actual=stock_actual+? WHERE id=?",
            (baja["cantidad"], baja["producto_id"]),
        )
        conn.execute("DELETE FROM bajas WHERE id=?", (id,))
    return {"ok": True}
