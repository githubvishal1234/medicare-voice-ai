from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import call_intelligence, models, schemas
from ..database import get_db
from ..deps import OrgContext, get_org_context
from ..realtime import call_summary, manager, notify

router = APIRouter(prefix="/calls", tags=["calls"])

_TERMINAL_STATUSES = {"completed", "failed", "no_answer"}

# Outcomes that should surface as an actionable (warning-level) notification
# for clinic staff rather than a routine info-level one.
_URGENT_OUTCOMES = {"Transferred to Nurse"}


def _get_call_or_404(db: Session, call_id: str, org_id: str) -> models.CallLog:
    call = (
        db.query(models.CallLog)
        .filter(models.CallLog.id == call_id, models.CallLog.org_id == org_id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call


@router.get("", response_model=list[schemas.CallLogListOut])
def list_calls(
    outcome: Optional[str] = None,
    limit: Optional[int] = None,
    offset: int = 0,
    db: Session = Depends(get_db),
    ctx: OrgContext = Depends(get_org_context),
):
    """
    `limit`/`offset` are optional (Phase 8, opt-in pagination) — omitting
    `limit` preserves the previous behavior of returning every matching
    call log.
    """
    q = db.query(models.CallLog).filter(models.CallLog.org_id == ctx.org_id)
    if outcome:
        q = q.filter(models.CallLog.outcome == outcome)
    q = q.order_by(models.CallLog.occurred_at.desc())
    if offset:
        q = q.offset(offset)
    if limit is not None:
        q = q.limit(min(limit, 500))
    return q.all()


@router.post("", response_model=schemas.CallLogDetailOut)
def create_call(
    payload: schemas.CallLogCreate,
    db: Session = Depends(get_db),
    ctx: OrgContext = Depends(get_org_context),
):
    """
    Creates a call log. The voice agent calls this once, right at the
    start of a call (inbound or outbound), with whatever it already
    knows (direction, caller_phone, started_at). Everything else —
    patient/appointment association, transcript, final metadata, and the
    AI summary — is filled in later via the transcript/bulk and PATCH
    endpoints as the call progresses and ends.
    """
    data = payload.model_dump(exclude_none=True)
    if payload.patient_id:
        patient = (
            db.query(models.Patient)
            .filter(models.Patient.id == payload.patient_id, models.Patient.org_id == ctx.org_id)
            .first()
        )
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
    if payload.appointment_id:
        appt = (
            db.query(models.Appointment)
            .filter(models.Appointment.id == payload.appointment_id, models.Appointment.org_id == ctx.org_id)
            .first()
        )
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found")

    call = models.CallLog(org_id=ctx.org_id, **data)
    db.add(call)
    db.commit()
    db.refresh(call)

    manager.broadcast(ctx.org_id, "call.started", call_summary(call))
    notify(
        ctx.org_id,
        level="info",
        title="Call in progress" if call.direction == "outbound" else "Incoming call",
        message=f"{call.patient_name or 'Unknown Caller'} · {call.reason or ('Outbound call' if call.direction == 'outbound' else 'Inbound call')}",
        data={"call_id": call.id},
    )
    return call


@router.get("/{call_id}", response_model=schemas.CallLogDetailOut)
def get_call(
    call_id: str, db: Session = Depends(get_db), ctx: OrgContext = Depends(get_org_context)
):
    return _get_call_or_404(db, call_id, ctx.org_id)


@router.patch("/{call_id}", response_model=schemas.CallLogDetailOut)
def update_call(
    call_id: str,
    payload: schemas.CallLogUpdate,
    db: Session = Depends(get_db),
    ctx: OrgContext = Depends(get_org_context),
):
    """
    Updates call metadata (duration, status, timestamps, caller/patient/
    appointment association, etc). Used by the voice agent to finalize a
    call once it ends. If the call is being moved into a terminal status
    (completed | failed | no_answer) and no explicit ai_summary/sentiment
    was supplied, the backend generates them from the stored transcript
    and actions_taken — the voice agent never has to compute these
    itself.
    """
    call = _get_call_or_404(db, call_id, ctx.org_id)
    data = payload.model_dump(exclude_unset=True, exclude_none=True)
    was_in_progress = call.status not in _TERMINAL_STATUSES

    if "patient_id" in data:
        patient = (
            db.query(models.Patient)
            .filter(models.Patient.id == data["patient_id"], models.Patient.org_id == ctx.org_id)
            .first()
        )
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
    if "appointment_id" in data:
        appt = (
            db.query(models.Appointment)
            .filter(models.Appointment.id == data["appointment_id"], models.Appointment.org_id == ctx.org_id)
            .first()
        )
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found")

    for field, value in data.items():
        setattr(call, field, value)

    if "duration_seconds" in data and "duration" not in data:
        call.duration = call_intelligence.format_duration_label(data["duration_seconds"])

    just_ended = was_in_progress and call.status in _TERMINAL_STATUSES
    if call.status in _TERMINAL_STATUSES:
        if "sentiment" not in data:
            call.sentiment = call_intelligence.infer_sentiment(call)
        if "outcome" not in data:
            call.outcome = call_intelligence.infer_outcome(call)
        if "ai_summary" not in data:
            call.ai_summary = call_intelligence.generate_summary(call)

    db.commit()
    db.refresh(call)

    manager.broadcast(ctx.org_id, "call.updated", call_summary(call))
    if just_ended:
        manager.broadcast(ctx.org_id, "call.ended", call_summary(call))
        level = "warning" if call.outcome in _URGENT_OUTCOMES or call.status in {"failed", "no_answer"} else "success"
        notify(
            ctx.org_id,
            level=level,
            title="Call ended",
            message=f"{call.patient_name or 'Unknown Caller'} · {call.outcome or call.status} ({call.duration or '—'})",
            data={"call_id": call.id},
        )

    return call


@router.post("/{call_id}/transcript", response_model=schemas.TranscriptMessageOut)
def add_transcript_message(
    call_id: str,
    payload: schemas.TranscriptMessageCreate,
    db: Session = Depends(get_db),
    ctx: OrgContext = Depends(get_org_context),
):
    """Appends a single transcript message (e.g. for live/streaming use)."""
    _get_call_or_404(db, call_id, ctx.org_id)
    msg = models.TranscriptMessage(call_id=call_id, **payload.model_dump())
    db.add(msg)
    db.commit()
    db.refresh(msg)
    manager.broadcast(
        ctx.org_id,
        "call.transcript_message",
        {"call_id": call_id, "who": msg.who, "text": msg.text, "time_label": msg.time_label},
    )
    return msg


@router.put("/{call_id}/transcript/bulk", response_model=schemas.CallLogDetailOut)
def save_transcript_bulk(
    call_id: str,
    payload: schemas.TranscriptBulkCreate,
    db: Session = Depends(get_db),
    ctx: OrgContext = Depends(get_org_context),
):
    """
    Replaces the call's full transcript in one request. The voice agent
    calls this once at call end with the complete conversation history
    (works the same for inbound and outbound calls) — far cheaper than
    one request per turn, and idempotent if the agent retries on
    failure.
    """
    call = _get_call_or_404(db, call_id, ctx.org_id)
    db.query(models.TranscriptMessage).filter(models.TranscriptMessage.call_id == call.id).delete()
    for msg in payload.messages:
        db.add(models.TranscriptMessage(call_id=call.id, **msg.model_dump()))
    db.commit()
    db.refresh(call)
    return call