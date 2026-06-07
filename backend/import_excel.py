"""
Lee el Excel y carga todos los productos reales en la BD.
Ejecutar una sola vez: python import_excel.py
"""
import sys
from pathlib import Path
import openpyxl
from database import get_conn, init_db

EXCEL_PATH = Path(__file__).parent.parent / "Exel" / "19.1-SEMANA del 11 al 16 de mayo.xlsx"

# ─── Mapeo hoja → (categoría_nombre, tipo, consignador) ──────────────────────
HOJAS = {
    # Propias
    "Aseo":                   ("Aseo",                  "propia",      None),
    "COSITAS ":               ("Cositas",                "propia",      None),
    "TALABARTERIA ":          ("Talabartería",            "propia",      None),
    "COCINA ":                ("Cocina",                 "propia",      None),
    "Madera-Utiles del hogar":("Madera-Útiles del hogar","propia",      None),
    "ARREGLOS FLORALES,BICHOS":("Arreglos y Bisutería",  "propia",      None),
    "Lienzos y espejos":      ("Lienzos y Espejos",      "propia",      None),
    "Ceramica y Reloj":       ("Cerámica y Reloj",       "propia",      None),
    "Electrodomestico Bazar": ("Electrodomésticos Bazar","propia",      None),
    # Consignación
    "CONSIGNACION ":          ("Consignación General",   "consignacion","Varios"),
    "Jesus otros":            ("Jesús Bisutería",        "consignacion","Jesús"),
    "Jesus ropa calzado":     ("Jesús Ropa y Calzado",   "consignacion","Jesús"),
    "Jesus electrodomesticos":("Jesús Electrodomésticos","consignacion","Jesús"),
    "Sucel":                  ("Sucel Cosméticos",       "consignacion","Sucel"),
    "Cusco-Yanley":           ("Cusco-Yanley Joyería",   "consignacion","Cusco/Yanley"),
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def to_num(val):
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def limpia_nombre(val):
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def leer_productos_hoja(ws, consignador):
    """
    Estructura de cada hoja:
      Fila 7 (idx 6): encabezados  → No | Costo | Venta | Gan | Producto | Stock | ...
      Fila 8 (idx 7): sub-título de categoría (ignorar)
      Fila 9+ (idx 8+): productos
    Un producto es válido si:
      - col 0 es número (nro de orden)
      - col 4 tiene nombre
      - col 1 (costo) y col 2 (venta) son números o la fila tiene nombre
    """
    productos = []
    filas = list(ws.iter_rows(values_only=True))

    for row in filas[8:]:          # desde fila 9
        num   = to_num(row[0])
        costo = to_num(row[1])
        venta = to_num(row[2])
        gan   = to_num(row[3])
        nombre = limpia_nombre(row[4])
        stock  = to_num(row[5]) if len(row) > 5 else None

        # Filtro: debe tener número de orden y nombre
        if num is None or not nombre:
            continue
        # Saltar si parece sub-encabezado (nombre muy largo sin precios)
        if costo is None and venta is None and len(nombre) > 40:
            continue

        # Calcular ganancia si no está
        if gan is None and costo is not None and venta is not None:
            gan = venta - costo

        productos.append({
            "nombre":       nombre,
            "costo":        costo or 0,
            "precio_venta": venta or 0,
            "ganancia":     gan or 0,
            "stock":        int(stock) if stock is not None else 0,
            "consignador":  consignador,
        })
    return productos


# ─── Main ─────────────────────────────────────────────────────────────────────

def run():
    init_db()
    wb = openpyxl.load_workbook(str(EXCEL_PATH), data_only=True)

    with get_conn() as conn:
        # Limpiar productos y categorías anteriores (solo las del seed demo)
        conn.execute("DELETE FROM venta_detalle")
        conn.execute("DELETE FROM ventas")
        conn.execute("DELETE FROM movimientos_caja")
        conn.execute("DELETE FROM compra_detalle")
        conn.execute("DELETE FROM compras")
        conn.execute("DELETE FROM consignacion_detalle")
        conn.execute("DELETE FROM consignaciones")
        conn.execute("DELETE FROM cajas_config")
        conn.execute("DELETE FROM cajas")
        conn.execute("DELETE FROM productos")
        conn.execute("DELETE FROM categorias")

        total_categorias = 0
        total_productos   = 0
        cat_map = {}   # nombre → id

        for hoja_nombre, (cat_nombre, tipo, consignador) in HOJAS.items():
            if hoja_nombre not in wb.sheetnames:
                print(f"  [SKIP] {hoja_nombre!r} no existe")
                continue

            ws = wb[hoja_nombre]
            prods = leer_productos_hoja(ws, consignador)
            if not prods:
                print(f"  [SKIP] {hoja_nombre!r} sin productos válidos")
                continue

            # Insertar categoría si no existe
            if cat_nombre not in cat_map:
                es_cons = 1 if tipo == "consignacion" else 0
                cur = conn.execute(
                    "INSERT INTO categorias (nombre, tipo, es_consignacion) VALUES (?,?,?)",
                    (cat_nombre, tipo, es_cons),
                )
                cat_map[cat_nombre] = cur.lastrowid
                total_categorias += 1

            cat_id = cat_map[cat_nombre]
            tipo_prod = "consignacion" if tipo == "consignacion" else "propio"

            for p in prods:
                conn.execute(
                    """INSERT INTO productos
                       (categoria_id, nombre, tipo_producto, consignador,
                        costo, precio_venta, ganancia,
                        stock_inicial, stock_actual, imagen, activa)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                    (cat_id, p["nombre"], tipo_prod, p["consignador"],
                     p["costo"], p["precio_venta"], p["ganancia"],
                     p["stock"], p["stock"],
                     "", 1),
                )
                total_productos += 1

            print(f"  ✓ {hoja_nombre!r} → '{cat_nombre}' ({len(prods)} productos)")

        # Restaurar cajas config (3 cajas fijas con todas las categorías)
        for caja_id in (1, 2, 3):
            for cat_id in cat_map.values():
                conn.execute(
                    "INSERT OR IGNORE INTO cajas_config (caja_id, categoria_id) VALUES (?,?)",
                    (caja_id, cat_id),
                )

        print(f"\n✅ Importación completa: {total_categorias} categorías, {total_productos} productos")


if __name__ == "__main__":
    run()
