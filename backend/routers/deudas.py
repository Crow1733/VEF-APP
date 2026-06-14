from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_conn

router = APIRouter(prefix="/api/deudas", tags=["deudas"])


class CuentaPayload(BaseModel):
    proveedor: str = ""
    concepto: str = ""
    monto: float = 0
    fecha: Optional[str] = None
    observacion: str = ""


class PagoPayload(BaseModel):
    monto: float
    metodo_pago: str = "efectivo"
    fecha: Optional[str] = None
    # Detalle opcional por producto (hoja "Pago de Deudas por Semana")
    producto: Optional[str] = None
    cantidad: Optional[float] = None
    precio_costo: Optional[float] = None
    precio_vendido: Optional[float] = None


@router.get("")
def listar(estado: Optional[str] = None):
    query = "SELECT * FROM cuentas_por_pagar WHERE 1=1"
    params: list = []
    if estado:
        query += " AND estado=?"
        params.append(estado)
    # Pendientes primero, luego por fecha desc.
    query += " ORDER BY (estado='pagada'), fecha DESC, id DESC"
    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


@router.post("")
def crear(payload: CuentaPayload):
    with get_conn() as conn:
        if payload.fecha:
            cur = conn.execute(
                """INSERT INTO cuentas_por_pagar (fecha, proveedor, concepto, monto, saldo, observacion)
                   VALUES (?,?,?,?,?,?)""",
                (payload.fecha, payload.proveedor, payload.concepto, payload.monto,
                 payload.monto, payload.observacion),
            )
        else:
            cur = conn.execute(
                """INSERT INTO cuentas_por_pagar (proveedor, concepto, monto, saldo, observacion)
                   VALUES (?,?,?,?,?)""",
                (payload.proveedor, payload.concepto, payload.monto, payload.monto,
                 payload.observacion),
            )
        row = conn.execute("SELECT * FROM cuentas_por_pagar WHERE id=?", (cur.lastrowid,)).fetchone()
    return dict(row)


@router.post("/{id}/pago")
def pagar(id: int, payload: PagoPayload):
    with get_conn() as conn:
        cuenta = conn.execute("SELECT * FROM cuentas_por_pagar WHERE id=?", (id,)).fetchone()
        if not cuenta:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")
        cols = ["cuenta_id", "monto", "metodo_pago",
                "producto", "cantidad", "precio_costo", "precio_vendido"]
        vals = [id, payload.monto, payload.metodo_pago,
                payload.producto, payload.cantidad, payload.precio_costo, payload.precio_vendido]
        if payload.fecha:
            cols.append("fecha")
            vals.append(payload.fecha)
        placeholders = ",".join("?" * len(cols))
        conn.execute(
            f"INSERT INTO pagos_deuda ({','.join(cols)}) VALUES ({placeholders})",
            tuple(vals),
        )
        nuevo_saldo = max(0.0, cuenta["saldo"] - payload.monto)
        estado = "pagada" if nuevo_saldo <= 0 else "pendiente"
        conn.execute(
            "UPDATE cuentas_por_pagar SET saldo=?, estado=? WHERE id=?",
            (nuevo_saldo, estado, id),
        )
        row = conn.execute("SELECT * FROM cuentas_por_pagar WHERE id=?", (id,)).fetchone()
    return dict(row)


@router.get("/{id}/pagos")
def pagos(id: int):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM pagos_deuda WHERE cuenta_id=? ORDER BY fecha DESC, id DESC", (id,)
        ).fetchall()
    return [dict(r) for r in rows]


@router.delete("/{id}")
def eliminar(id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM cuentas_por_pagar WHERE id=?", (id,))
    return {"ok": True}
