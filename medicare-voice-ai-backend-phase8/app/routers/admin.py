"""
Super Admin router — platform-level operations that span organizations.

Deliberately isolated from every other router in this codebase:
  - Auth is via SuperAdmin (app/models.py), never `models.User`.
  - Tokens carry a distinct `typ=super_admin` claim (app/security.py) and
    are verified by `deps.get_current_super_admin`, which never touches
    `get_current_user` / `get_org_context` / org_id filtering.
  - Every write path here is logged to SuperAdminAuditLog (separate from
    the existing, org-scoped AuditLogEntry used by each clinic's own
    Security page).

This router never touches LiveKit, SIP, the voice agent, or any
org-scoped business logic — it only reads across orgs and performs a
small set of explicit platform actions (suspend org, deactivate user,
change plan/limits, impersonate).
"""

import logging
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings
from ..database import get_db
from ..deps import get_current_super_admin
from ..rate_limit import enforce_rate_limit
from ..security import create_access_token, create_super_admin_token, verify_password

logger = logging.getLogger("admin")

router = APIRouter(prefix="/admin", tags=["admin"])


def _client_ip(request: Request | None) -> str | None:
    # Same forwarded-header precedence as rate_limit._client_key, so the
    # IP recorded here matches the IP the rate limiter keyed on.
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def _user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    return request.headers.get("user-agent")


def _log(
    db: Session,
    admin: models.SuperAdmin,
    action: str,
    target_org_id: str | None = None,
    target_user_id: str | None = None,
    detail: str | None = None,
    status: str = "success",
    request: Request | None = None,
) -> None:
    db.add(
        models.SuperAdminAuditLog(
            super_admin_id=admin.id,
            action=action,
            target_org_id=target_org_id,
            target_user_id=target_user_id,
            detail=detail,
            status=status,
            ip_address=_client_ip(request),
            user_agent=_user_agent(request),
        )
    )


def _get_org_or_404(db: Session, org_id: str) -> models.Organization:
    org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


# ---------- Auth ----------
@router.post("/auth/login", response_model=schemas.SuperAdminLoginOut)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    # Same bucket-based limiter used by /auth/login, keyed separately so
    # brute-forcing this endpoint can't also lock out clinic staff logins.
    enforce_rate_limit(
        request,
        bucket="admin_login",
        max_attempts=settings.login_rate_limit_attempts,
        window_seconds=settings.login_rate_limit_window_seconds,
    )

    admin = db.query(models.SuperAdmin).filter(models.SuperAdmin.email == form_data.username).first()
    if not admin or not verify_password(form_data.password, admin.hashed_password):
        logger.info(f"Failed super-admin login attempt for email={form_data.username}")
        # Only logged to SuperAdminAuditLog when the email matches a real
        # admin (the table's super_admin_id FK requires a real row) —
        # unknown-email attempts are still caught by the rate limiter and
        # the `logger.info` line above.
        if admin:
            _log(db, admin, "auth.login_failed", status="failed", request=request)
            db.commit()
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not admin.is_active:
        _log(db, admin, "auth.login_failed", status="failed", detail="account inactive", request=request)
        db.commit()
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = create_super_admin_token(admin.id)
    _log(db, admin, "auth.login", request=request)
    db.commit()
    return schemas.SuperAdminLoginOut(access_token=token)


@router.get("/me", response_model=schemas.SuperAdminOut)
def me(admin: models.SuperAdmin = Depends(get_current_super_admin)):
    return admin


