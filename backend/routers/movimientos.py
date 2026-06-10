from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_conn

router = APIRouter(prefix="/api/movimientos", tags=["movimientos"])


class ExtraccionPayload(BaseModel):
    monto: float
    concepto: str = "Extracción de caja"
    responsable: Optional[str] = None
    caja_id: Optional[int] = None
    cajero_id: Optional[int] = None
    cajero_nombre: Optional[str] = None


class PagoPayload(BaseModel):
    monto: float
    concepto: str = "Pago por caja"
    metodo_pago: str = "efectivo"
    caja_id: Optional[int] = None
    cajero_id: Optional[int] = None
    cajero_nombre: Optional[str] = None


def _resolve_caja_abierta(conn, caja_id: Optional[int]) -> Optional[int]:
    """Devuelve el id de la caja abierta indicada, o la primera abierta."""
    if caja_id is not None:
        row = conn.execute(
            "SELECT id FROM cajas WHERE id=? AND estado='abierta'", (caja_id,)
        ).fetchone()
        if row:
            return row["id"]
    row = conn.execute("SELECT id FROM cajas WHERE estado='abierta' LIMIT 1").fetchone()
    return row["id"] if row else None


@router.get("")
def listar(caja_id: Optional[int] = None):
    with get_conn() as conn:
        query = "SELECT * FROM movimientos_caja WHERE 1=1"
        params = []
        if caja_id is not None:
            query += " AND caja_id=?"
            params.append(caja_id)
        query += " ORDER BY fecha DESC"
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


@router.post("/extraccion")
def registrar_extraccion(payload: ExtraccionPayload):
    with get_conn() as conn:
        caja_id = _resolve_caja_abierta(conn, payload.caja_id)
        if not caja_id:
            return {"ok": False, "reason": "sin_caja_abierta"}
        cur = conn.execute(
            """INSERT INTO movimientos_caja
               (caja_id, tipo_movimiento, concepto, monto, metodo_pago,
                es_extraccion, es_compra_mercancia, responsable,
                cajero_id, cajero_nombre)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (caja_id, "extraccion", payload.concepto, payload.monto,
             "efectivo", 1, 0, payload.responsable,
             payload.cajero_id, payload.cajero_nombre),
        )
        row = conn.execute("SELECT * FROM movimientos_caja WHERE id=?", (cur.lastrowid,)).fetchone()
    return {"ok": True, "mov": dict(row)}


@router.post("/pago")
def registrar_pago(payload: PagoPayload):
    with get_conn() as conn:
        caja_id = _resolve_caja_abierta(conn, payload.caja_id)
        if not caja_id:
            return {"ok": False, "reason": "sin_caja_abierta"}
        cur = conn.execute(
            """INSERT INTO movimientos_caja
               (caja_id, tipo_movimiento, concepto, monto, metodo_pago,
                es_extraccion, es_compra_mercancia, cajero_id, cajero_nombre)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (caja_id, "pago", payload.concepto, payload.monto,
             payload.metodo_pago, 0, 0, payload.cajero_id, payload.cajero_nombre),
        )
        row = conn.execute("SELECT * FROM movimientos_caja WHERE id=?", (cur.lastrowid,)).fetchone()
    return {"ok": True, "mov": dict(row)}
