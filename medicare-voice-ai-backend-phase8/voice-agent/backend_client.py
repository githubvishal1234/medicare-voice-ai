"""
Backend API client for the Medicare Voice AI FastAPI backend.

Architectural note:
The voice agent has NO business logic of its own. Every action that
touches patient data, doctor schedules, or appointments must go through
this client to the backend. Do not add local business rules here (no
slot math, no validation, no "is this patient real" heuristics) — this
module's only job is talking to the backend over HTTP and handing back
structured data for the LLM tool layer in agent.py to use.

Auth: requests are authenticated with a per-org service API key
(BACKEND_API_KEY), sent as the `X-API-Key` header. Generate one from
the dashboard: EHR Integration -> API Keys -> Create API Key.
"""

import asyncio
import logging
from typing import Any, Optional

import httpx

import config

logger = logging.getLogger("backend-client")

_client: Optional[httpx.AsyncClient] = None


class BackendAPIError(Exception):
    """Raised when the backend returns an error or is unreachable."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


def _get_client() -> httpx.AsyncClient:
    """Lazily create a single shared AsyncClient for the worker process."""
    global _client
    if _client is None:
        if not config.BACKEND_API_KEY:
            logger.warning(
                "BACKEND_API_KEY is not set — backend API calls will fail. "
                "Generate a key from the dashboard (EHR Integration -> API Keys) "
                "and set it in .env."
            )
        _client = httpx.AsyncClient(
            base_url=config.BACKEND_API_URL,
            headers={"X-API-Key": config.BACKEND_API_KEY or ""},
            timeout=config.BACKEND_API_TIMEOUT_SECONDS,
        )
    return _client


async def aclose() -> None:
    """Close the shared client. Call this on worker shutdown."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def _request(method: str, path: str, **kwargs) -> Any:
    """
    Centralized request/error handling so every backend call behaves the
    same way: raises BackendAPIError (with the backend's own detail message
    and status code preserved) on failure, otherwise returns parsed JSON.

    Phase 8: transient failures (connection errors, timeouts, 5xx) are
    retried a bounded number of times with backoff before giving up — a
    single blip on the backend shouldn't force the agent to apologize
    and transfer a live caller. A 4xx is never retried (the request
    itself is wrong). Any exception not already anticipated (e.g. a
    malformed JSON body) is also normalized into BackendAPIError so
    every call site in agent.py can keep catching just that one type.
    """
    client = _get_client()
    attempts = config.BACKEND_API_MAX_RETRIES + 1
    last_exc: Optional[BackendAPIError] = None

    for attempt in range(1, attempts + 1):
        try:
            resp = await client.request(method, path, **kwargs)
            resp.raise_for_status()
            return resp.json() if resp.content else None
        except httpx.HTTPStatusError as e:
            detail = e.response.text
            try:
                detail = e.response.json().get("detail", detail)
            except Exception:
                pass
            if e.response.status_code < 500:
                logger.error(f"Backend {method} {path} -> {e.response.status_code}: {detail}")
                raise BackendAPIError(str(detail), status_code=e.response.status_code) from e
            logger.warning(
                f"Backend {method} {path} attempt {attempt}/{attempts} -> "
                f"{e.response.status_code}: {detail}"
            )
            last_exc = BackendAPIError(str(detail), status_code=e.response.status_code)
        except httpx.RequestError as e:
            logger.warning(f"Backend {method} {path} attempt {attempt}/{attempts} unreachable: {e}")
            last_exc = BackendAPIError("Backend is unreachable")
        except Exception as e:  # noqa: BLE001 - deliberately broad, see docstring
            logger.error(f"Unexpected error calling backend {method} {path}: {e}")
            raise BackendAPIError("Unexpected error communicating with the backend") from e

        if attempt < attempts:
            await asyncio.sleep(config.BACKEND_API_RETRY_BACKOFF_SECONDS * (2 ** (attempt - 1)))

    raise last_exc or BackendAPIError("Backend is unreachable")