# ---------- Platform stats ----------
@router.get("/stats", response_model=schemas.AdminPlatformStatsOut)
def platform_stats(
    db: Session = Depends(get_db), admin: models.SuperAdmin = Depends(get_current_super_admin)
):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    org_count = db.query(func.count(models.Organization.id)).scalar() or 0
    suspended_count = (
        db.query(func.count(models.Organization.id))
        .filter(models.Organization.suspended == True)  # noqa: E712
        .scalar()
        or 0
    )
    active_org_count = org_count - suspended_count

    user_count = db.query(func.count(models.User.id)).scalar() or 0
    active_user_count = (
        db.query(func.count(models.User.id))
        .filter(models.User.is_active == True)  # noqa: E712
        .scalar()
        or 0
    )

    patient_count = db.query(func.count(models.Patient.id)).scalar() or 0

    total_calls = db.query(func.count(models.CallLog.id)).scalar() or 0
    calls_today = (
        db.query(func.count(models.CallLog.id))
        .filter(models.CallLog.occurred_at >= today_start)
        .scalar()
        or 0
    )

    total_appointments = db.query(func.count(models.Appointment.id)).scalar() or 0
    appointments_today = (
        db.query(func.count(models.Appointment.id))
        .filter(models.Appointment.created_at >= today_start)
        .scalar()
        or 0
    )

    total_minutes_used = db.query(func.sum(models.Organization.voice_minutes_used)).scalar() or 0
    total_minutes_limit = db.query(func.sum(models.Organization.voice_minutes_limit)).scalar() or 0

    # Plan/subscription overview: how many orgs on each plan, and their
    # aggregate voice-minute usage vs. limit — reuses Organization.plan,
    # the same field the clinic-side /billing/plan endpoint reads.
    plan_rows = (
        db.query(
            models.Organization.plan,
            func.count(models.Organization.id),
            func.sum(models.Organization.voice_minutes_used),
            func.sum(models.Organization.voice_minutes_limit),
        )
        .group_by(models.Organization.plan)
        .order_by(func.count(models.Organization.id).desc())
        .all()
    )
    plan_breakdown = [
        schemas.AdminPlanBreakdownOut(
            plan=plan or "Unassigned",
            org_count=count or 0,
            voice_minutes_used=int(used or 0),
            voice_minutes_limit=int(limit or 0),
        )
        for plan, count, used, limit in plan_rows
    ]

    return schemas.AdminPlatformStatsOut(
        org_count=org_count,
        active_org_count=active_org_count,
        suspended_org_count=suspended_count,
        user_count=user_count,
        active_user_count=active_user_count,
        patient_count=patient_count,
        total_calls=total_calls,
        calls_today=calls_today,
        total_appointments=total_appointments,
        appointments_today=appointments_today,
        total_voice_minutes_used=int(total_minutes_used),
        total_voice_minutes_limit=int(total_minutes_limit),
        plan_breakdown=plan_breakdown,
    )


# ---------- Recent platform activity ----------
@router.get("/recent-activity", response_model=list[schemas.AdminRecentActivityItemOut])
def recent_activity(
    limit: int = 15,
    db: Session = Depends(get_db),
    admin: models.SuperAdmin = Depends(get_current_super_admin),
):
    """
    Merges several existing, real data sources into one time-ordered feed —
    no new table, no synthetic events:
      - new organizations signing up (Organization.created_at)
      - super admin platform actions (SuperAdminAuditLog, same rows shown
        on the Audit Log page)
      - recently completed calls (CallLog, status == 'completed')
    Each source is capped before merging so one noisy source (e.g. lots of
    calls) can't crowd out the others; the merged list is then re-sorted
    and trimmed to `limit`.
    """
    limit = min(max(limit, 1), 50)
    per_source = min(limit, 20)

    orgs = (
        db.query(models.Organization)
        .order_by(models.Organization.created_at.desc())
        .limit(per_source)
        .all()
    )
    org_items = [
        schemas.AdminRecentActivityItemOut(
            type="org_suspended" if org.suspended else "org_created",
            title=f"{'Suspended' if org.suspended else 'New organization'}: {org.name}",
            detail=org.suspended_reason if org.suspended else org.plan,
            occurred_at=org.created_at,
            org_id=org.id,
            org_name=org.name,
        )
        for org in orgs
    ]

    audit_rows = (
        db.query(models.SuperAdminAuditLog)
        .order_by(models.SuperAdminAuditLog.occurred_at.desc())
        .limit(per_source)
        .all()
    )
    org_names = {
        org.id: org.name
        for org in db.query(models.Organization.id, models.Organization.name)
        .filter(models.Organization.id.in_([r.target_org_id for r in audit_rows if r.target_org_id]))
        .all()
    }
    audit_items = [
        schemas.AdminRecentActivityItemOut(
            type="super_admin_action",
            title=row.action,
            detail=row.detail,
            occurred_at=row.occurred_at,
            org_id=row.target_org_id,
            org_name=org_names.get(row.target_org_id),
        )
        for row in audit_rows
    ]

    calls = (
        db.query(models.CallLog)
        .filter(models.CallLog.status == "completed")
        .order_by(models.CallLog.occurred_at.desc())
        .limit(per_source)
        .all()
    )
    call_org_names = {
        org.id: org.name
        for org in db.query(models.Organization.id, models.Organization.name)
        .filter(models.Organization.id.in_([c.org_id for c in calls]))
        .all()
    }
    call_items = [
        schemas.AdminRecentActivityItemOut(
            type="call_completed",
            title=f"Call with {call.patient_name or 'Unknown Caller'}",
            detail=call.outcome,
            occurred_at=call.occurred_at,
            org_id=call.org_id,
            org_name=call_org_names.get(call.org_id),
        )
        for call in calls
    ]

    merged = sorted(org_items + audit_items + call_items, key=lambda item: item.occurred_at, reverse=True)
    return merged[:limit]


