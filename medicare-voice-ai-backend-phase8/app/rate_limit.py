"""
Minimal in-process rate limiting — Phase 8.

A single-process, in-memory sliding-window limiter for sensitive,
unauthenticated endpoints (login, register) to blunt brute-force /
credential-stuffing and registration-spam attempts. This is
intentionally simple (no Redis dependency) — good enough for a single
backend instance; if the app is later scaled horizontally, swap the
in-memory store for a shared one (Redis, etc.) without changing the
call sites below.

Keyed on client IP + endpoint name. Not a substitute for a WAF/edge
rate limiter in front of the API, but stops naive automated abuse from
exhausting login attempts directly against this service.
"""

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request, status

_attempts: dict[str, list[float]] = defaultdict(list)
_lock = Lock()


def _client_key(request: Request, bucket: str) -> str:
    client_host = request.client.host if request.client else "unknown"
    # Respect a reverse proxy's forwarded IP if present (e.g. behind nginx/ALB).
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_host = forwarded.split(",")[0].strip()
    return f"{bucket}:{client_host}"


def enforce_rate_limit(request: Request, bucket: str, max_attempts: int, window_seconds: int) -> None:
    """
    Raises 429 if the caller has exceeded `max_attempts` within the
    trailing `window_seconds` for the given `bucket` (e.g. "login").
    Call this once per attempt, including failed ones — callers should
    invoke it before doing the expensive/sensitive work.
    """
    key = _client_key(request, bucket)
    now = time.monotonic()
    cutoff = now - window_seconds

    with _lock:
        recent = [t for t in _attempts[key] if t > cutoff]
        if len(recent) >= max_attempts:
            _attempts[key] = recent
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please try again later.",
            )
        recent.append(now)
        _attempts[key] = recent