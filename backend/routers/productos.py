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


def enriquecer(row, conn, extras: Optional[dict] = None) -> dict:
    """Añade los campos derivados de un producto. `extras` permite inyectar los
    agregados ya calculados en bloque (ver `listar`) y evitar una consulta por
    producto; si no se pasa, se calculan para esa fila."""
    d = dict(row)
    cat = conn.execute(
        "SELECT nombre, es_consignacion FROM categorias WHERE id=?", (d["categoria_id"],)
    ).fetchone()
    d["categoria_nombre"] = cat["nombre"] if cat else "Sin categoría"
    d["es_consignacion"] = 1 if d["tipo_producto"] == "consignacion" else 0
    if extras is None:
        d["vendidos"] = conn.execute(
            "SELECT COALESCE(SUM(vd.cantidad),0) FROM venta_detalle vd "
            "JOIN ventas v ON vd.venta_id=v.id "
            "WHERE vd.producto_id=? AND v.estado!='cancelada'",
            (d["id"],),
        ).fetchone()[0]
    else:
        d.update(extras)
    return d


def _corte_semana(conn) -> Optional[str]:
    """Fecha de cierre de la última semana cerrada. Todo lo posterior pertenece a
    la semana en curso, que es el período con el que se miden ventas, entradas y
    bajas para que las cantidades no se acumulen desde el origen del sistema."""
    r = conn.execute("SELECT MAX(fecha_fin) FROM cierres_semanales").fetchone()
    return r[0] if r and r[0] else None


@router.get("")
def listar():
    with get_conn() as conn:
        corte = _corte_semana(conn)
        # Un solo SELECT agregado por concepto (no uno por producto).
        def mapa(sql: str, params=()) -> dict:
            return {r[0]: r[1] for r in conn.execute(sql, params).fetchall()}

        vend_hist = mapa(
            "SELECT vd.producto_id, COALESCE(SUM(vd.cantidad),0) FROM venta_detalle vd "
            "JOIN ventas v ON vd.venta_id=v.id WHERE v.estado!='cancelada' "
            "GROUP BY vd.producto_id"
        )
        if corte:
            cond, par = "AND date(v.fecha)>date(?)", (corte,)
            cond_c, par_c = "AND date(c.fecha)>date(?)", (corte,)
            cond_b, par_b = "AND date(b.fecha)>date(?)", (corte,)
        else:
            cond, par = "", ()
            cond_c, par_c = "", ()
            cond_b, par_b = "", ()
        vend_sem = mapa(
            "SELECT vd.producto_id, COALESCE(SUM(vd.cantidad),0) FROM venta_detalle vd "
            f"JOIN ventas v ON vd.venta_id=v.id WHERE v.estado!='cancelada' {cond} "
            "GROUP BY vd.producto_id", par
        )
        ent_sem = mapa(
            "SELECT cd.producto_id, COALESCE(SUM(cd.cantidad),0) FROM compra_detalle cd "
            f"JOIN compras c ON cd.compra_id=c.id WHERE 1=1 {cond_c} "
            "GROUP BY cd.producto_id", par_c
        )
        baj_sem = mapa(
            f"SELECT b.producto_id, COALESCE(SUM(b.cantidad),0) FROM bajas b WHERE 1=1 {cond_b} "
            "GROUP BY b.producto_id", par_b
        )
        # Ventas a crédito de la semana: también descuentan existencia.
        cred_sem = mapa(
            "SELECT cd.producto_id, COALESCE(SUM(cd.cantidad),0) FROM credito_detalle cd "
            f"JOIN creditos c ON cd.credito_id=c.id WHERE 1=1 {cond_c} "
            "GROUP BY cd.producto_id", par_c
        )
        # Foto de stock del último cierre (referencia informativa). No se usa como
        # existencia inicial porque, si el cierre se ejecutó días después del fin
        # de semana, la foto ya incluye movimientos posteriores y descuadraría.
        snap_sem = mapa(
            """SELECT s.producto_id, s.stock FROM stock_snapshots s
               WHERE s.fecha=? AND s.id=(SELECT MAX(s2.id) FROM stock_snapshots s2
                                         WHERE s2.producto_id=s.producto_id AND s2.fecha=s.fecha)""",
            (corte,),
        ) if corte else {}

        rows = conn.execute("SELECT * FROM productos ORDER BY id").fetchall()
        return [
            enriquecer(r, conn, _semana(r, vend_hist, vend_sem, ent_sem, baj_sem,
                                        cred_sem, snap_sem, corte))
            for r in rows
        ]


def _semana(row, vend_hist, vend_sem, ent_sem, baj_sem, cred_sem, snap_sem, corte) -> dict:
    """Métricas de la semana en curso para un producto. La existencia inicial se
    deduce del stock actual deshaciendo los movimientos de la semana, de forma que
    inicial + entradas − vendidos − bajas − crédito == stock actual siempre."""
    pid = row["id"]
    vendidos_sem = vend_sem.get(pid, 0)
    entradas_sem = ent_sem.get(pid, 0)
    bajas_sem = baj_sem.get(pid, 0)
    credito_sem = cred_sem.get(pid, 0)
    inicial_sem = row["stock_actual"] - entradas_sem + vendidos_sem + bajas_sem + credito_sem
    return {
        "vendidos": vend_hist.get(pid, 0),
        "vendidos_semana": vendidos_sem,
        "entradas_semana": entradas_sem,
        "bajas_semana": bajas_sem,
        "credito_semana": credito_sem,
        "inicial_semana": inicial_sem,
        "snapshot_cierre": snap_sem.get(pid),
        "corte_semana": corte,
    }


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
        producto_id = cur.lastrowid
        # El stock con el que nace el producto se registra como entrada de
        # mercancía, para que figure en el reporte de Bajas/Entradas de la semana.
        # No descuenta efectivo: esa mercancía ya estaba comprada.
        if stock > 0:
            subtotal = stock * payload.costo
            cur_c = conn.execute(
                """INSERT INTO compras (total, metodo_pago, descuenta_fondo, procedencia, observacion)
                   VALUES (?,?,?,?,?)""",
                (subtotal, "efectivo", 0, None, "Alta de producto"),
            )
            conn.execute(
                """INSERT INTO compra_detalle (compra_id, producto_id, cantidad, costo_unitario, subtotal)
                   VALUES (?,?,?,?,?)""",
                (cur_c.lastrowid, producto_id, stock, payload.costo, subtotal),
            )
        row = conn.execute("SELECT * FROM productos WHERE id=?", (producto_id,)).fetchone()
        return enriquecer(row, conn)


@router.put("/{id}")
def actualizar(id: int, payload: ProductoPayload):
    with get_conn() as conn:
        prev = conn.execute("SELECT * FROM productos WHERE id=?", (id,)).fetchone()
        if not prev:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        ganancia = payload.precio_venta - payload.costo
        # El stock (actual e inicial) NO se modifica al editar un producto: solo
        # cambia mediante ventas, entradas (compras) y bajas. Así una edición nunca
        # pisa el stock real que las ventas ya fueron descontando.
        conn.execute(
            """UPDATE productos SET categoria_id=?, nombre=?, codigo=?, tipo_producto=?,
               consignador=?, costo=?, precio_venta=?, ganancia=?, unidad=?,
               imagen=?, activa=? WHERE id=?""",
            (payload.categoria_id, payload.nombre, payload.codigo,
             payload.tipo_producto, payload.consignador,
             payload.costo, payload.precio_venta, ganancia,
             payload.unidad, payload.imagen, payload.activa, id),
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