# ---------- Patients ----------

async def search_patients(query: str) -> list[dict[str, Any]]:
    """Look up patients by name, MRN, or phone number."""
    return await _request("GET", "/patients", params={"search": query})


async def get_patient(patient_id: str) -> dict[str, Any]:
    """Fetch full patient detail (vitals, prescriptions, appointments) by id."""
    return await _request("GET", f"/patients/{patient_id}")


async def register_patient(
    name: str, phone: Optional[str] = None, dob: Optional[str] = None, email: Optional[str] = None
) -> dict[str, Any]:
    """
    Registers a new patient. MRN is auto-generated by the backend.
    Returns the created patient record (includes id and mrn). `email` is
    optional — only set if the caller volunteers one; used to send an
    email confirmation once an appointment is booked.
    """
    payload = {"name": name, "phone": phone, "dob": dob, "email": email}
    return await _request("POST", "/patients", json={k: v for k, v in payload.items() if v is not None})


# ---------- Doctors & Scheduling ----------

async def list_doctors() -> list[dict[str, Any]]:
    """Lists active doctors available for booking."""
    return await _request("GET", "/doctors")


async def get_availability(doctor_id: str, date: str) -> dict[str, Any]:
    """
    Gets open slots for a doctor on a given date (YYYY-MM-DD).
    All schedule math (working hours, existing bookings) happens server-side.
    """
    return await _request("GET", "/appointments/availability", params={"doctor_id": doctor_id, "date": date})


async def book_appointment(
    patient_id: str, doctor_id: str, start_at: str, reason: Optional[str] = None
) -> dict[str, Any]:
    """
    Books an appointment. start_at must be an ISO-8601 datetime string,
    ideally one returned by get_availability. The backend re-validates the
    slot is still free (and everything else) before committing.
    """
    payload = {"patient_id": patient_id, "doctor_id": doctor_id, "start_at": start_at, "reason": reason}
    return await _request("POST", "/appointments/book", json={k: v for k, v in payload.items() if v is not None})


async def list_patient_appointments(patient_id: str) -> list[dict[str, Any]]:
    """
    Lists a patient's upcoming, non-cancelled appointments. Use this to
    find the appointment a caller is referring to before rescheduling or
    cancelling it.
    """
    return await _request("GET", f"/appointments/patient/{patient_id}")


async def reschedule_appointment(
    appointment_id: str, start_at: str, doctor_id: Optional[str] = None
) -> dict[str, Any]:
    """
    Moves an existing appointment to a new slot, ideally one returned by
    get_availability. Omit doctor_id to keep the same doctor. The backend
    re-validates the new slot is still free before committing.
    """
    payload = {"start_at": start_at, "doctor_id": doctor_id}
    return await _request(
        "POST",
        f"/appointments/{appointment_id}/reschedule",
        json={k: v for k, v in payload.items() if v is not None},
    )


async def cancel_appointment(appointment_id: str) -> dict[str, Any]:
    """Cancels an appointment."""
    return await _request("POST", f"/appointments/{appointment_id}/cancel")


# ---------- EHR (clinical history, sync status) ----------
#
# All EHR/business logic (which provider, whether it's configured, what
# "synced" means) lives in the backend's app/ehr_service.py. The agent
# never talks to an EHR directly and never has to know which vendor (if
# any) is connected — it just asks the backend for a patient's history.

async def get_ehr_status() -> dict[str, Any]:
    """Checks whether an EHR integration is connected/configured for this org."""
    return await _request("GET", "/ehr/status")


async def get_patient_history(patient_id: str) -> dict[str, Any]:
    """
    Fetches a patient's clinical history — prescriptions, past visits,
    and appointments — from the backend's system of record (mirrored to
    the EHR when one is connected). Use this instead of ever guessing or
    inventing medical history. Works even when no EHR is connected; the
    response's `ehr_source` field tells you whether it is.
    """
    return await _request("GET", f"/ehr/patients/{patient_id}/history")


