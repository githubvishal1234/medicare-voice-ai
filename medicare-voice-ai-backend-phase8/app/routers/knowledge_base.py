import logging
import os
import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings
from ..database import get_db
from ..deps import OrgContext, get_current_user, get_org_context

logger = logging.getLogger("knowledge_base")

router = APIRouter(prefix="/knowledge-base", tags=["knowledge-base"])

_STOPWORDS = {
    "a", "an", "the", "is", "are", "do", "does", "you", "your", "i", "my",
    "what", "when", "where", "how", "can", "of", "for", "to", "in", "on",
    "at", "and", "or", "it", "this", "that", "with", "have", "has", "about",
}


def _keywords(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in _STOPWORDS}

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("/documents", response_model=list[schemas.KBDocumentOut])
def list_documents(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return (
        db.query(models.KBDocument)
        .filter(models.KBDocument.org_id == user.org_id)
        .order_by(models.KBDocument.updated_at.desc())
        .all()
    )


@router.post("/documents", response_model=schemas.KBDocumentOut)
async def upload_document(
    file: UploadFile,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    # Phase 8: `file.filename` is attacker-controlled input — using it
    # directly in os.path.join (the pre-existing behavior) allowed a
    # crafted filename (e.g. "../../etc/something") to write outside the
    # intended org directory. Keep only the basename, reject anything
    # that still resolves outside org_dir, and store under a
    # collision-proof generated name while preserving the original name
    # for display purposes (KBDocument.name).
    original_name = os.path.basename(file.filename or "").strip()
    if not original_name:
        raise HTTPException(status_code=400, detail="A filename is required")

    org_dir = os.path.join(UPLOAD_DIR, user.org_id)
    os.makedirs(org_dir, exist_ok=True)

    _, ext = os.path.splitext(original_name)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.normpath(os.path.join(org_dir, stored_name))
    if not dest_path.startswith(os.path.normpath(org_dir) + os.sep):
        raise HTTPException(status_code=400, detail="Invalid filename")

    contents = await file.read()
    if len(contents) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the maximum upload size of {settings.max_upload_bytes // (1024 * 1024)} MB",
        )

    try:
        with open(dest_path, "wb") as f:
            f.write(contents)
    except OSError:
        logger.exception(f"Failed to write uploaded document for org={user.org_id}")
        raise HTTPException(status_code=500, detail="Could not save the uploaded file")

    doc = models.KBDocument(
        org_id=user.org_id,
        name=original_name,
        size_bytes=len(contents),
        status="Indexing",
        file_path=dest_path,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    # In production, indexing happens async (e.g. background task / queue).
    # Here we mark it indexed immediately for simplicity.
    doc.status = "Indexed"
    doc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/documents/{doc_id}", status_code=204)
def delete_document(
    doc_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    doc = (
        db.query(models.KBDocument)
        .filter(models.KBDocument.id == doc_id, models.KBDocument.org_id == user.org_id)
        .first()
    )
    if doc:
        if doc.file_path and os.path.exists(doc.file_path):
            os.remove(doc.file_path)
        db.delete(doc)
        db.commit()
    return None


@router.get("/sources", response_model=list[schemas.KBSourceOut])
def list_sources(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return db.query(models.KBSource).filter(models.KBSource.org_id == user.org_id).all()


@router.post("/sources", response_model=schemas.KBSourceOut)
def add_source(
    payload: schemas.KBSourceBase,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    source = models.KBSource(org_id=user.org_id, url=payload.url, status="Indexing")
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@router.delete("/sources/{source_id}", status_code=204)
def delete_source(
    source_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    source = (
        db.query(models.KBSource)
        .filter(models.KBSource.id == source_id, models.KBSource.org_id == user.org_id)
        .first()
    )
    if source:
        db.delete(source)
        db.commit()
    return None


@router.get("/faqs", response_model=list[schemas.FAQOut])
def list_faqs(db: Session = Depends(get_db), ctx: OrgContext = Depends(get_org_context)):
    """
    Dual-auth (dashboard JWT or voice-agent API key) so the voice agent can
    browse the raw FAQ list when needed, in addition to /knowledge-base/ask.
    """
    return db.query(models.FAQ).filter(models.FAQ.org_id == ctx.org_id).all()


@router.post("/faqs", response_model=schemas.FAQOut)
def add_faq(
    payload: schemas.FAQBase,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    faq = models.FAQ(org_id=user.org_id, **payload.model_dump())
    db.add(faq)
    db.commit()
    db.refresh(faq)
    return faq


@router.delete("/faqs/{faq_id}", status_code=204)
def delete_faq(
    faq_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    faq = db.query(models.FAQ).filter(models.FAQ.id == faq_id, models.FAQ.org_id == user.org_id).first()
    if faq:
        db.delete(faq)
        db.commit()
    return None


@router.get("/search", response_model=dict)
def search_knowledge_base(
    q: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    like = f"%{q}%"
    docs = (
        db.query(models.KBDocument)
        .filter(models.KBDocument.org_id == user.org_id, models.KBDocument.name.ilike(like))
        .all()
    )
    faqs = (
        db.query(models.FAQ)
        .filter(
            models.FAQ.org_id == user.org_id,
            (models.FAQ.question.ilike(like)) | (models.FAQ.answer.ilike(like)),
        )
        .all()
    )
    return {
        "documents": [schemas.KBDocumentOut.model_validate(d) for d in docs],
        "faqs": [schemas.FAQOut.model_validate(f) for f in faqs],
    }


# ---------- Clinic info (timings, contact, insurance, general info) ----------
def _get_or_create_clinic_info(db: Session, org_id: str) -> models.ClinicInfo:
    info = db.query(models.ClinicInfo).filter(models.ClinicInfo.org_id == org_id).first()
    if not info:
        info = models.ClinicInfo(org_id=org_id)
        db.add(info)
        db.commit()
        db.refresh(info)
    return info


@router.get("/clinic-info", response_model=schemas.ClinicInfoOut)
def get_clinic_info(db: Session = Depends(get_db), ctx: OrgContext = Depends(get_org_context)):
    """
    Structured clinic facts (timings, address, phone, email, website,
    insurance summary, general info). Dual-auth: the dashboard uses this to
    display/edit the profile, the voice agent uses it to answer callers
    instantly without a fuzzy FAQ search.
    """
    return _get_or_create_clinic_info(db, ctx.org_id)


@router.put("/clinic-info", response_model=schemas.ClinicInfoOut)
def update_clinic_info(
    payload: schemas.ClinicInfoUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Admin/staff-only (JWT) — updates the clinic profile from the dashboard."""
    info = _get_or_create_clinic_info(db, user.org_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(info, k, v)
    info.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(info)
    return info


# ---------- Services & consultation fees ----------
@router.get("/services", response_model=list[schemas.ServiceOut])
def list_services(db: Session = Depends(get_db), ctx: OrgContext = Depends(get_org_context)):
    """Dual-auth: lists active clinic services (and their fees) for dashboard and voice agent."""
    return (
        db.query(models.Service)
        .filter(models.Service.org_id == ctx.org_id, models.Service.active == True)  # noqa: E712 - SQL Server BIT compatibility
        .order_by(models.Service.name)
        .all()
    )


@router.post("/services", response_model=schemas.ServiceOut)
def create_service(
    payload: schemas.ServiceBase,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    service = models.Service(org_id=user.org_id, **payload.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.delete("/services/{service_id}", status_code=204)
def delete_service(
    service_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)
):
    service = (
        db.query(models.Service)
        .filter(models.Service.id == service_id, models.Service.org_id == user.org_id)
        .first()
    )
    if service:
        db.delete(service)
        db.commit()
    return None


# ---------- Ask (general Q&A over FAQs, with a clinic-info-aware fallback) ----------
@router.get("/ask", response_model=schemas.KBAnswerOut)
def ask_knowledge_base(
    q: str, db: Session = Depends(get_db), ctx: OrgContext = Depends(get_org_context)
):
    """
    Single entry point for freeform questions (insurance, general info,
    miscellaneous FAQs) that don't have their own dedicated endpoint. Scores
    every org FAQ by keyword overlap with the question and returns the best
    match. This is intentionally simple (no external NLP/embeddings
    dependency) and mirrors the existing ILIKE-based /search endpoint's
    approach. Falls back to a safe "don't know" answer, pointing at
    clinic-info, if nothing scores above the minimum threshold.
    """
    q_words = _keywords(q)
    faqs = db.query(models.FAQ).filter(models.FAQ.org_id == ctx.org_id).all()

    best_faq = None
    best_score = 0
    for faq in faqs:
        score = len(q_words & _keywords(f"{faq.question} {faq.answer}"))
        if score > best_score:
            best_score, best_faq = score, faq

    if best_faq and best_score >= 1:
        return schemas.KBAnswerOut(answer=best_faq.answer, matched_question=best_faq.question, source="faq")

    return schemas.KBAnswerOut(
        answer=(
            "I don't have that specific detail on hand, but I can share our clinic's "
            "general information and contact details, or connect you with our staff."
        ),
        matched_question=None,
        source="none",
    )