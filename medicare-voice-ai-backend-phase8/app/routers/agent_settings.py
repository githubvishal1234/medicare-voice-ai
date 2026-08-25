from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/agent-settings", tags=["agent-settings"])


def _get_or_create_settings(db: Session, org_id: str) -> models.AgentSettings:
    settings_row = (
        db.query(models.AgentSettings).filter(models.AgentSettings.org_id == org_id).first()
    )
    if not settings_row:
        settings_row = models.AgentSettings(org_id=org_id)
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row


@router.get("", response_model=schemas.AgentSettingsOut)
def get_settings(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return _get_or_create_settings(db, user.org_id)


@router.put("", response_model=schemas.AgentSettingsOut)
def update_settings(
    payload: schemas.AgentSettingsUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    settings_row = _get_or_create_settings(db, user.org_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(settings_row, k, v)
    db.commit()
    db.refresh(settings_row)
    return settings_row


@router.get("/routing-rules", response_model=list[schemas.RoutingRuleOut])
def list_routing_rules(
    db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    return db.query(models.RoutingRule).filter(models.RoutingRule.org_id == user.org_id).all()


@router.post("/routing-rules", response_model=schemas.RoutingRuleOut)
def create_routing_rule(
    payload: schemas.RoutingRuleBase,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    rule = models.RoutingRule(org_id=user.org_id, **payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/routing-rules/{rule_id}", response_model=schemas.RoutingRuleOut)
def update_routing_rule(
    rule_id: str,
    payload: schemas.RoutingRuleUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    rule = (
        db.query(models.RoutingRule)
        .filter(models.RoutingRule.id == rule_id, models.RoutingRule.org_id == user.org_id)
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/routing-rules/{rule_id}", status_code=204)
def delete_routing_rule(
    rule_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    rule = (
        db.query(models.RoutingRule)
        .filter(models.RoutingRule.id == rule_id, models.RoutingRule.org_id == user.org_id)
        .first()
    )
    if rule:
        db.delete(rule)
        db.commit()
    return None
