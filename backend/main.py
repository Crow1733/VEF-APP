from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from seed import run as seed_db
from routers import auth, categorias, productos, usuarios, cajas, ventas, movimientos, compras, consignaciones, reportes

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

FRONT = Path(__file__).parent.parent / "front"
app.mount("/", StaticFiles(directory=str(FRONT), html=True), name="front")


@app.on_event("startup")
def startup():
    init_db()
    seed_db()
