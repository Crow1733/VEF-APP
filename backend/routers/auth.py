import hashlib
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_conn

router = APIRouter(prefix="/api/auth", tags=["auth"])


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


class LoginPayload(BaseModel):
    usuario: str
    clave: str


@router.post("/login")
def login(payload: LoginPayload):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, nombre, usuario, rol FROM usuarios "
            "WHERE usuario=? AND clave_hash=? AND activo=1",
            (payload.usuario, sha256(payload.clave)),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    return dict(row)
