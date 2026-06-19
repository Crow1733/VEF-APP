from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, migrate
from seed import run as seed_db
from routers import auth, categorias, productos, usuarios, cajas, ventas, movimientos, compras, consignaciones, reportes, gastos, deudas, cierres, bajas, creditos

app = FastAPI(title="VEF API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(categorias.router)
app.include_router(productos.router)
app.include_router(usuarios.router)
app.include_router(cajas.router)
app.include_router(ventas.router)
app.include_router(movimientos.router)
app.include_router(compras.router)
app.include_router(consignaciones.router)
app.include_router(reportes.router)
app.include_router(gastos.router)
app.include_router(deudas.router)
app.include_router(cierres.router)
app.include_router(bajas.router)
app.include_router(creditos.router)

# Sirve el build de Vite (frontend/dist). El routing del SPA es por hash (#/...),
# así que StaticFiles(html=True) basta: todas las rutas resuelven sobre index.html.
FRONT = Path(__file__).parent.parent / "frontend" / "dist"
app.mount("/", StaticFiles(directory=str(FRONT), html=True), name="front")


@app.on_event("startup")
def startup():
    init_db()
    migrate()
    seed_db()
