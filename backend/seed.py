"""Datos iniciales de la aplicación. Se ejecuta solo si la DB está vacía."""
import hashlib
from database import get_conn


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


CATEGORIAS = [
    (1, "Aseo", "propia", 0),
    (2, "Cocina", "propia", 0),
    (3, "Talabartería", "propia", 0),
    (4, "Electrodomésticos", "propia", 0),
    (5, "Jesús electrodomésticos", "consignacion", 1),
    (6, "Consignación general", "consignacion", 1),
]

PRODUCTOS = [
    (1, 1, "Detergente 1kg",  "AS-001", "propio", None,    800,   1500, 700,  "unidad", 30, 30, ""),
    (2, 1, "Jabón en barra",  "AS-002", "propio", None,    250,    500, 250,  "unidad", 50, 50, ""),
    (3, 2, "Sartén 24cm",     "CO-010", "propio", None,   4200,   7500, 3300, "unidad", 12, 12, ""),
    (4, 2, "Set 6 vasos",     "CO-011", "propio", None,   1800,   3200, 1400, "unidad", 18, 18, ""),
    (5, 3, "Cinturón cuero",  "TA-020", "propio", None,   2200,   4500, 2300, "unidad", 20, 20, ""),
    (6, 4, "Plancha eléctrica","EL-030","propio", None,   6500,  11500, 5000, "unidad",  8,  8, ""),
    (7, 5, "Licuadora Oster", "JE-040", "consignacion", "Jesús", 0, 22000, 0, "unidad", 4, 4, ""),
    (8, 6, "Camiseta talla M","CG-050", "consignacion", "Sucel", 0,  3500, 0, "unidad", 15, 15, ""),
]

USUARIOS = [
    (1, "Administrador", "admin", sha256("admin123"), "admin"),
    (2, "Cajero",        "caja",  sha256("caja123"),  "cajero"),
]

CAJAS_CONFIG = [
    (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6),
    (2, 1), (2, 2), (2, 3), (2, 4),
    (3, 3), (3, 4), (3, 5), (3, 6),
]


def run() -> None:
    with get_conn() as conn:
        if conn.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0] > 0:
            return

        conn.executemany(
            "INSERT INTO categorias (id, nombre, tipo, es_consignacion) VALUES (?,?,?,?)",
            CATEGORIAS,
        )
        conn.executemany(
            """INSERT INTO productos
               (id, categoria_id, nombre, codigo, tipo_producto, consignador,
                costo, precio_venta, ganancia, unidad, stock_inicial, stock_actual, imagen)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            PRODUCTOS,
        )
        conn.executemany(
            "INSERT INTO usuarios (id, nombre, usuario, clave_hash, rol) VALUES (?,?,?,?,?)",
            USUARIOS,
        )
        conn.executemany(
            "INSERT INTO cajas_config (caja_id, categoria_id) VALUES (?,?)",
            CAJAS_CONFIG,
        )


if __name__ == "__main__":
    run()
    print("Seed completado.")
