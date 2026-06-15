from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_conn

router = APIRouter(prefix="/api/productos", tags=["productos"])


class ProductoPayload(BaseModel):
    categoria_id: int
    nombre: str
    codigo: Optional[str] = None
    tipo_producto: str = "propio"
    consignador: Optional[str] = None
    costo: float = 0
    precio_venta: float = 0
    unidad: str = "unidad"
    stock_inicial: float = 0
    stock_actual: Optional[float] = None
    imagen: str = ""
    activa: int = 1


class AjusteStockPayload(BaseModel):
    stock_actual: float


def enriquecer(row, conn) -> dict:
    d = dict(row)
    cat = conn.execute(
        "SELECT nombre, es_consignacion FROM categorias WHERE id=?", (d["categoria_id"],)
    ).fetchone()
    d["categoria_nombre"] = cat["nombre"] if cat else "Sin categoría"
    d["es_consignacion"] = 1 if d["tipo_producto"] == "consignacion" else 0
    vendidos = conn.execute(
        "SELECT COALESCE(SUM(vd.cantidad),0) FROM venta_detalle vd "
        "JOIN ventas v ON vd.venta_id=v.id "
        "WHERE vd.producto_id=? AND v.estado!='cancelada'",
        (d["id"],),
    ).fetchone()[0]
    d["vendidos"] = vendidos
    return d


@router.get("")
def listar():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM productos ORDER BY id").fetchall()
        return [enriquecer(r, conn) for r in rows]


@router.post("")
def crear(payload: ProductoPayload):
    if not payload.nombre.strip():
        raise HTTPException(status_code=422, detail="El nombre del producto no puede estar vacío")
    if payload.precio_venta < 0:
        raise HTTPException(status_code=422, detail="El precio de venta no puede ser negativo")
    if payload.costo < 0:
        raise HTTPException(status_code=422, detail="El costo no puede ser negativo")
    ganancia = payload.precio_venta - payload.costo
    stock = payload.stock_inicial
    with get_conn() as conn:
        cat = conn.execute("SELECT id FROM categorias WHERE id=?", (payload.categoria_id,)).fetchone()
        if not cat:
            raise HTTPException(status_code=422, detail=f"Categoría id={payload.categoria_id} no existe")
        cur = conn.execute(
            """INSERT INTO productos
               (categoria_id, nombre, codigo, tipo_producto, consignador,
                costo, precio_venta, ganancia, unidad, stock_inicial, stock_actual, imagen)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (payload.categoria_id, payload.nombre, payload.codigo,
             payload.tipo_producto, payload.consignador,
             payload.costo, payload.precio_venta, ganancia,
             payload.unidad, stock, stock, payload.imagen),
        )
        row = conn.execute("SELECT * FROM productos WHERE id=?", (cur.lastrowid,)).fetchone()
        return enriquecer(row, conn)


@router.put("/{id}")
def actualizar(id: int, payload: ProductoPayload):
    with get_conn() as conn:
        prev = conn.execute("SELECT * FROM productos WHERE id=?", (id,)).fetchone()
        if not prev:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        ganancia = payload.precio_venta - payload.costo
        stock_actual = payload.stock_actual if payload.stock_actual is not None else payload.stock_inicial
        conn.execute(
            """UPDATE productos SET categoria_id=?, nombre=?, codigo=?, tipo_producto=?,
               consignador=?, costo=?, precio_venta=?, ganancia=?, unidad=?,
               stock_inicial=?, stock_actual=?, imagen=?, activa=? WHERE id=?""",
            (payload.categoria_id, payload.nombre, payload.codigo,
             payload.tipo_producto, payload.consignador,
             payload.costo, payload.precio_venta, ganancia,
             payload.unidad, payload.stock_inicial, stock_actual,
             payload.imagen, payload.activa, id),
        )
        row = conn.execute("SELECT * FROM productos WHERE id=?", (id,)).fetchone()
        return enriquecer(row, conn)


@router.delete("/{id}")
def eliminar(id: int):
    with get_conn() as conn:
        row = conn.execute("SELECT id FROM productos WHERE id=?", (id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        conn.execute("DELETE FROM productos WHERE id=?", (id,))
    return {"ok": True}


@router.patch("/{id}/stock")
def ajustar_stock(id: int, payload: AjusteStockPayload):
    with get_conn() as conn:
        conn.execute("UPDATE productos SET stock_actual=? WHERE id=?", (payload.stock_actual, id))
        row = conn.execute("SELECT * FROM productos WHERE id=?", (id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        return enriquecer(row, conn)
