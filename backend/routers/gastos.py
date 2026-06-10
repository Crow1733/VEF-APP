from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
from database import get_conn

router = APIRouter(prefix="/api/gastos", tags=["gastos"])

# Tipos de gasto (columnas del CUADRE DE LA SEMANA: salarios, carros/corriente,
# pagos de caja, individual por socio, ONAT/arrendamiento, contador, estimulación).
TIPOS = {
    "salario",
    "transporte",
    "onat",
    "arrendamiento",
    "contador",
    "estimulacion",
    "individual",
    "otro",
}


class GastoPayload(BaseModel):
    tipo: str = "otro"
    concepto: str = ""
    monto: float = 0
    socio: Optional[str] = None
    fecha: Optional[str] = None
    cajero_id: Optional[int] = None
    cajero_nombre: Optional[str] = None


@router.get("")
def listar(desde: Optional[str] = None, hasta: Optional[str] = None, tipo: Optional[str] = None):
    query = "SELECT * FROM gastos WHERE 1=1"
    params: list = []
    if desde:
        query += " AND fecha>=?"
        params.append(desde)
    if hasta:
        query += " AND fecha<=?"
        params.append(hasta)
    if tipo:
        query += " AND tipo=?"
        params.append(tipo)
    query += " ORDER BY fecha DESC, id DESC"
    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


@router.post("")
def crear(payload: GastoPayload):
    tipo = payload.tipo if payload.tipo in TIPOS else "otro"
    with get_conn() as conn:
        if payload.fecha:
            cur = conn.execute(
                """INSERT INTO gastos (fecha, tipo, concepto, monto, socio, cajero_id, cajero_nombre)
                   VALUES (?,?,?,?,?,?,?)""",
                (payload.fecha, tipo, payload.concepto, payload.monto, payload.socio,
                 payload.cajero_id, payload.cajero_nombre),
            )
        else:
            cur = conn.execute(
                """INSERT INTO gastos (tipo, concepto, monto, socio, cajero_id, cajero_nombre)
                   VALUES (?,?,?,?,?,?)""",
                (tipo, payload.concepto, payload.monto, payload.socio,
                 payload.cajero_id, payload.cajero_nombre),
            )
        row = conn.execute("SELECT * FROM gastos WHERE id=?", (cur.lastrowid,)).fetchone()
    return dict(row)


@router.delete("/{id}")
def eliminar(id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM gastos WHERE id=?", (id,))
    return {"ok": True}
