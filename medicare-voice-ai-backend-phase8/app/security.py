import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import settings

logger = logging.getLogger("security")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# bcrypt silently truncates at 72 bytes; reject longer passwords up front
# rather than hashing only part of what the user typed.
_MAX_PASSWORD_BYTES = 72


def validate_password_strength(password: str) -> Optional[str]:
    """
    Returns an error message if the password doesn't meet minimum
    strength requirements, or None if it's acceptable. Kept intentionally
    simple (length + basic character-class variety) — this is baseline
    hardening, not a full password-policy engine.
    """
    if len(password) < settings.min_password_length:
        return f"Password must be at least {settings.min_password_length} characters long."
    if len(password.encode("utf-8")) > _MAX_PASSWORD_BYTES:
        return f"Password must be no more than {_MAX_PASSWORD_BYTES} bytes long."
    has_letter = any(c.isalpha() for c in password)
    has_digit_or_symbol = any(not c.isalpha() for c in password)
    if not (has_letter and has_digit_or_symbol):
        return "Password must contain letters and at least one number or symbol."
    return None


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_minutes: Optional[int] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.access_token_expire_minutes
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as e:
        logger.info(f"Rejected access token: {e}")
        return None
    # Ordinary user tokens never carry a "typ" claim. Super-admin tokens
    # always do (see create_super_admin_token). Rejecting typed tokens
    # here means a super-admin token can never be replayed against
    # get_current_user/get_org_context, even if someone tries.
    if payload.get("typ"):
        return None
    return payload


# --- Super Admin tokens -----------------------------------------------
# Same JWT machinery, but with an explicit typ="super_admin" claim, a
# shorter default lifetime, and a decoder that only accepts that one
# type. Keeping this fully separate from create_access_token/
# decode_access_token means the two token families can never be
# confused for one another by any existing dependency.

SUPER_ADMIN_TOKEN_TYPE = "super_admin"
_SUPER_ADMIN_TOKEN_EXPIRE_MINUTES = 480  # 8 hours


def create_super_admin_token(super_admin_id: str) -> str:
    to_encode = {"sub": super_admin_id, "typ": SUPER_ADMIN_TOKEN_TYPE}
    expire = datetime.now(timezone.utc) + timedelta(minutes=_SUPER_ADMIN_TOKEN_EXPIRE_MINUTES)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_super_admin_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as e:
        logger.info(f"Rejected super-admin token: {e}")
        return None
    if payload.get("typ") != SUPER_ADMIN_TOKEN_TYPE:
        return None
    return payload


def generate_api_key() -> tuple[str, str]:
    """Returns (plaintext_key, prefix_for_display)."""
    raw = secrets.token_urlsafe(32)
    key = f"sk_live_{raw}"
    prefix = f"{key[:12]}{'*' * 24}{key[-3:]}"
    return key, prefix


def hash_api_key(raw_key: str) -> str:
    """
    SHA-256 digest for exact-match, indexed lookup.
    API keys are high-entropy (32 random bytes) so a fast keyed digest is
    appropriate here — unlike user passwords, they don't need bcrypt's
    slow, salted hashing to resist brute force, and callers need O(1)
    lookup-by-value to authenticate service-to-service requests.
    """
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def mask_api_key(raw_key: str) -> str:
    """
    Never log a raw API key. Used only for audit/error log lines when an
    invalid key is presented, so ops can still correlate repeated bad
    attempts without the log itself becoming a credential leak.
    """
    if len(raw_key) <= 8:
        return "*" * len(raw_key)
    return f"{raw_key[:4]}...{raw_key[-4:]}"