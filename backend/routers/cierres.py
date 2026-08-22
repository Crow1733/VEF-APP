import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_conn
from routers.reportes import compute_cuadre

router = APIRouter(prefix="/api/cierres", tags=["cierres"])


class CierrePayload(BaseModel):
    desde: str
    hasta: str
    socios: int = 2
    reserva_pct: float = 20.0
    perdida_ganancia: float = 0.0
    observacion: str = ""


@router.get("")
def listar():
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT id, fecha_inicio, fecha_fin, venta_total, utilidad_total,
                      utilidad_neta, dividendos, por_socio, socios, reserva_pct,
                      cerrada_en, observacion
               FROM cierres_semanales ORDER BY fecha_fin DESC, id DESC"""
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/resumen")
def resumen():
    """Comparación multi-semana (Hoja1): una fila por semana cerrada + la unión
    (totales). Lee cada métrica del snapshot del cuadre."""
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM cierres_semanales ORDER BY fecha_inicio").fetchall()

    keys = ["venta_total", "venta_costo", "utilidad_bruta", "perdida_ganancia",
            "gastos_operativos", "onat_arrend", "contador", "estimulacion",
            "utilidad_neta", "reserva", "dividendos", "por_socio"]
    semanas = []
    total = {k: 0.0 for k in keys}
    for r in rows:
        d = dict(r)
        snap = {}
        if d.get("snapshot"):
            try:
                snap = json.loads(d["snapshot"])
            except (TypeError, ValueError):
                snap = {}
        g = snap.get("gastos", {}) or {}
        s = {
            "id": d["id"],
            "fecha_inicio": d["fecha_inicio"],
            "fecha_fin": d["fecha_fin"],
            "venta_total": snap.get("venta_total", d.get("venta_total") or 0),
            "venta_costo": snap.get("venta_costo", d.get("venta_costo") or 0),
            "utilidad_bruta": snap.get("utilidad_bruta", d.get("utilidad_total") or 0),
            "perdida_ganancia": snap.get("perdida_ganancia", 0),
            "gastos_operativos": g.get("operativos", 0),
            "onat_arrend": g.get("onat", 0) + g.get("arrendamiento", 0),
            "contador": g.get("contador", 0),
            "estimulacion": g.get("estimulacion", 0),
            "utilidad_neta": snap.get("utilidad_neta", d.get("utilidad_neta") or 0),
            "reserva": snap.get("reserva", 0),
            "dividendos": snap.get("dividendos", d.get("dividendos") or 0),
            "por_socio": snap.get("por_socio", d.get("por_socio") or 0),
            "socios": snap.get("socios", d.get("socios") or 0),
        }
        semanas.append(s)
        for k in keys:
            total[k] += s.get(k, 0) or 0
    return {"semanas": semanas, "total": total}


@router.get("/{id}")
def obtener(id: int):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM cierres_semanales WHERE id=?", (id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Cierre no encontrado")
    d = dict(row)
    if d.get("snapshot"):
        try:
            d["cuadre"] = json.loads(d["snapshot"])
        except (TypeError, ValueError):
            d["cuadre"] = None
    return d


@router.post("")
def cerrar(payload: CierrePayload):
    """Congela el cuadre del rango en cierres_semanales (snapshot)."""
    c = compute_cuadre(payload.desde, payload.hasta, payload.socios,
                       payload.reserva_pct, payload.perdida_ganancia)
    with get_conn() as conn:
        # Un mismo período no puede cerrarse dos veces: duplicaba el snapshot de
        # stock y dejaba el "inicial" de la semana siguiente indeterminado.
        ya = conn.execute(
            "SELECT id FROM cierres_semanales WHERE fecha_inicio=? AND fecha_fin=?",
            (payload.desde, payload.hasta),
        ).fetchone()
        if ya:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Esta semana ya fue cerrada (cierre #{ya['id']}). "
                    "Elimina ese cierre si necesitas volver a cerrarla."
                ),
            )
        cur = conn.execute(
            """INSERT INTO cierres_semanales
               (fecha_inicio, fecha_fin, venta_total, transferencia_total, efectivo_total,
                extracciones_total, compras_total, consignacion_total, utilidad_total,
                venta_costo, utilidad_neta, dividendos, por_socio, socios, reserva_pct,
                deudas_pagadas, faltante_sobrante, observacion,
                cerrada_en, snapshot)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),?)""",
            (payload.desde, payload.hasta, c["venta_total"], c["transferencia"], c["efectivo"],
             c["movimientos"]["extracciones"], c["movimientos"]["compras_mercancia"],
             c["consignadores_a_pagar"], c["utilidad_bruta"],
             c["venta_costo"], c["utilidad_neta"], c["dividendos"], c["por_socio"],
             c["socios"], c["reserva_pct"], c["movimientos"]["deudas_pagadas"],
             c["faltante_sobrante"], payload.observacion, json.dumps(c)),
        )
        # Foto del stock al cierre: sirve como "stock inicial" de la semana siguiente
        # (el export lee el último snapshot con fecha <= desde para la columna F).
        # Además se lleva stock_inicial a lo que quedó, de modo que la semana nueva
        # arranque desde ahí y las cantidades no se acumulen desde el origen.
        for pr in conn.execute("SELECT id, stock_actual FROM productos").fetchall():
            conn.execute(
                "INSERT INTO stock_snapshots (fecha, producto_id, stock) VALUES (?,?,?)",
                (payload.hasta, pr["id"], pr["stock_actual"]),
            )
        conn.execute("UPDATE productos SET stock_inicial = stock_actual")
        row = conn.execute("SELECT * FROM cierres_semanales WHERE id=?", (cur.lastrowid,)).fetchone()
    d = dict(row)
    d["cuadre"] = c
    return d


@router.delete("/{id}")
def eliminar(id: int):
    """Borra el cierre y la foto de stock que generó. Sin esto último el snapshot
    quedaba huérfano y, al volver a cerrar la semana, dos fotos distintas de la
    misma fecha dejaban indeterminado el stock inicial de la semana siguiente."""
    with get_conn() as conn:
        cierre = conn.execute(
            "SELECT fecha_fin FROM cierres_semanales WHERE id=?", (id,)
        ).fetchone()
        if not cierre:
            raise HTTPException(status_code=404, detail="Cierre no encontrado")
        conn.execute("DELETE FROM cierres_semanales WHERE id=?", (id,))
        # Solo se borra la foto si ningún otro cierre comparte esa fecha de fin.
        otro = conn.execute(
            "SELECT 1 FROM cierres_semanales WHERE fecha_fin=? LIMIT 1", (cierre["fecha_fin"],)
        ).fetchone()
        if not otro:
            conn.execute("DELETE FROM stock_snapshots WHERE fecha=?", (cierre["fecha_fin"],))
    return {"ok": True}
