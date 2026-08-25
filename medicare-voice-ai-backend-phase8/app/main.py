import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from . import models
from .config import settings
from .database import Base, SessionLocal, engine, sync_missing_columns
from .exceptions import register_exception_handlers
from .logging_config import configure_logging
from .middleware import RequestContextMiddleware, SecurityHeadersMiddleware
from .realtime import manager as realtime_manager
from .routers import (
    admin,
    admin_plans,
    admin_usage,
    agent_settings,
    appointments,
    auth,
    billing,
    calls,
    dashboard,
    doctors,
    ehr,
    knowledge_base,
    patients,
    security_compliance,
    support,
    ws,
)

configure_logging()
logger = logging.getLogger("startup")

if settings.is_production and settings.uses_default_secret_key:
    # Fail fast rather than silently signing JWTs with a publicly-known
    # key in production. Local/dev deployments (environment=development,
    # the default) are unaffected.
    raise RuntimeError(
        "SECRET_KEY is still the default placeholder value. Set a real, "
        "random SECRET_KEY in the environment before running with "
        "ENVIRONMENT=production."
    )
if settings.uses_default_secret_key and not settings.is_production:
    logger.warning(
        "SECRET_KEY is using the default placeholder value — fine for local "
        "development, but set a real random SECRET_KEY before deploying."
    )

Base.metadata.create_all(bind=engine)
sync_missing_columns()

app = FastAPI(
    title="Medicare Voice AI API",
    version="1.0.0",
    # In production, don't expose interactive API docs / schema publicly
    # by default. Dev/local behavior (docs enabled) is unchanged.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

# Order matters: outermost-added middleware runs first on the way in /
# last on the way out. Security headers + request logging should wrap
# everything, including CORS handling and error responses.
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1024)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
    expose_headers=["X-Request-ID"],
)

register_exception_handlers(app)

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(patients.router)
app.include_router(doctors.router)
app.include_router(calls.router)
app.include_router(appointments.router)
app.include_router(knowledge_base.router)
app.include_router(agent_settings.router)
app.include_router(ehr.router)
app.include_router(security_compliance.router)
app.include_router(billing.router)
app.include_router(support.router)
app.include_router(ws.router)
app.include_router(admin.router)
app.include_router(admin_plans.router)
app.include_router(admin_usage.router)


@app.on_event("startup")
async def _bind_realtime_loop():
    # Lets synchronous request handlers (the whole rest of this app) push
    # WebSocket events without becoming async themselves. See app/realtime.py.
    realtime_manager.bind_loop(asyncio.get_running_loop())
    logger.info(f"Medicare Voice AI API started (environment={settings.environment})")


@app.on_event("startup")
def _fix_stale_demo_live_calls():
    # One-time, idempotent data correction: earlier versions of app/seed.py
    # inserted demo CallLog rows without an explicit `status`, so they
    # defaulted to "in_progress" with no `ended_at` and never leave the
    # Dashboard's "Live Active Calls" list. This does not touch real call
    # history, LiveKit/SIP, or the call APIs — it only corrects the known
    # demo rows if they're still sitting in the database from a previous
    # seed run. Safe to run on every boot; it's a no-op once corrected.
    from .seed import _reconcile_stale_demo_calls

    db = SessionLocal()
    try:
        org = db.query(models.Organization).filter(models.Organization.name == "HealthLink Clinic").first()
        _reconcile_stale_demo_calls(db, org)
    except Exception:
        logger.exception("Failed to reconcile stale demo call records")
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}