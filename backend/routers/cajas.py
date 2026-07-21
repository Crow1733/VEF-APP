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
    numero: int
    efectivo_inicial: float = 0
    abierta_por_id: Optional[int] = None
    abierta_por: Optional[str] = None


class CerrarPayload(BaseModel):
    efectivo_contado: float
    observacion: str = ""


AUTO_CIERRE_OBS = "Cierre automático de medianoche"


def _cerrar_vencidas(conn) -> list[dict]:
    """Cierra cualquier caja que siga abierta de un día anterior (hora local del
    PC). Se cuenta como contado = esperado (diferencia 0), porque nadie hizo el
    arqueo físico. Es idempotente: solo afecta a cajas todavía abiertas."""
    rows = conn.execute(
        "SELECT * FROM cajas WHERE estado='abierta' "
        "AND date(fecha_apertura, 'localtime') < date('now', 'localtime')"
    ).fetchall()
    cerradas = []
    for caja in rows:
        esperado = _desglose(conn, caja["id"])["efectivo_esperado"]
        conn.execute(
            "UPDATE cajas SET fecha_cierre=datetime('now'), efectivo_contado=?, "
            "diferencia=0, estado='cerrada', observacion=? WHERE id=?",
            (esperado, AUTO_CIERRE_OBS, caja["id"]),
        )
        cerradas.append({"id": caja["id"], "numero": caja["numero"]})
    return cerradas


@router.get("")
def listar():
    with get_conn() as conn:
        _cerrar_vencidas(conn)
        rows = conn.execute("SELECT * FROM cajas ORDER BY id DESC").fetchall()
        result = []
        for r in rows:
            d = dict(r)
            # Total vendido en la caja (todo lo vendido, no cancelado) para que el
            # admin lo vea junto al arqueo. La diferencia ya guardada es el
            # faltante(<0)/sobrante(>0) del cierre.
            d["venta_total"] = conn.execute(
                "SELECT COALESCE(SUM(total),0) FROM ventas "
                "WHERE caja_id=? AND estado!='cancelada'",
                (d["id"],),
            ).fetchone()[0]
            result.append(d)
    return result


@router.post("/cerrar-vencidas")
def cerrar_vencidas():
    """Disparador explícito del cierre automático de medianoche."""
    with get_conn() as conn:
        cerradas = _cerrar_vencidas(conn)
    return {"cerradas": cerradas}


@router.get("/estado")
def estado():
    """Estado de las 3 registradoras fijas: la sesión abierta (o null) y, además,
    la caja abierta HOY aunque ya esté cerrada, para distinguir abrir vs reabrir."""
    with get_conn() as conn:
        _cerrar_vencidas(conn)
        result = []
        for caja in CAJAS_FIJAS:
            abierta_row = conn.execute(
                "SELECT * FROM cajas WHERE numero=? AND estado='abierta' "
                "ORDER BY id DESC LIMIT 1",
                (caja["id"],),
            ).fetchone()
            hoy_row = conn.execute(
                "SELECT * FROM cajas WHERE numero=? "
                "AND date(fecha_apertura, 'localtime') = date('now', 'localtime') "
                "ORDER BY id DESC LIMIT 1",
                (caja["id"],),
            ).fetchone()
            result.append({
                "numero": caja["id"],
                "nombre": caja["nombre"],
                "abierta": bool(abierta_row),
                "caja": dict(abierta_row) if abierta_row else None,
                "caja_hoy": dict(hoy_row) if hoy_row else None,
            })
    return result


@router.get("/actual")
def actual():
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM cajas WHERE estado='abierta' ORDER BY id DESC LIMIT 1"
        ).fetchone()
    return dict(row) if row else None


@router.post("/abrir")
def abrir(payload: AbrirPayload):
    if payload.numero not in (1, 2, 3):
        raise HTTPException(status_code=404, detail="Caja no encontrada")
    with get_conn() as conn:
        _cerrar_vencidas(conn)
        # Una sola sesión abierta por número de registradora.
        ya = conn.execute(
            "SELECT * FROM cajas WHERE numero=? AND estado='abierta' LIMIT 1",
            (payload.numero,),
        ).fetchone()
        if ya:
            return dict(ya)
        # Una sola apertura por día: si ya se abrió hoy y luego se cerró, no se
        # crea otra sesión; hay que reabrir la misma.
        hoy = conn.execute(
            "SELECT * FROM cajas WHERE numero=? "
            "AND date(fecha_apertura, 'localtime') = date('now', 'localtime') "
            "ORDER BY id DESC LIMIT 1",
            (payload.numero,),
        ).fetchone()
        if hoy:
            raise HTTPException(
                status_code=409,
                detail="Esta caja ya fue abierta hoy. Usa «Reabrir» para continuar el turno.",
            )
        cur = conn.execute(
            "INSERT INTO cajas (numero, efectivo_inicial, abierta_por_id, abierta_por) "
            "VALUES (?,?,?,?)",
            (payload.numero, payload.efectivo_inicial, payload.abierta_por_id, payload.abierta_por),
        )
        row = conn.execute("SELECT * FROM cajas WHERE id=?", (cur.lastrowid,)).fetchone()
    return dict(row)


@router.post("/{id}/reabrir")
def reabrir(id: int):
    """Reabre una caja cerrada del mismo día para continuar el turno, sin perder
    su efectivo inicial, ventas ni movimientos acumulados."""
    with get_conn() as conn:
        caja = conn.execute("SELECT * FROM cajas WHERE id=?", (id,)).fetchone()
        if not caja:
            raise HTTPException(status_code=404, detail="Caja no encontrada")
        if caja["estado"] == "abierta":
            return dict(caja)
        otra = conn.execute(
            "SELECT 1 FROM cajas WHERE numero=? AND estado='abierta' AND id!=? LIMIT 1",
            (caja["numero"], id),
        ).fetchone()
        if otra:
            raise HTTPException(status_code=409, detail="Ya hay una sesión abierta para esta caja.")
        conn.execute(
            "UPDATE cajas SET estado='abierta', fecha_cierre=NULL, efectivo_contado=NULL, "
            "diferencia=NULL WHERE id=?",
            (id,),
        )
        row = conn.execute("SELECT * FROM cajas WHERE id=?", (id,)).fetchone()
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
    # Ingresos en efectivo que no son ventas (p.ej. cobros de crédito/libreta).
    # Entran físicamente al cajón, así que suman al efectivo esperado.
    ingresos = conn.execute(
        "SELECT COALESCE(SUM(monto),0) FROM movimientos_caja "
        "WHERE caja_id=? AND tipo_movimiento='ingreso'",
        (caja_id,),
    ).fetchone()[0]
    efectivo_esperado = (
        efectivo_inicial + ventas_efectivo + ingresos
        - extracciones - compras_mercancia - pagos_varios
    )
    return {
        "caja_id": caja_id,
        "efectivo_inicial": efectivo_inicial,
        "ventas_efectivo": ventas_efectivo,
        "ventas_transferencia": ventas_transferencia,
        "ingresos": ingresos,
        "extracciones": extracciones,
        "compras_mercancia": compras_mercancia,
        "pagos_varios": pagos_varios,
        "efectivo_esperado": efectivo_esperado,
    }
