import hashlib
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_conn

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


class UsuarioCreate(BaseModel):
    nombre: str
    usuario: str
    clave: str
    rol: str = "cajero"


class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    usuario: Optional[str] = None
    rol: Optional[str] = None
    clave: Optional[str] = None


def safe(row) -> dict:
    d = dict(row)
    d.pop("clave_hash", None)
    return d


@router.get("")
def listar():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM usuarios ORDER BY id").fetchall()
    return [safe(r) for r in rows]


@router.post("")
def crear(payload: UsuarioCreate):
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO usuarios (nombre, usuario, clave_hash, rol) VALUES (?,?,?,?)",
            (payload.nombre, payload.usuario, sha256(payload.clave), payload.rol),
        )
        row = conn.execute("SELECT * FROM usuarios WHERE id=?", (cur.lastrowid,)).fetchone()
    return safe(row)


@router.put("/{id}")
def actualizar(id: int, payload: UsuarioUpdate):
    with get_conn() as conn:
        prev = conn.execute("SELECT * FROM usuarios WHERE id=?", (id,)).fetchone()
        if not prev:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        nombre = payload.nombre or prev["nombre"]
        usuario = payload.usuario or prev["usuario"]
        rol = payload.rol or prev["rol"]
        clave_hash = sha256(payload.clave) if payload.clave else prev["clave_hash"]
        conn.execute(
            "UPDATE usuarios SET nombre=?, usuario=?, rol=?, clave_hash=? WHERE id=?",
            (nombre, usuario, rol, clave_hash, id),
        )
        row = conn.execute("SELECT * FROM usuarios WHERE id=?", (id,)).fetchone()
    return safe(row)


@router.delete("/{id}")
def eliminar(id: int):
    with get_conn() as conn:
        u = conn.execute("SELECT rol FROM usuarios WHERE id=?", (id,)).fetchone()
        if u and u["rol"] == "admin":
            raise HTTPException(status_code=400, detail="No se puede eliminar al admin")
        conn.execute("DELETE FROM usuarios WHERE id=?", (id,))
    return {"ok": True}
