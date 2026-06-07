from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_conn

router = APIRouter(prefix="/api/cajas", tags=["cajas"])

CAJAS_FIJAS = [{"id": 1, "nombre": "Caja 1"}, {"id": 2, "nombre": "Caja 2"}, {"id": 3, "nombre": "Caja 3"}]


# ── Cajas config ─────────────────────────────────────────────────────────────

class ConfigPayload(BaseModel):
    categorias_ids: list[int]


@router.get("/config")
def listar_config():
    with get_conn() as conn:
        return _build_config(conn)


@router.put("/config/{caja_id}")
def actualizar_config(caja_id: int, payload: ConfigPayload):
    if caja_id not in (1, 2, 3):
        raise HTTPException(status_code=404, detail="Caja no encontrada")
    with get_conn() as conn:
        conn.execute("DELETE FROM cajas_config WHERE caja_id=?", (caja_id,))
        for cat_id in set(payload.categorias_ids):
            conn.execute(
                "INSERT OR IGNORE INTO cajas_config (caja_id, categoria_id) VALUES (?,?)",
                (caja_id, cat_id),
            )
        return _build_config(conn)


def _build_config(conn) -> list[dict]:
    result = []
    for caja in CAJAS_FIJAS:
        rows = conn.execute(
            """SELECT c.id, c.nombre, c.es_consignacion
               FROM categorias c
               JOIN cajas_config cc ON cc.categoria_id = c.id
               WHERE cc.caja_id=?""",
            (caja["id"],),
        ).fetchall()
        cats = [dict(r) for r in rows]
        result.append({
            **caja,
            "categorias_ids": [c["id"] for c in cats],
            "categorias": cats,
        })
    return result


# ── Cajas operativas ──────────────────────────────────────────────────────────

class AbrirPayload(BaseModel):
    efectivo_inicial: float = 0


class CerrarPayload(BaseModel):
    efectivo_contado: float
    observacion: str = ""


@router.get("")
def listar():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM cajas ORDER BY id DESC").fetchall()
    return [dict(r) for r in rows]


@router.get("/actual")
def actual():
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM cajas WHERE estado='abierta' ORDER BY id DESC LIMIT 1"
        ).fetchone()
    return dict(row) if row else None


@router.post("/abrir")
def abrir(payload: AbrirPayload):
    with get_conn() as conn:
        ya = conn.execute("SELECT * FROM cajas WHERE estado='abierta' LIMIT 1").fetchone()
        if ya:
            return dict(ya)
        cur = conn.execute(
            "INSERT INTO cajas (efectivo_inicial) VALUES (?)", (payload.efectivo_inicial,)
        )
        row = conn.execute("SELECT * FROM cajas WHERE id=?", (cur.lastrowid,)).fetchone()
    return dict(row)


@router.post("/{id}/cerrar")
def cerrar(id: int, payload: CerrarPayload):
    with get_conn() as conn:
        caja = conn.execute("SELECT * FROM cajas WHERE id=?", (id,)).fetchone()
        if not caja:
            raise HTTPException(status_code=404, detail="Caja no encontrada")
        desglose = _desglose(conn, id)
        diferencia = payload.efectivo_contado - desglose["efectivo_esperado"]
        conn.execute(
            """UPDATE cajas SET fecha_cierre=datetime('now'), efectivo_contado=?,
               diferencia=?, estado='cerrada', observacion=? WHERE id=?""",
            (payload.efectivo_contado, diferencia, payload.observacion, id),
        )
        row = conn.execute("SELECT * FROM cajas WHERE id=?", (id,)).fetchone()
    return {"caja": dict(row), "desglose": desglose}


@router.get("/{id}/desglose")
def desglose(id: int):
    with get_conn() as conn:
        result = _desglose(conn, id)
    if not result:
        raise HTTPException(status_code=404, detail="Caja no encontrada")
    return result


def _desglose(conn, caja_id: int) -> dict:
    caja = conn.execute("SELECT * FROM cajas WHERE id=?", (caja_id,)).fetchone()
    if not caja:
        return None
    efectivo_inicial = caja["efectivo_inicial"]
    ventas_efectivo = conn.execute(
        "SELECT COALESCE(SUM(subtotal_efectivo),0) FROM ventas WHERE caja_id=? AND estado!='cancelada'",
        (caja_id,),
    ).fetchone()[0]
    ventas_transferencia = conn.execute(
        "SELECT COALESCE(SUM(subtotal_transferencia),0) FROM ventas WHERE caja_id=? AND estado!='cancelada'",
        (caja_id,),
    ).fetchone()[0]
    extracciones = conn.execute(
        "SELECT COALESCE(SUM(monto),0) FROM movimientos_caja WHERE caja_id=? AND es_extraccion=1",
        (caja_id,),
    ).fetchone()[0]
    compras_mercancia = conn.execute(
        "SELECT COALESCE(SUM(monto),0) FROM movimientos_caja WHERE caja_id=? AND es_compra_mercancia=1",
        (caja_id,),
    ).fetchone()[0]
    pagos_varios = conn.execute(
        "SELECT COALESCE(SUM(monto),0) FROM movimientos_caja "
        "WHERE caja_id=? AND tipo_movimiento='pago' AND es_extraccion=0 AND es_compra_mercancia=0",
        (caja_id,),
    ).fetchone()[0]
    efectivo_esperado = efectivo_inicial + ventas_efectivo - extracciones - compras_mercancia - pagos_varios
    return {
        "caja_id": caja_id,
        "efectivo_inicial": efectivo_inicial,
        "ventas_efectivo": ventas_efectivo,
        "ventas_transferencia": ventas_transferencia,
        "extracciones": extracciones,
        "compras_mercancia": compras_mercancia,
        "pagos_varios": pagos_varios,
        "efectivo_esperado": efectivo_esperado,
    }
