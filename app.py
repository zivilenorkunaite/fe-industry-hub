"""FE ANZ Energy Hub — FastAPI Application.

Serves the React SPA (frontend/dist), REST API under /api (auth, tools, use-cases,
stories, admin). Uses Lakebase (PostgreSQL) for persistence.
On startup: ensure schema/tables exist, seed admin user, start token refresh loop.
"""

import os
from pathlib import Path

# Load .env when running locally
if (Path(__file__).parent / ".env").exists():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from server.db import db
from server.seed import ensure_schema_and_tables, seed_admin_user


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: connect to DB, ensure schema/tables, seed admin, start token refresh."""
    print("[APP] Starting FE ANZ Energy Hub...")
    await db.get_pool()

    try:
        await ensure_schema_and_tables()
        await seed_admin_user()
    except Exception as e:
        print(f"[APP] Schema/seed warning: {e}")

    async def refresh_loop():
        while True:
            await asyncio.sleep(45 * 60)
            try:
                await db.refresh_token()
                print("[APP] OAuth token refreshed")
            except Exception as e:
                print(f"[APP] Token refresh failed: {e}")

    asyncio.create_task(refresh_loop())

    yield

    await db.close()
    print("[APP] Shutdown complete")


app = FastAPI(
    title="FE ANZ Energy Hub",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

from server.routes.auth import router as auth_router
from server.routes.tools import router as tools_router
from server.routes.use_cases import router as use_cases_router
from server.routes.stories import router as stories_router
from server.routes.admin import router as admin_router
from server.routes.generate import router as generate_router

app.include_router(auth_router)
app.include_router(tools_router)
app.include_router(use_cases_router)
app.include_router(stories_router)
app.include_router(admin_router)
app.include_router(generate_router)


@app.get("/api/debug/headers")
async def debug_headers(request: Request):
    """Show all request headers — used to identify how user identity is forwarded."""
    return {k: v for k, v in request.headers.items()}


@app.get("/api/health")
async def health():
    info = {
        "status": "healthy",
        "app": "FE ANZ Energy Hub",
        "pghost": os.environ.get("PGHOST", "not set"),
        "pgschema": os.environ.get("PGSCHEMA", "not set"),
    }
    try:
        schema = os.environ.get("PGSCHEMA", "expertise")
        tables = await db.fetch(
            "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = $1 ORDER BY tablename",
            schema,
        )
        info["tables"] = [r["tablename"] for r in tables]
        counts = {}
        for t in ["tools", "use_cases", "customer_stories", "users"]:
            try:
                counts[t] = await db.fetchval(f"SELECT COUNT(*) FROM {t}")
            except Exception:
                counts[t] = 0
        info["counts"] = counts
    except Exception as e:
        info["db_error"] = str(e)
    return info


# Serve React SPA
frontend_dist = Path(__file__).parent / "frontend" / "dist"

if frontend_dist.exists():
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/favicon.ico")
    async def favicon():
        fav = frontend_dist / "favicon.ico"
        if fav.exists():
            return FileResponse(str(fav))
        return JSONResponse(status_code=404, content={})

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"error": "Not found"})
        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(frontend_dist / "index.html"))
else:
    @app.get("/")
    async def root():
        return {
            "message": "FE ANZ Energy Hub API",
            "docs": "/api/docs",
            "health": "/api/health",
            "note": "Frontend not built yet. Run 'npm run build' in frontend/ directory.",
        }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