# ---------- Knowledge base (clinic info, services, FAQs) ----------

async def get_clinic_info() -> dict[str, Any]:
    """
    Fetches structured clinic facts: timings, address, phone, email,
    website, insurance summary, and general info.
    """
    return await _request("GET", "/knowledge-base/clinic-info")


async def list_services() -> list[dict[str, Any]]:
    """Lists the clinic's active services, each with a fee label if set."""
    return await _request("GET", "/knowledge-base/services")


async def ask_knowledge_base(question: str) -> dict[str, Any]:
    """
    Asks a freeform question (insurance details, general info, misc FAQs)
    against the org's knowledge base. The backend does the matching and
    returns a ready-to-speak answer plus which FAQ (if any) it matched.
    """
    return await _request("GET", "/knowledge-base/ask", params={"q": question})


# ---------- Call intelligence (transcripts, summaries, metadata) ----------
#
# The agent has no summarization/sentiment logic of its own — it only
# reports what happened (direction, timestamps, transcript, which tools
# succeeded). The backend generates the AI summary and sentiment from
# that data. See app/call_intelligence.py.

async def create_call_log(
    direction: str,
    status: str = "in_progress",
    caller_phone: Optional[str] = None,
    patient_id: Optional[str] = None,
    patient_name: Optional[str] = None,
    reason: Optional[str] = None,
    started_at: Optional[str] = None,
) -> dict[str, Any]:
    """
    Creates a call log at the start of a call. Works the same for
    inbound and outbound — pass direction accordingly. Returns the
    created call record (id needed for the transcript/finalize calls).
    """
    payload = {
        "direction": direction,
        "status": status,
        "caller_phone": caller_phone,
        "patient_id": patient_id,
        "patient_name": patient_name,
        "reason": reason,
        "started_at": started_at,
    }
    return await _request("POST", "/calls", json={k: v for k, v in payload.items() if v is not None})


async def update_call_caller_phone(call_id: str, caller_phone: str) -> dict[str, Any]:
    """
    Best-effort backfill of the caller's phone number on an already-created
    call log. For inbound SIP calls the caller's number can arrive on the
    participant's attributes a moment after the call log is first created
    (see _extract_caller_phone / the backfill task in agent.py), so this
    lets the agent patch it in as soon as it becomes available — without
    touching status, duration, or any other field, so it's safe to call at
    any point while the call is still in progress.
    """
    return await _request("PATCH", f"/calls/{call_id}", json={"caller_phone": caller_phone})


async def save_transcript_bulk(call_id: str, messages: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Saves the complete call transcript in one request, replacing any
    prior transcript for this call. Call once at the end of the call
    with the full conversation history. `messages` items look like
    {"who": "ai" | "patient", "text": str, "time_label": str | None}.
    """
    return await _request("PUT", f"/calls/{call_id}/transcript/bulk", json={"messages": messages})


async def finalize_call(
    call_id: str,
    status: str,
    duration_seconds: Optional[int] = None,
    ended_at: Optional[str] = None,
    patient_id: Optional[str] = None,
    appointment_id: Optional[str] = None,
    caller_phone: Optional[str] = None,
    outcome: Optional[str] = None,
    actions_taken: Optional[str] = None,
) -> dict[str, Any]:
    """
    Updates final call metadata once the call ends (status, duration,
    timestamps, and patient/appointment association if resolved during
    the call). Call this AFTER save_transcript_bulk so the backend's
    auto-generated AI summary and sentiment (triggered when status is
    terminal) have the transcript to work from. Leave outcome unset to
    let the backend infer it from actions_taken/transcript.
    """
    payload = {
        "status": status,
        "duration_seconds": duration_seconds,
        "ended_at": ended_at,
        "patient_id": patient_id,
        "appointment_id": appointment_id,
        "caller_phone": caller_phone,
        "outcome": outcome,
        "actions_taken": actions_taken,
    }
    return await _request(
        "PATCH", f"/calls/{call_id}", json={k: v for k, v in payload.items() if v is not None}
    )