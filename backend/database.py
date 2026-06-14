import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "vef.db"


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


def migrate() -> None:
    with get_conn() as conn:
        for table, col, coltype in _MIGRATIONS:
            cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]
            if col not in cols:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {coltype}")
