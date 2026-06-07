from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_conn

router = APIRouter(prefix="/api/movimientos", tags=["movimientos"])


class ExtraccionPayload(BaseModel):
    monto: float
    concepto: str = "Extracción de caja"
    responsable: Optional[str] = None


class PagoPayload(BaseModel):
    monto: float
    concepto: str = "Pago por caja"
    metodo_pago: str = "efectivo"


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
        caja = conn.execute("SELECT id FROM cajas WHERE estado='abierta' LIMIT 1").fetchone()
        if not caja:
            return {"ok": False, "reason": "sin_caja_abierta"}
        cur = conn.execute(
            """INSERT INTO movimientos_caja
               (caja_id, tipo_movimiento, concepto, monto, metodo_pago,
                es_extraccion, es_compra_mercancia, responsable)
               VALUES (?,?,?,?,?,?,?,?)""",
            (caja["id"], "extraccion", payload.concepto, payload.monto,
             "efectivo", 1, 0, payload.responsable),
        )
        row = conn.execute("SELECT * FROM movimientos_caja WHERE id=?", (cur.lastrowid,)).fetchone()
    return {"ok": True, "mov": dict(row)}


@router.post("/pago")
def registrar_pago(payload: PagoPayload):
    with get_conn() as conn:
        caja = conn.execute("SELECT id FROM cajas WHERE estado='abierta' LIMIT 1").fetchone()
        if not caja:
            return {"ok": False, "reason": "sin_caja_abierta"}
        cur = conn.execute(
            """INSERT INTO movimientos_caja
               (caja_id, tipo_movimiento, concepto, monto, metodo_pago,
                es_extraccion, es_compra_mercancia)
               VALUES (?,?,?,?,?,?,?)""",
            (caja["id"], "pago", payload.concepto, payload.monto,
             payload.metodo_pago, 0, 0),
        )
        row = conn.execute("SELECT * FROM movimientos_caja WHERE id=?", (cur.lastrowid,)).fetchone()
    return {"ok": True, "mov": dict(row)}