# ---------- Organizations ----------
@router.get("/organizations", response_model=list[schemas.AdminOrgListOut])
def list_organizations(
    db: Session = Depends(get_db), admin: models.SuperAdmin = Depends(get_current_super_admin)
):
    orgs = db.query(models.Organization).order_by(models.Organization.created_at.desc()).all()
    user_counts = dict(
        db.query(models.User.org_id, func.count(models.User.id)).group_by(models.User.org_id).all()
    )
    patient_counts = dict(
        db.query(models.Patient.org_id, func.count(models.Patient.id))
        .group_by(models.Patient.org_id)
        .all()
    )
    return [
        schemas.AdminOrgListOut(
            id=org.id,
            name=org.name,
            plan=org.plan,
            suspended=bool(org.suspended),
            voice_minutes_used=org.voice_minutes_used,
            voice_minutes_limit=org.voice_minutes_limit,
            user_count=user_counts.get(org.id, 0),
            patient_count=patient_counts.get(org.id, 0),
            created_at=org.created_at,
        )
        for org in orgs
    ]


@router.get("/organizations/{org_id}", response_model=schemas.AdminOrgDetailOut)
def get_organization(
    org_id: str,
    db: Session = Depends(get_db),
    admin: models.SuperAdmin = Depends(get_current_super_admin),
):
    org = _get_org_or_404(db, org_id)
    users = db.query(models.User).filter(models.User.org_id == org_id).order_by(models.User.email).all()
    patient_count = (
        db.query(func.count(models.Patient.id)).filter(models.Patient.org_id == org_id).scalar() or 0
    )
    call_count = (
        db.query(func.count(models.CallLog.id)).filter(models.CallLog.org_id == org_id).scalar() or 0
    )
    appointment_count = (
        db.query(func.count(models.Appointment.id))
        .filter(models.Appointment.org_id == org_id)
        .scalar()
        or 0
    )

    # Contact info comes from the org's existing ClinicInfo row (same
    # table the clinic's own Clinic Info settings page manages) — no new
    # columns on Organization, no duplicate tenant model.
    clinic_info = (
        db.query(models.ClinicInfo).filter(models.ClinicInfo.org_id == org_id).first()
    )

    # Admin/owner: the org's oldest active admin user — identical
    # selection rule to the impersonate endpoint above, so "who gets
    # impersonated" and "who's shown as the owner" always agree.
    owner = (
        db.query(models.User)
        .filter(
            models.User.org_id == org_id,
            models.User.role == models.UserRole.admin,
            models.User.is_active == True,  # noqa: E712
        )
        .order_by(models.User.created_at)
        .first()
    )

    return schemas.AdminOrgDetailOut(
        id=org.id,
        name=org.name,
        plan=org.plan,
        suspended=bool(org.suspended),
        suspended_reason=org.suspended_reason,
        voice_minutes_used=org.voice_minutes_used,
        voice_minutes_limit=org.voice_minutes_limit,
        patient_count=patient_count,
        call_count=call_count,
        appointment_count=appointment_count,
        created_at=org.created_at,
        users=users,
        contact_email=clinic_info.email if clinic_info else None,
        contact_phone=clinic_info.phone if clinic_info else None,
        contact_address=clinic_info.address if clinic_info else None,
        contact_website=clinic_info.website if clinic_info else None,
        owner_name=owner.full_name if owner else None,
        owner_email=owner.email if owner else None,
    )


