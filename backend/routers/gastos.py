from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_conn, norm_fecha

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
        query += " AND date(fecha)>=date(?)"
        params.append(desde)
    if hasta:
        query += " AND date(fecha)<=date(?)"
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
    if payload.monto <= 0:
        raise HTTPException(status_code=422, detail="El monto del gasto debe ser mayor que cero")
    tipo = payload.tipo if payload.tipo in TIPOS else "otro"
    fecha = norm_fecha(payload.fecha)   # completa la hora si vino solo la fecha
    with get_conn() as conn:
        if fecha:
            cur = conn.execute(
                """INSERT INTO gastos (fecha, tipo, concepto, monto, socio, cajero_id, cajero_nombre)
                   VALUES (?,?,?,?,?,?,?)""",
                (fecha, tipo, payload.concepto, payload.monto, payload.socio,
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
