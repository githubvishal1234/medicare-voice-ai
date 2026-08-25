import random
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import ehr_service, models, schemas
from ..database import get_db
from ..deps import OrgContext, get_current_user, get_org_context

router = APIRouter(prefix="/patients", tags=["patients"])


def _get_patient_or_404(db: Session, patient_id: str, org_id: str) -> models.Patient:
    patient = (
        db.query(models.Patient)
        .filter(models.Patient.id == patient_id, models.Patient.org_id == org_id)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


def _generate_mrn(db: Session, org_id: str) -> str:
    """Generates a unique MRN in the clinic's existing MRN-XXXXX-Y format."""
    for _ in range(10):
        candidate = f"MRN-{random.randint(10000, 99999)}-{random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ')}"
        exists = (
            db.query(models.Patient)
            .filter(models.Patient.org_id == org_id, models.Patient.mrn == candidate)
            .first()
        )
        if not exists:
            return candidate
    raise HTTPException(status_code=500, detail="Could not generate a unique MRN, please retry")


@router.get("", response_model=list[schemas.PatientListOut])
def list_patients(
    search: Optional[str] = None,
    limit: Optional[int] = None,
    offset: int = 0,
    db: Session = Depends(get_db),
    ctx: OrgContext = Depends(get_org_context),
):
    """
    `limit`/`offset` are optional (Phase 8, opt-in pagination for large
    orgs) — omitting `limit` preserves the previous behavior of
    returning every matching patient.
    """
    q = db.query(models.Patient).filter(models.Patient.org_id == ctx.org_id)
    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(
                models.Patient.name.ilike(like),
                models.Patient.mrn.ilike(like),
                models.Patient.phone.ilike(like),
            )
        )
    q = q.order_by(models.Patient.name)
    if offset:
        q = q.offset(offset)
    if limit is not None:
        q = q.limit(min(limit, 500))
    return q.all()


@router.post("", response_model=schemas.PatientDetailOut)
def create_patient(
    payload: schemas.PatientCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    ctx: OrgContext = Depends(get_org_context),
):
    data = payload.model_dump(exclude={"vitals"})
    if not data.get("mrn"):
        data["mrn"] = _generate_mrn(db, ctx.org_id)
    patient = models.Patient(org_id=ctx.org_id, **data)
    if payload.vitals:
        patient.vitals_bp = payload.vitals.bp
        patient.vitals_bp_trend = payload.vitals.bp_trend
        patient.vitals_hr = payload.vitals.hr
        patient.vitals_weight = payload.vitals.weight
        patient.vitals_recorded = payload.vitals.recorded
    db.add(patient)
    db.commit()
    db.refresh(patient)
    # Best-effort, non-blocking: never let EHR reachability affect patient
    # creation (e.g. a caller registering over the phone).
    ehr_service.schedule_patient_sync(background_tasks, patient.id, ctx.org_id, ctx.actor)
    return patient


@router.get("/{patient_id}", response_model=schemas.PatientDetailOut)
def get_patient(
    patient_id: str, db: Session = Depends(get_db), ctx: OrgContext = Depends(get_org_context)
):
    return _get_patient_or_404(db, patient_id, ctx.org_id)


@router.patch("/{patient_id}", response_model=schemas.PatientDetailOut)
def update_patient(
    patient_id: str,
    payload: schemas.PatientUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    patient = _get_patient_or_404(db, patient_id, user.org_id)
    data = payload.model_dump(exclude_unset=True, exclude={"vitals"})
    for k, v in data.items():
        setattr(patient, k, v)
    if payload.vitals:
        v = payload.vitals
        if v.bp is not None:
            patient.vitals_bp = v.bp
        if v.bp_trend is not None:
            patient.vitals_bp_trend = v.bp_trend
        if v.hr is not None:
            patient.vitals_hr = v.hr
        if v.weight is not None:
            patient.vitals_weight = v.weight
        if v.recorded is not None:
            patient.vitals_recorded = v.recorded
    db.commit()
    db.refresh(patient)
    ehr_service.schedule_patient_sync(background_tasks, patient.id, user.org_id, "user")
    return patient


@router.delete("/{patient_id}", status_code=204)
def delete_patient(
    patient_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    patient = _get_patient_or_404(db, patient_id, user.org_id)
    db.delete(patient)
    db.commit()
    return None


@router.post("/{patient_id}/prescriptions", response_model=schemas.PrescriptionOut)
def add_prescription(
    patient_id: str,
    payload: schemas.PrescriptionCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _get_patient_or_404(db, patient_id, user.org_id)
    rx = models.Prescription(patient_id=patient_id, **payload.model_dump())
    db.add(rx)
    db.commit()
    db.refresh(rx)
    return rx


@router.delete("/{patient_id}/prescriptions/{rx_id}", status_code=204)
def delete_prescription(
    patient_id: str,
    rx_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _get_patient_or_404(db, patient_id, user.org_id)
    rx = (
        db.query(models.Prescription)
        .filter(models.Prescription.id == rx_id, models.Prescription.patient_id == patient_id)
        .first()
    )
    if rx:
        db.delete(rx)
        db.commit()
    return None


@router.post("/{patient_id}/interactions", response_model=schemas.InteractionOut)
def add_interaction(
    patient_id: str,
    payload: schemas.InteractionCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _get_patient_or_404(db, patient_id, user.org_id)
    interaction = models.Interaction(patient_id=patient_id, **payload.model_dump())
    db.add(interaction)
    db.commit()
    db.refresh(interaction)
    return interaction