"""DocHub – Einstiegspunkt.

Start:  uvicorn app.main:app --reload
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.staticfiles import StaticFiles

from .database import BASE_DIR, init_db
from .routers import applications, me, teams, users
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    seed_if_empty()
    yield


app = FastAPI(
    title="DocHub",
    description="Einstieg und Dokumentation aller Anwendungen im Dokumentenmanagement.",
    version="0.2.0",
    lifespan=lifespan,
    docs_url=None,  # eigene /docs-Route mit lokal abgelegtem Swagger UI (kein CDN)
)


@app.get("/docs", include_in_schema=False)
def swagger_ui():
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=f"{app.title} – Schnittstelle",
        swagger_js_url="/vendor/swagger-ui/swagger-ui-bundle.js",
        swagger_css_url="/vendor/swagger-ui/swagger-ui.css",
        swagger_favicon_url="data:,",
    )

app.include_router(teams.router)
app.include_router(applications.router)
app.include_router(me.router)
app.include_router(users.router)

# Zuletzt einbinden: liefert index.html, app.html, pflege.html und Assets aus
app.mount("/", StaticFiles(directory=BASE_DIR / "static", html=True), name="static")
