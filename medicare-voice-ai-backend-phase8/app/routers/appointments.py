from datetime import date as date_cls, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import ehr_service, models, notification_service, schemas
from ..database import get_db
from ..deps import OrgContext, get_current_user, get_org_context
from ..realtime import appointment_summary, manager, notify

router = APIRouter(prefix="/appointments", tags=["appointments"])

MAX_SLOTS_RETURNED = 10


def _format_day_label(dt: datetime) -> str:
    return f"{dt.strftime('%a, %b')} {dt.day}"


def _format_time_label(dt: datetime) -> str:
    return dt.strftime("%I:%M %p").lstrip("0")


def _get_org_appointment_or_404(db: Session, appointment_id: str, org_id: str) -> models.Appointment:
    appt = (
        db.query(models.Appointment)
        .filter(models.Appointment.id == appointment_id, models.Appointment.org_id == org_id)
        .first()
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


def _validate_slot(
    db: Session,
    ctx: OrgContext,
    doctor: models.Doctor,
    start_at: datetime,
    exclude_appointment_id: Optional[str] = None,
) -> datetime:
    """
    Shared slot validation for booking and rescheduling: rejects past times,
    times outside the doctor's working days/hours, and conflicts with any
    other non-cancelled appointment for that doctor. Returns the computed
    end_at on success. `exclude_appointment_id` lets a reschedule ignore
    its own existing (pre-move) booking when conflict-checking.
    """
    if start_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Cannot book an appointment in the past")
    if start_at.weekday() not in {int(d) for d in doctor.work_days_csv.split(",") if d.strip() != ""}:
        raise HTTPException(status_code=400, detail="Doctor does not work on that day")
    if not (doctor.work_start_hour <= start_at.hour < doctor.work_end_hour):
        raise HTTPException(status_code=400, detail="Requested time is outside doctor's working hours")

    end_at = start_at + timedelta(minutes=doctor.slot_minutes)

    conflict_q = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == doctor.id,
        models.Appointment.org_id == ctx.org_id,
        models.Appointment.status != "cancelled",
        models.Appointment.start_at < end_at,
        models.Appointment.end_at > start_at,
    )
    if exclude_appointment_id:
        conflict_q = conflict_q.filter(models.Appointment.id != exclude_appointment_id)
    if conflict_q.first():
        raise HTTPException(status_code=409, detail="That slot is no longer available")

    return end_at


