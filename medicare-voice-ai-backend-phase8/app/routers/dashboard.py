from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=schemas.DashboardStatsOut)
def stats(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    calls_today = (
        db.query(models.CallLog)
        .filter(models.CallLog.org_id == user.org_id, models.CallLog.occurred_at >= today_start)
        .all()
    )
    calls_handled_today = len(calls_today)

    appointments_booked_today = (
        db.query(func.count(models.Appointment.id))
        .filter(
            models.Appointment.org_id == user.org_id,
            models.Appointment.ai_generated == True,  # noqa: E712 - required for SQL Server BIT comparison ("IS 1" is invalid T-SQL; "= 1" is not)
            models.Appointment.created_at >= today_start,
        )
        .scalar()
        or 0
    )

    resolved = len([c for c in calls_today if c.outcome and c.outcome != "Transferred to Nurse"])
    resolution_rate_pct = round((resolved / calls_handled_today) * 100, 1) if calls_handled_today else 0.0

    # rough estimate: assume each handled call saves ~5 min of staff time
    staff_time_saved_hrs = round((calls_handled_today * 5) / 60, 1)

    return schemas.DashboardStatsOut(
        calls_handled_today=calls_handled_today,
        appointments_booked_today=appointments_booked_today,
        resolution_rate_pct=resolution_rate_pct,
        staff_time_saved_hrs=staff_time_saved_hrs,
    )


@router.get("/live-calls", response_model=list[schemas.LiveCallOut])
def live_calls(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return (
        db.query(models.LiveCall)
        .filter(models.LiveCall.org_id == user.org_id)
        .order_by(models.LiveCall.started_at.desc())
        .all()
    )


@router.post("/live-calls", response_model=schemas.LiveCallOut)
def create_live_call(
    payload: schemas.LiveCallCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    call = models.LiveCall(org_id=user.org_id, **payload.model_dump())
    db.add(call)
    db.commit()
    db.refresh(call)
    return call


@router.delete("/live-calls/{call_id}", status_code=204)
def end_live_call(
    call_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    call = (
        db.query(models.LiveCall)
        .filter(models.LiveCall.id == call_id, models.LiveCall.org_id == user.org_id)
        .first()
    )
    if call:
        db.delete(call)
        db.commit()
    return None


@router.get("/call-volume")
def call_volume(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Hourly call counts for the last 24 hours."""
    since = datetime.utcnow() - timedelta(hours=24)
    calls = (
        db.query(models.CallLog)
        .filter(models.CallLog.org_id == user.org_id, models.CallLog.occurred_at >= since)
        .all()
    )
    buckets = [0] * 24
    now_hour = datetime.utcnow().hour
    for c in calls:
        hours_ago = int((datetime.utcnow() - c.occurred_at).total_seconds() // 3600)
        if 0 <= hours_ago < 24:
            buckets[23 - hours_ago] += 1
    return {"hours": buckets, "current_hour": now_hour}