@router.patch("/organizations/{org_id}", response_model=schemas.AdminOrgDetailOut)
def update_organization(
    org_id: str,
    payload: schemas.AdminOrgUpdateIn,
    request: Request,
    db: Session = Depends(get_db),
    admin: models.SuperAdmin = Depends(get_current_super_admin),
):
    org = _get_org_or_404(db, org_id)
    data = payload.model_dump(exclude_unset=True)
    changed = []
    suspended_changed = "suspended" in data and data["suspended"] != org.suspended
    for k, v in data.items():
        if getattr(org, k) != v:
            changed.append(f"{k}={v!r}")
        setattr(org, k, v)
    # Give suspend/reinstate its own action name (rather than the generic
    # "org.update") so it's individually filterable/reportable on the
    # audit log page, while still writing to the same table/row.
    action = "org.suspend" if suspended_changed and org.suspended else "org.reinstate" if suspended_changed else "org.update"
    _log(db, admin, action, target_org_id=org.id, detail=", ".join(changed) or None, request=request)
    db.commit()
    return get_organization(org_id, db, admin)


# ---------- Users (within an org) ----------
@router.get("/users", response_model=list[schemas.AdminUserListOut])
def list_all_users(
    db: Session = Depends(get_db), admin: models.SuperAdmin = Depends(get_current_super_admin)
):
    """
    Cross-org user directory. Reads the existing `users` table joined
    against `organizations` for the display name — no new table, no
    change to how clinic users authenticate or how User rows are
    created/edited elsewhere in the app. Search/clinic/role filtering is
    left to the frontend (same pattern as /admin/organizations), since
    the full list is already a single cheap query.
    """
    rows = (
        db.query(models.User, models.Organization.name)
        .join(models.Organization, models.Organization.id == models.User.org_id)
        .order_by(models.User.created_at.desc())
        .all()
    )
    return [
        schemas.AdminUserListOut(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role.value if hasattr(user.role, "value") else user.role,
            is_active=user.is_active,
            created_at=user.created_at,
            org_id=user.org_id,
            org_name=org_name,
        )
        for user, org_name in rows
    ]