@router.get("", response_model=list[schemas.AppointmentOut])
def list_appointments(
    db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    return (
        db.query(models.Appointment)
        .filter(models.Appointment.org_id == user.org_id)
        .order_by(models.Appointment.start_at)
        .all()
    )


@router.post("", response_model=schemas.AppointmentOut)
def create_appointment(
    payload: schemas.AppointmentCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    appt = models.Appointment(org_id=user.org_id, **payload.model_dump())
    db.add(appt)
    db.commit()
    db.refresh(appt)
    manager.broadcast(user.org_id, "appointment.created", appointment_summary(appt))
    return appt


@router.patch("/{appointment_id}", response_model=schemas.AppointmentOut)
def update_appointment(
    appointment_id: str,
    payload: schemas.AppointmentUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    appt = (
        db.query(models.Appointment)
        .filter(models.Appointment.id == appointment_id, models.Appointment.org_id == user.org_id)
        .first()
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(appt, k, v)
    db.commit()
    db.refresh(appt)
    manager.broadcast(user.org_id, "appointment.updated", appointment_summary(appt))
    return appt


@router.delete("/{appointment_id}", status_code=204)
def delete_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    appt = (
        db.query(models.Appointment)
        .filter(models.Appointment.id == appointment_id, models.Appointment.org_id == user.org_id)
        .first()
    )
    if appt:
        db.delete(appt)
        db.commit()
    return None


@router.get("/availability", response_model=schemas.AvailabilityOut)
def get_availability(
    doctor_id: str,
    date: str,
    db: Session = Depends(get_db),
    ctx: OrgContext = Depends(get_org_context),
):
    """
    Computes open slots for a doctor on a given date (YYYY-MM-DD), based on
    the doctor's working hours/days and existing (non-cancelled) bookings.
    This is the single source of truth for availability — the voice agent
    and dashboard both call this rather than reasoning about schedules themselves.
    """
    doctor = (
        db.query(models.Doctor)
        .filter(models.Doctor.id == doctor_id, models.Doctor.org_id == ctx.org_id, models.Doctor.active == True,  # noqa: E712 - SQL Server BIT compatibility
        )
        .first()
    )
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    try:
        target_date = date_cls.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be in YYYY-MM-DD format")

    allowed_weekdays = {int(d) for d in doctor.work_days_csv.split(",") if d.strip() != ""}
    if target_date.weekday() not in allowed_weekdays:
        return schemas.AvailabilityOut(doctor_id=doctor.id, doctor_name=doctor.name, date=date, slots=[])

    day_start = datetime.combine(target_date, datetime.min.time()).replace(hour=doctor.work_start_hour)
    day_end = datetime.combine(target_date, datetime.min.time()).replace(hour=doctor.work_end_hour)
    step = timedelta(minutes=doctor.slot_minutes)

    booked = (
        db.query(models.Appointment)
        .filter(
            models.Appointment.doctor_id == doctor.id,
            models.Appointment.org_id == ctx.org_id,
            models.Appointment.status != "cancelled",
            models.Appointment.start_at.isnot(None),
            models.Appointment.start_at >= day_start,
            models.Appointment.start_at < day_end,
        )
        .all()
    )
    booked_ranges = [
        (a.start_at, a.end_at or (a.start_at + step)) for a in booked
    ]

    now = datetime.utcnow()
    slots: list[schemas.AvailabilitySlotOut] = []
    cursor = day_start
    while cursor + step <= day_end and len(slots) < MAX_SLOTS_RETURNED:
        slot_end = cursor + step
        if cursor > now:  # never offer a slot that's already passed
            overlaps = any(cursor < b_end and slot_end > b_start for b_start, b_end in booked_ranges)
            if not overlaps:
                slots.append(schemas.AvailabilitySlotOut(start_at=cursor, label=_format_time_label(cursor)))
        cursor += step

    return schemas.AvailabilityOut(doctor_id=doctor.id, doctor_name=doctor.name, date=date, slots=slots)


@router.post("/book", response_model=schemas.AppointmentOut)
def book_appointment(
    payload: schemas.AppointmentBookIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    ctx: OrgContext = Depends(get_org_context),
):
    """
    Validated appointment booking: confirms the patient and doctor exist,
    the requested slot is within working hours, is still free, and only
    then creates the appointment. This is what the voice agent (and any
    future structured booking UI) should call — unlike the freeform
    POST /appointments used by staff for manual/admin entries, this endpoint
    owns the actual scheduling rules.
    """
    patient = (
        db.query(models.Patient)
        .filter(models.Patient.id == payload.patient_id, models.Patient.org_id == ctx.org_id)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    doctor = (
        db.query(models.Doctor)
        .filter(models.Doctor.id == payload.doctor_id, models.Doctor.org_id == ctx.org_id, models.Doctor.active == True,  # noqa: E712 - SQL Server BIT compatibility
        )
        .first()
    )
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    start_at = payload.start_at
    end_at = _validate_slot(db, ctx, doctor, start_at)

    appt = models.Appointment(
        org_id=ctx.org_id,
        patient_id=patient.id,
        doctor_id=doctor.id,
        title=f"Appointment with {doctor.name}",
        patient_name=patient.name,
        reason=payload.reason,
        day_label=_format_day_label(start_at),
        time_label=_format_time_label(start_at),
        start_at=start_at,
        end_at=end_at,
        location="Main Clinic",
        status="upcoming",
        ai_generated=(ctx.actor == "service"),
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)

    manager.broadcast(ctx.org_id, "appointment.booked", appointment_summary(appt))
    if ctx.actor == "service":
        notify(
            ctx.org_id,
            level="success",
            title="Appointment booked",
            message=f"{appt.patient_name} · {doctor.name} · {appt.day_label} {appt.time_label}",
            data={"appointment_id": appt.id},
        )
    ehr_service.schedule_appointment_sync(background_tasks, appt.id, ctx.org_id, ctx.actor)

    org = db.query(models.Organization).filter(models.Organization.id == ctx.org_id).first()
    background_tasks.add_task(
        notification_service.notify_appointment_booked,
        patient,
        appt,
        doctor,
        org.name if org else "our clinic",
    )

    return appt


@router.get("/patient/{patient_id}", response_model=list[schemas.AppointmentOut])
def list_patient_appointments(
    patient_id: str,
    include_past: bool = False,
    db: Session = Depends(get_db),
    ctx: OrgContext = Depends(get_org_context),
):
    """
    Lists a patient's appointments — used by the voice agent to identify
    which booking a caller means before rescheduling/cancelling. Defaults
    to non-cancelled, upcoming appointments only.
    """
    patient = (
        db.query(models.Patient)
        .filter(models.Patient.id == patient_id, models.Patient.org_id == ctx.org_id)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    q = db.query(models.Appointment).filter(
        models.Appointment.patient_id == patient_id,
        models.Appointment.org_id == ctx.org_id,
    )
    if not include_past:
        q = q.filter(
            models.Appointment.status != "cancelled",
            models.Appointment.start_at >= datetime.utcnow(),
        )
    return q.order_by(models.Appointment.start_at).all()


@router.post("/{appointment_id}/reschedule", response_model=schemas.AppointmentOut)
def reschedule_appointment(
    appointment_id: str,
    payload: schemas.AppointmentRescheduleIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    ctx: OrgContext = Depends(get_org_context),
):
    """
    Moves an existing (non-cancelled) appointment to a new time and,
    optionally, a new doctor. Re-runs the same working-hours/conflict
    validation as booking. The voice agent and any future structured
    reschedule UI should call this rather than the freeform PATCH, which
    does not validate schedules.
    """
    appt = _get_org_appointment_or_404(db, appointment_id, ctx.org_id)
    if appt.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot reschedule a cancelled appointment")

    doctor_id = payload.doctor_id or appt.doctor_id
    if not doctor_id:
        raise HTTPException(status_code=400, detail="Appointment has no doctor assigned; doctor_id is required")
    doctor = (
        db.query(models.Doctor)
        .filter(models.Doctor.id == doctor_id, models.Doctor.org_id == ctx.org_id, models.Doctor.active == True,  # noqa: E712 - SQL Server BIT compatibility
        )
        .first()
    )
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    end_at = _validate_slot(db, ctx, doctor, payload.start_at, exclude_appointment_id=appt.id)

    appt.doctor_id = doctor.id
    appt.start_at = payload.start_at
    appt.end_at = end_at
    appt.day_label = _format_day_label(payload.start_at)
    appt.time_label = _format_time_label(payload.start_at)
    appt.status = "upcoming"
    db.commit()
    db.refresh(appt)

    manager.broadcast(ctx.org_id, "appointment.rescheduled", appointment_summary(appt))
    if ctx.actor == "service":
        notify(
            ctx.org_id,
            level="info",
            title="Appointment rescheduled",
            message=f"{appt.patient_name} · moved to {appt.day_label} {appt.time_label}",
            data={"appointment_id": appt.id},
        )
    ehr_service.schedule_appointment_sync(background_tasks, appt.id, ctx.org_id, ctx.actor)
    return appt


@router.post("/{appointment_id}/cancel", response_model=schemas.AppointmentOut)
def cancel_appointment(
    appointment_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    ctx: OrgContext = Depends(get_org_context),
):
    """Cancels an appointment (soft cancel — status flip, record kept for history)."""
    appt = _get_org_appointment_or_404(db, appointment_id, ctx.org_id)
    if appt.status == "cancelled":
        raise HTTPException(status_code=400, detail="Appointment is already cancelled")
    appt.status = "cancelled"
    db.commit()
    db.refresh(appt)

    manager.broadcast(ctx.org_id, "appointment.cancelled", appointment_summary(appt))
    if ctx.actor == "service":
        notify(
            ctx.org_id,
            level="warning",
            title="Appointment cancelled",
            message=f"{appt.patient_name} · {appt.day_label or ''} {appt.time_label or ''}".strip(),
            data={"appointment_id": appt.id},
        )
    ehr_service.schedule_appointment_sync(background_tasks, appt.id, ctx.org_id, ctx.actor)

    patient = db.query(models.Patient).filter(models.Patient.id == appt.patient_id).first()
    doctor = db.query(models.Doctor).filter(models.Doctor.id == appt.doctor_id).first()
    org = db.query(models.Organization).filter(models.Organization.id == ctx.org_id).first()
    if patient:
        background_tasks.add_task(
            notification_service.notify_appointment_cancelled,
            patient,
            appt,
            doctor,
            org.name if org else "our clinic",
        )

    return appt


@router.get("/pending/bookings", response_model=list[schemas.PendingBookingOut])
def list_pending_bookings(
    db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    return (
        db.query(models.PendingBooking)
        .filter(
            models.PendingBooking.org_id == user.org_id,
            models.PendingBooking.status == "pending",
        )
        .all()
    )


@router.post("/pending/bookings", response_model=schemas.PendingBookingOut)
def create_pending_booking(
    payload: schemas.PendingBookingCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    booking = models.PendingBooking(org_id=user.org_id, **payload.model_dump())
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@router.post("/pending/bookings/{booking_id}/verify", response_model=schemas.PendingBookingOut)
def verify_pending_booking(
    booking_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    booking = (
        db.query(models.PendingBooking)
        .filter(models.PendingBooking.id == booking_id, models.PendingBooking.org_id == user.org_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking.status = "verified"
    appt = models.Appointment(
        org_id=user.org_id,
        title=booking.type_label or "AI Booking",
        patient_name=booking.patient_name,
        time_label=booking.when_label,
        status="upcoming",
        ai_generated=True,
    )
    db.add(appt)
    db.commit()
    db.refresh(booking)
    db.refresh(appt)
    manager.broadcast(user.org_id, "appointment.booked", appointment_summary(appt))
    return booking


@router.post("/pending/bookings/{booking_id}/decline", response_model=schemas.PendingBookingOut)
def decline_pending_booking(
    booking_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    booking = (
        db.query(models.PendingBooking)
        .filter(models.PendingBooking.id == booking_id, models.PendingBooking.org_id == user.org_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking.status = "declined"
    db.commit()
    db.refresh(booking)
    return booking