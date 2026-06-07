from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_conn

router = APIRouter(prefix="/api/categorias", tags=["categorias"])


class CategoriaPayload(BaseModel):
    nombre: str
    es_consignacion: bool = False


def row_to_dict(row) -> dict:
    d = dict(row)
    d["tipo"] = "consignacion" if d["es_consignacion"] else "propia"
    return d


@router.get("")
def listar():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM categorias ORDER BY id").fetchall()
    return [row_to_dict(r) for r in rows]


@router.post("")
def crear(payload: CategoriaPayload):
    tipo = "consignacion" if payload.es_consignacion else "propia"
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO categorias (nombre, tipo, es_consignacion) VALUES (?,?,?)",
            (payload.nombre, tipo, 1 if payload.es_consignacion else 0),
        )
        row = conn.execute("SELECT * FROM categorias WHERE id=?", (cur.lastrowid,)).fetchone()
    return row_to_dict(row)


@router.put("/{id}")
def actualizar(id: int, payload: CategoriaPayload):
    tipo = "consignacion" if payload.es_consignacion else "propia"
    with get_conn() as conn:
        conn.execute(
            "UPDATE categorias SET nombre=?, tipo=?, es_consignacion=? WHERE id=?",
            (payload.nombre, tipo, 1 if payload.es_consignacion else 0, id),
        )
        row = conn.execute("SELECT * FROM categorias WHERE id=?", (id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return row_to_dict(row)


@router.delete("/{id}")
def eliminar(id: int):
    with get_conn() as conn:
        en_uso = conn.execute(
            "SELECT 1 FROM productos WHERE categoria_id=? LIMIT 1", (id,)
        ).fetchone()
        if en_uso:
            return {"ok": False, "reason": "en_uso"}
        conn.execute("DELETE FROM categorias WHERE id=?", (id,))
    return {"ok": True}
