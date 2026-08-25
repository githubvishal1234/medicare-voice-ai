from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_admin

router = APIRouter(prefix="/billing", tags=["billing"])


def _format_billing_date(dt) -> str:
    """
    Cross-platform 'Mon D, YYYY' formatter (e.g. 'Sep 1, 2026').
    '%-d' is a glibc/Linux-only strftime directive — Python's strftime on
    Windows raises ValueError('Invalid format string') for it, which is what
    was crashing this endpoint. Build the day number without relying on any
    platform-specific directive instead (same approach already used for
    appointment day labels in routers/appointments.py).
    """
    return f"{dt.strftime('%b')} {dt.day}, {dt.strftime('%Y')}"


@router.get("/plan", response_model=schemas.PlanOut)
def get_plan(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    org = db.query(models.Organization).filter(models.Organization.id == user.org_id).first()
    used = org.voice_minutes_used
    limit = org.voice_minutes_limit or 1
    return schemas.PlanOut(
        plan=org.plan,
        minutes_used=used,
        minutes_limit=limit,
        usage_pct=round((used / limit) * 100, 1),
        next_billing_date=_format_billing_date(org.next_billing_date) if org.next_billing_date else None,
        payment_label=org.payment_label,
        payment_expires=org.payment_expires,
    )


@router.get("/invoices", response_model=list[schemas.InvoiceOut])
def list_invoices(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return (
        db.query(models.Invoice)
        .filter(models.Invoice.org_id == user.org_id)
        .order_by(models.Invoice.issued_at.desc())
        .all()
    )


@router.post("/upgrade", response_model=schemas.PlanOut)
def upgrade_plan(db: Session = Depends(get_db), user: models.User = Depends(require_admin)):
    """Stub — wire up to a real payment provider (e.g. Stripe) in production."""
    org = db.query(models.Organization).filter(models.Organization.id == user.org_id).first()
    org.plan = "Enterprise"
    org.voice_minutes_limit = 15000
    db.commit()
    db.refresh(org)
    used = org.voice_minutes_used
    limit = org.voice_minutes_limit or 1
    return schemas.PlanOut(
        plan=org.plan,
        minutes_used=used,
        minutes_limit=limit,
        usage_pct=round((used / limit) * 100, 1),
        next_billing_date=_format_billing_date(org.next_billing_date) if org.next_billing_date else None,
        payment_label=org.payment_label,
        payment_expires=org.payment_expires,
    )