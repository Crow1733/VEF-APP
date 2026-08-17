import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "vef.db"

# Hora que se asigna a una fecha declarada sin hora (mediodía). Se usa el mediodía
# para que el registro caiga siempre dentro del día elegido en cualquier filtro,
# sin quedar pegado a los bordes 00:00:00 / 23:59:59.
_HORA_POR_DEFECTO = "12:00:00"


def norm_fecha(valor):
    """Normaliza una fecha a "YYYY-MM-DD HH:MM:SS", el formato en que SQLite
    guarda datetime('now').

    Las fechas se comparan como TEXTO, así que un valor corto como "2026-07-25"
    queda FUERA de un rango "2026-07-25 00:00:00".."2026-07-25 23:59:59" (el
    string más corto es menor). Los formularios envían solo la fecha
    (<input type="date">) y el navegador a veces envía ISO con 'T' y 'Z', de ahí
    que haya que unificar antes de guardar.
    """
    if not valor:
        return None
    s = str(valor).strip().replace("T", " ").replace("Z", "")
    if len(s) == 10:                       # "YYYY-MM-DD" → añade la hora
        return f"{s} {_HORA_POR_DEFECTO}"
    s = s[:19]                             # recorta milisegundos
    if len(s) == 16:                       # "YYYY-MM-DD HH:MM" → añade segundos
        return f"{s}:00"
    return s


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db() -> None:
    schema = Path(__file__).parent / "schema.sql"
    with get_conn() as conn:
        conn.executescript(schema.read_text())


# Columnas añadidas después de la creación inicial. Se aplican de forma
# idempotente sobre bases de datos ya existentes (ALTER TABLE ADD COLUMN).
_MIGRATIONS = [
    ("cajas", "numero", "INTEGER"),
    ("cajas", "abierta_por_id", "INTEGER"),
    ("cajas", "abierta_por", "TEXT"),
    ("ventas", "cajero_id", "INTEGER"),
    ("ventas", "cajero_nombre", "TEXT"),
    ("movimientos_caja", "cajero_id", "INTEGER"),
    ("movimientos_caja", "cajero_nombre", "TEXT"),
    ("venta_detalle", "perdida_ganancia", "REAL"),
    ("compras", "cajero_id", "INTEGER"),
    ("compras", "cajero_nombre", "TEXT"),
    # Cierre semanal (snapshot del cuadre)
    ("cierres_semanales", "venta_costo", "REAL"),
    ("cierres_semanales", "utilidad_neta", "REAL"),
    ("cierres_semanales", "dividendos", "REAL"),
    ("cierres_semanales", "por_socio", "REAL"),
    ("cierres_semanales", "socios", "INTEGER"),
    ("cierres_semanales", "reserva_pct", "REAL"),
    ("cierres_semanales", "deudas_pagadas", "REAL"),
    ("cierres_semanales", "faltante_sobrante", "REAL"),
    ("cierres_semanales", "cerrada_en", "TEXT"),
    ("cierres_semanales", "snapshot", "TEXT"),
    # Transferencia por persona/socio (columna "Transferencia jesus" del cuadre)
    ("ventas", "transferencia_socio", "TEXT"),
    # Ganancia por elevación de precios (inverso de perdida_ganancia)
    ("venta_detalle", "ganancia_elevacion", "REAL"),
    # Detalle por producto del pago de deudas (hoja "Pago de Deudas por Semana")
    ("pagos_deuda", "producto", "TEXT"),
    ("pagos_deuda", "cantidad", "REAL"),
    ("pagos_deuda", "precio_costo", "REAL"),
    ("pagos_deuda", "precio_vendido", "REAL"),
]


# Tablas cuya columna `fecha` pudo guardarse sin hora ("YYYY-MM-DD") porque el
# formulario deja elegir la fecha. Esos registros quedaban FUERA de los filtros
# por rango (al comparar como texto, el valor corto es menor que
# "YYYY-MM-DD 00:00:00"), así que no aparecían en el cuadre ni en los reportes.
_TABLAS_CON_FECHA = [
    "gastos", "cuentas_por_pagar", "bajas", "pagos_deuda",
    "creditos", "pagos_credito", "ventas", "compras",
]


def migrate() -> None:
    with get_conn() as conn:
        for table, col, coltype in _MIGRATIONS:
            cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]
            if col not in cols:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {coltype}")

        # Completa la hora en las fechas guardadas sin ella (las deja a mediodía,
        # dentro del día elegido). Es idempotente: solo alcanza a las de 10
        # caracteres, de modo que reejecutarlo no vuelve a modificar nada.
        for table in _TABLAS_CON_FECHA:
            try:
                cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]
                if "fecha" not in cols:
                    continue
                conn.execute(
                    f"UPDATE {table} SET fecha = fecha || ' {_HORA_POR_DEFECTO}' "
                    "WHERE LENGTH(fecha) = 10"
                )
            except sqlite3.Error:
                continue   # tabla ausente en bases antiguas: se ignora
