from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/security", tags=["security"])

ROLE_DETAIL = {
    models.UserRole.admin: "Full access to settings, billing, and system configuration.",
    models.UserRole.medical_staff: "Access to patient transcripts, voice logs, and EHR sync.",
    models.UserRole.ai_agent: "Restricted read/write access to designated endpoints.",
}
ROLE_LABEL = {
    models.UserRole.admin: "Administrators",
    models.UserRole.medical_staff: "Medical Staff",
    models.UserRole.ai_agent: "AI Agents",
}


@router.get("/compliance", response_model=schemas.ComplianceOut)
def compliance(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    org = db.query(models.Organization).filter(models.Organization.id == user.org_id).first()
    return schemas.ComplianceOut(
        last_security_audit=org.hipaa_last_audit or "Not yet audited",
        data_retention_years=org.data_retention_years,
        baa_status=org.baa_status,
    )


@router.get("/roles", response_model=list[schemas.RoleSummaryOut])
def roles(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    counts = dict(
        db.query(models.User.role, func.count(models.User.id))
        .filter(models.User.org_id == user.org_id)
        .group_by(models.User.role)
        .all()
    )
    return [
        schemas.RoleSummaryOut(
            name=ROLE_LABEL[role], count=counts.get(role, 0), detail=ROLE_DETAIL[role]
        )
        for role in models.UserRole
    ]


@router.get("/audit-log", response_model=list[schemas.AuditLogOut])
def audit_log(
    limit: int = 50, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    return (
        db.query(models.AuditLogEntry)
        .filter(models.AuditLogEntry.org_id == user.org_id)
        .order_by(models.AuditLogEntry.occurred_at.desc())
        .limit(limit)
        .all()
    )