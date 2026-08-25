import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..rate_limit import enforce_rate_limit
from ..security import create_access_token, hash_password, verify_password

logger = logging.getLogger("auth")

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.LoginOut)
def register(payload: schemas.RegisterIn, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(
        request,
        bucket="register",
        max_attempts=settings.register_rate_limit_attempts,
        window_seconds=settings.register_rate_limit_window_seconds,
    )

    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        org = models.Organization(name=payload.org_name)
        db.add(org)
        db.flush()

        user = models.User(
            org_id=org.id,
            email=payload.email,
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name,
            role=models.UserRole.admin,
        )
        db.add(user)

        # sensible per-org defaults
        db.add(models.AgentSettings(org_id=org.id))
        db.add(models.Webhook(org_id=org.id))
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Registration failed while creating org/user")
        raise HTTPException(status_code=500, detail="Registration failed. Please try again.")

    token = create_access_token({"sub": user.id})
    return schemas.LoginOut(access_token=token)


@router.post("/login", response_model=schemas.LoginOut)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(
        request,
        bucket="login",
        max_attempts=settings.login_rate_limit_attempts,
        window_seconds=settings.login_rate_limit_window_seconds,
    )

    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        logger.info(f"Failed login attempt for email={form_data.username}")
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = create_access_token({"sub": user.id})
    return schemas.LoginOut(access_token=token)


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user