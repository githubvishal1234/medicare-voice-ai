"""
Centralized logging configuration — Phase 8.

Single place that configures Python logging for the whole backend
process (uvicorn workers included). Called once from app/main.py at
import time, before the FastAPI app is constructed, so every module's
`logging.getLogger(...)` picks up the same format/level.

Kept intentionally simple (stdlib `logging` only, no external
dependency) — this is a hardening pass, not a platform migration.
Swap the handler/formatter here later (e.g. JSON logs for a log
aggregator) without touching any router or service module.
"""

import logging
import sys

from .config import settings

_LOG_FORMAT = (
    "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
)


def configure_logging() -> None:
    level = getattr(logging, settings.log_level.upper(), logging.INFO)

    root = logging.getLogger()
    root.setLevel(level)

    # Avoid duplicate handlers if configure_logging() is called more than
    # once (e.g. re-imported under a test runner or reloader).
    if any(isinstance(h, logging.StreamHandler) for h in root.handlers):
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(_LOG_FORMAT))
    root.addHandler(handler)

    # Uvicorn's own loggers otherwise use their own formatter/handlers;
    # align them so request logs and app logs look consistent.
    for noisy_logger in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logging.getLogger(noisy_logger).handlers = []
        logging.getLogger(noisy_logger).propagate = True

    # SQLAlchemy's engine logger is very verbose at INFO — keep it at
    # WARNING unless someone explicitly asks for DEBUG-level app logs.
    if level > logging.DEBUG:
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)