@router.patch("/organizations/{org_id}/users/{user_id}", response_model=schemas.AdminOrgUserOut)
def update_org_user(
    org_id: str,
    user_id: str,
    payload: schemas.AdminUserUpdateIn,
    request: Request,
    db: Session = Depends(get_db),
    admin: models.SuperAdmin = Depends(get_current_super_admin),
):
    _get_org_or_404(db, org_id)
    user = (
        db.query(models.User)
        .filter(models.User.id == user_id, models.User.org_id == org_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found in this organization")
    data = payload.model_dump(exclude_unset=True)
    changed = []
    active_changed = "is_active" in data and data["is_active"] != user.is_active
    for k, v in data.items():
        if k == "role" and v is not None:
            v = models.UserRole(v)
        if getattr(user, k) != v:
            changed.append(f"{k}={v!r}")
        setattr(user, k, v)
    # Same reasoning as org.suspend/org.reinstate above: give
    # activate/deactivate their own action name for filtering.
    action = (
        "user.activate" if active_changed and user.is_active
        else "user.deactivate" if active_changed
        else "user.update"
    )
    _log(
        db,
        admin,
        action,
        target_org_id=org_id,
        target_user_id=user.id,
        detail=", ".join(changed) or None,
        request=request,
    )
    db.commit()
    db.refresh(user)
    return user


# ---------- Impersonation ----------
@router.post("/organizations/{org_id}/impersonate", response_model=schemas.AdminImpersonateOut)
def impersonate_organization(
    org_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: models.SuperAdmin = Depends(get_current_super_admin),
):
    """
    Mints a REGULAR, org-scoped user token — not a special "bypass"
    token. This means every existing route (get_current_user,
    get_org_context, all org-scoped queries) needs zero changes to
    support impersonation: the rest of the app can't tell the
    difference between this and a normal login.

    Picks the org's oldest active admin user to act as. Logged.
    """
    org = _get_org_or_404(db, org_id)
    if org.suspended:
        raise HTTPException(status_code=400, detail="Cannot impersonate into a suspended organization")
    target_user = (
        db.query(models.User)
        .filter(
            models.User.org_id == org_id,
            models.User.role == models.UserRole.admin,
            models.User.is_active == True,  # noqa: E712
        )
        .order_by(models.User.created_at)
        .first()
    )
    if not target_user:
        raise HTTPException(status_code=404, detail="This organization has no active admin user to impersonate")

    token = create_access_token({"sub": target_user.id})
    _log(
        db,
        admin,
        "org.impersonate",
        target_org_id=org.id,
        target_user_id=target_user.id,
        detail=f"acting_as={target_user.email}",
        request=request,
    )
    db.commit()
    return schemas.AdminImpersonateOut(
        access_token=token,
        org_id=org.id,
        org_name=org.name,
        acting_as_user_id=target_user.id,
        acting_as_email=target_user.email,
    )


# ---------- Platform audit log (Phase 7) ----------
@router.get("/audit-log", response_model=schemas.AdminAuditLogPageOut)
def audit_log(
    q: str | None = Query(None, description="Free-text search over action, detail, admin, org, IP."),
    action: str | None = Query(None, description="Exact action, e.g. 'org.suspend'."),
    org_id: str | None = Query(None, description="Filter to one clinic/organization."),
    status_filter: str | None = Query(None, alias="status", description="'success' or 'failed'."),
    start_date: date | None = Query(None, description="Range start (inclusive)."),
    end_date: date | None = Query(None, description="Range end (inclusive)."),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: models.SuperAdmin = Depends(get_current_super_admin),
):
    """
    Reads the existing SuperAdminAuditLog table only — no second/duplicate
    audit system. Joins SuperAdmin (who), Organization (which clinic), and
    User (which staff account, when the action targeted one) purely for
    display — none of those tables are written to here.
    """
    query = (
        db.query(models.SuperAdminAuditLog, models.SuperAdmin, models.Organization, models.User)
        .join(models.SuperAdmin, models.SuperAdmin.id == models.SuperAdminAuditLog.super_admin_id)
        .outerjoin(models.Organization, models.Organization.id == models.SuperAdminAuditLog.target_org_id)
        .outerjoin(models.User, models.User.id == models.SuperAdminAuditLog.target_user_id)
    )

    if action:
        query = query.filter(models.SuperAdminAuditLog.action == action)
    if org_id:
        query = query.filter(models.SuperAdminAuditLog.target_org_id == org_id)
    if status_filter:
        query = query.filter(models.SuperAdminAuditLog.status == status_filter)
    if start_date:
        query = query.filter(models.SuperAdminAuditLog.occurred_at >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.filter(models.SuperAdminAuditLog.occurred_at <= datetime.combine(end_date, time.max))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.SuperAdminAuditLog.action.ilike(like),
                models.SuperAdminAuditLog.detail.ilike(like),
                models.SuperAdminAuditLog.ip_address.ilike(like),
                models.SuperAdmin.full_name.ilike(like),
                models.SuperAdmin.email.ilike(like),
                models.Organization.name.ilike(like),
                models.User.email.ilike(like),
            )
        )

    total = query.count()
    total_pages = max(1, (total + page_size - 1) // page_size)

    rows = (
        query.order_by(models.SuperAdminAuditLog.occurred_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        schemas.AdminAuditLogOut(
            id=entry.id,
            occurred_at=entry.occurred_at,
            action=entry.action,
            status=entry.status or "success",
            target_org_id=entry.target_org_id,
            target_org_name=org.name if org else None,
            target_user_id=entry.target_user_id,
            target_user_email=user.email if user else None,
            detail=entry.detail,
            ip_address=entry.ip_address,
            user_agent=entry.user_agent,
            super_admin_id=entry.super_admin_id,
            super_admin_name=sa.full_name if sa else None,
            super_admin_email=sa.email if sa else None,
        )
        for entry, sa, org, user in rows
    ]

    return schemas.AdminAuditLogPageOut(
        items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
    )


@router.get("/audit-log/actions", response_model=list[str])
def audit_log_actions(
    db: Session = Depends(get_db), admin: models.SuperAdmin = Depends(get_current_super_admin)
):
    """Distinct action values seen so far, for the Action filter dropdown."""
    rows = (
        db.query(models.SuperAdminAuditLog.action)
        .distinct()
        .order_by(models.SuperAdminAuditLog.action)
        .all()
    )
    return [r[0] for r in rows]
