from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import OrgContext, get_org_context

router = APIRouter(prefix="/doctors", tags=["doctors"])


@router.get("", response_model=list[schemas.DoctorOut])
def list_doctors(db: Session = Depends(get_db), ctx: OrgContext = Depends(get_org_context)):
    return (
        db.query(models.Doctor)
        .filter(models.Doctor.org_id == ctx.org_id, models.Doctor.active == True)  # noqa: E712 - SQL Server BIT compatibility
        .order_by(models.Doctor.name)
        .all()
    )