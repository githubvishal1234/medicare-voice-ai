import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


def gen_id() -> str:
    return uuid.uuid4().hex[:12]


class UserRole(str, enum.Enum):
    admin = "admin"
    medical_staff = "medical_staff"
    ai_agent = "ai_agent"


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(64), primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    plan = Column(String, default="Professional Plan")
    voice_minutes_used = Column(Integer, default=0)
    voice_minutes_limit = Column(Integer, default=5000)
    next_billing_date = Column(DateTime, nullable=True)
    payment_label = Column(String, default="Visa ending in 4242")
    payment_expires = Column(String, default="12/25")
    hipaa_last_audit = Column(String, default="")
    data_retention_years = Column(Integer, default=7)
    baa_status = Column(String, default="Signed by Admin · v2.4")
    created_at = Column(DateTime, default=datetime.utcnow)

    # --- Super Admin: platform-level suspension, independent of any
    # per-org billing/plan state above. A suspended org's users can no
    # longer authenticate (see deps.get_current_user /
    # deps.get_org_context) or reach the voice agent's API-key path.
    suspended = Column(Boolean, default=False)
    suspended_reason = Column(String, nullable=True)

    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    patients = relationship("Patient", back_populates="organization", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.admin)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="users")

    @property
    def org_name(self) -> str:
        return self.organization.name if self.organization else ""


class Patient(Base):
    __tablename__ = "patients"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    mrn = Column(String, nullable=False)
    name = Column(String, nullable=False)
    dob = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    doctor = Column(String, nullable=True)
    status = Column(String, default="Active")
    initials = Column(String, nullable=True)

    # latest vitals snapshot
    vitals_bp = Column(String, nullable=True)
    vitals_bp_trend = Column(String, nullable=True)  # up | down | flat
    vitals_hr = Column(String, nullable=True)
    vitals_weight = Column(String, nullable=True)
    vitals_recorded = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="patients")
    prescriptions = relationship("Prescription", back_populates="patient", cascade="all, delete-orphan")
    interactions = relationship("Interaction", back_populates="patient", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")
    call_logs = relationship("CallLog", back_populates="patient")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(String(64), primary_key=True, default=gen_id)
    patient_id = Column(String(64), ForeignKey("patients.id"), nullable=False)
    name = Column(String, nullable=False)
    detail = Column(String, nullable=True)
    status = Column(String, default="Active")  # Active | Refill Soon
    note = Column(String, nullable=True)

    patient = relationship("Patient", back_populates="prescriptions")


class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(String(64), primary_key=True, default=gen_id)
    patient_id = Column(String(64), ForeignKey("patients.id"), nullable=False)
    title = Column(String, nullable=False)
    date_label = Column(String, nullable=True)
    occurred_at = Column(DateTime, default=datetime.utcnow)
    detail = Column(Text, nullable=True)
    has_audio = Column(Boolean, default=False)
    duration = Column(String, nullable=True)
    audio_url = Column(String, nullable=True)

    patient = relationship("Patient", back_populates="interactions")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    specialty = Column(String, nullable=True)
    slot_minutes = Column(Integer, default=30)
    work_start_hour = Column(Integer, default=9)  # 24h clinic-local clock
    work_end_hour = Column(Integer, default=17)
    work_days_csv = Column(String, default="0,1,2,3,4")  # Mon=0 .. Sun=6
    active = Column(Boolean, default=True)
    consultation_fee_label = Column(String, nullable=True)  # e.g. "$120" or "Free for follow-ups"

    appointments = relationship("Appointment", back_populates="doctor")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    patient_id = Column(String(64), ForeignKey("patients.id"), nullable=True)
    doctor_id = Column(String(64), ForeignKey("doctors.id"), nullable=True)
    title = Column(String, nullable=False)
    patient_name = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    day_label = Column(String, nullable=True)
    time_label = Column(String, nullable=True)
    start_at = Column(DateTime, nullable=True)
    end_at = Column(DateTime, nullable=True)
    location = Column(String, nullable=True)
    status = Column(String, default="upcoming")  # upcoming | done | cancelled
    ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")


class PendingBooking(Base):
    __tablename__ = "pending_bookings"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    patient_name = Column(String, nullable=False)
    type_label = Column(String, nullable=True)
    when_label = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending | verified | declined


class CallLog(Base):
    __tablename__ = "call_logs"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    patient_id = Column(String(64), ForeignKey("patients.id"), nullable=True)
    appointment_id = Column(String(64), ForeignKey("appointments.id"), nullable=True)
    patient_name = Column(String, default="Unknown Caller")
    timestamp_label = Column(String, nullable=True)
    occurred_at = Column(DateTime, default=datetime.utcnow)
    reason = Column(String, nullable=True)
    duration = Column(String, nullable=True)  # human-readable label, e.g. "4m 12s"
    duration_seconds = Column(Integer, nullable=True)
    outcome = Column(String, nullable=True)  # Booked | FAQ Answered | Transferred to Nurse | ...
    sentiment = Column(String, nullable=True)  # Positive | Neutral | Concerned
    ai_summary = Column(Text, nullable=True)
    actions_taken = Column(Text, nullable=True)  # newline separated
    recording_url = Column(String, nullable=True)
    direction = Column(String, default="inbound")  # inbound | outbound
    status = Column(String, default="in_progress")  # in_progress | completed | failed | no_answer
    caller_phone = Column(String, nullable=True)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="call_logs")
    transcript_messages = relationship(
        "TranscriptMessage", back_populates="call", cascade="all, delete-orphan", order_by="TranscriptMessage.id"
    )


class TranscriptMessage(Base):
    __tablename__ = "transcript_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    call_id = Column(String(64), ForeignKey("call_logs.id"), nullable=False)
    who = Column(String, nullable=False)  # ai | patient
    text = Column(Text, nullable=False)
    time_label = Column(String, nullable=True)

    call = relationship("CallLog", back_populates="transcript_messages")


class LiveCall(Base):
    __tablename__ = "live_calls"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    caller_name = Column(String, default="Unknown Caller")
    meta = Column(String, nullable=True)  # e.g. "0:45 · English"
    status = Column(String, nullable=True)  # e.g. "Booking in progress"
    tone = Column(String, default="neutral")  # info | warning | neutral
    started_at = Column(DateTime, default=datetime.utcnow)


class KBDocument(Base):
    __tablename__ = "kb_documents"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    size_bytes = Column(Integer, default=0)
    status = Column(String, default="Indexing")  # Indexing | Indexed | Failed
    file_path = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)


class KBSource(Base):
    __tablename__ = "kb_sources"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    url = Column(String, nullable=False)
    status = Column(String, default="Indexing")
    updated_at = Column(DateTime, default=datetime.utcnow)


class FAQ(Base):
    __tablename__ = "faqs"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    question = Column(String, nullable=False)
    answer = Column(Text, nullable=False)


class ClinicInfo(Base):
    """
    Org-scoped singleton (one row per org, like AgentSettings) holding the
    structured clinic facts the voice agent needs to answer instantly
    without a fuzzy search: timings, contact details, insurance summary,
    and general "about us" info.
    """

    __tablename__ = "clinic_info"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), unique=True, nullable=False)
    timings_text = Column(Text, nullable=True)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    website = Column(String, nullable=True)
    insurance_info = Column(Text, nullable=True)
    general_info = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)


class Service(Base):
    """Org-scoped list of clinic services (name, description, fee)."""

    __tablename__ = "services"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    fee_label = Column(String, nullable=True)  # e.g. "$150" or "Included with consultation"
    active = Column(Boolean, default=True)


class AgentSettings(Base):
    __tablename__ = "agent_settings"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), unique=True, nullable=False)
    voice_profile = Column(String, default="Dr. Sarah (Calm, Professional)")
    greeting_script = Column(Text, default="Thank you for calling. How can I help you today?")


class RoutingRule(Base):
    __tablename__ = "routing_rules"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    title = Column(String, nullable=False)
    detail = Column(String, nullable=True)
    enabled = Column(Boolean, default=True)


class EHRIntegration(Base):
    __tablename__ = "ehr_integrations"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    status = Column(String, default="Not Connected")
    connected = Column(Boolean, default=False)
    detail = Column(Text, nullable=True)
    note = Column(Text, nullable=True)
    meta1_label = Column(String, nullable=True)
    meta1_value = Column(String, nullable=True)
    meta2_label = Column(String, nullable=True)
    meta2_value = Column(String, nullable=True)
    api_credentials_json = Column(Text, nullable=True)


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    label = Column(String, nullable=False)
    key_prefix = Column(String, nullable=False)
    hashed_key = Column(String, nullable=False)
    environment = Column(String, default="production")  # production | staging
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked = Column(Boolean, default=False)


class Webhook(Base):
    __tablename__ = "webhooks"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), unique=True, nullable=False)
    endpoint_url = Column(String, nullable=True)
    events_csv = Column(String, default="transcript.completed,intent.requires_action,agent.error")


class AuditLogEntry(Base):
    __tablename__ = "audit_log"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    occurred_at = Column(DateTime, default=datetime.utcnow)
    action = Column(String, nullable=False)
    who = Column(String, nullable=True)
    status = Column(String, default="Success")  # Success | Blocked | Logged


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    invoice_number = Column(String, nullable=False)
    issued_at = Column(DateTime, default=datetime.utcnow)
    amount_cents = Column(Integer, default=0)
    status = Column(String, default="Paid")


class SuperAdmin(Base):
    """
    Platform-level identity, deliberately NOT a row in `users`/scoped to
    any `org_id`. Kept as its own table (rather than adding a nullable
    org_id + a new UserRole value) so nothing about existing org-scoped
    query patterns (`filter(Model.org_id == user.org_id)`) has to change
    anywhere in the codebase. Authenticates via its own JWT, issued with
    a distinct `typ` claim (see security.create_super_admin_token) so a
    super-admin token can never be replayed against ordinary
    get_current_user/get_org_context endpoints, and vice versa.
    """

    __tablename__ = "super_admins"

    id = Column(String(64), primary_key=True, default=gen_id)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SuperAdminAuditLog(Base):
    """
    Separate from AuditLogEntry (which is org-scoped and user-facing on
    each clinic's own Security page). This table records every
    cross-org / platform action a super admin takes, independent of
    which org (if any) it touched.
    """

    __tablename__ = "super_admin_audit_log"

    id = Column(String(64), primary_key=True, default=gen_id)
    super_admin_id = Column(String(64), ForeignKey("super_admins.id"), nullable=False)
    occurred_at = Column(DateTime, default=datetime.utcnow)
    action = Column(String, nullable=False)  # e.g. "org.suspend", "org.impersonate", "user.deactivate"
    target_org_id = Column(String(64), ForeignKey("organizations.id"), nullable=True)
    target_user_id = Column(String(64), ForeignKey("users.id"), nullable=True)
    detail = Column(Text, nullable=True)
    # Phase 7: request metadata + outcome. Additive/nullable columns on
    # the SAME table (picked up automatically by database.sync_missing_
    # columns()) — deliberately not a new/duplicate audit table.
    status = Column(String, default="success")  # success | failed
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)


class Plan(Base):
    """
    Super Admin-managed subscription plan catalog (Phase 5). Independent
    of `Organization.plan` (a free-text label the clinic-side /billing/plan
    endpoint has always displayed) — that column is left untouched so
    existing clinic billing behavior does not change. When a super admin
    assigns one of these plans to a clinic (see Subscription below), the
    org's `plan` / `voice_minutes_limit` fields are kept in sync so the
    clinic-facing Billing page continues to read correct values without
    any change to routers/billing.py itself.
    """

    __tablename__ = "plans"

    id = Column(String(64), primary_key=True, default=gen_id)
    # Bounded (not plain String/VARCHAR(MAX)) because this column carries a
    # UNIQUE constraint — SQL Server rejects UNIQUE/index constraints on
    # VARCHAR(MAX) columns. 120 matches the existing PlanIn/PlanUpdateIn
    # Pydantic validation (max_length=120) in app/schemas.py, so nothing
    # the API already accepts can be truncated or rejected at the DB level.
    name = Column(String(120), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    monthly_price_cents = Column(Integer, default=0)
    voice_minutes_limit = Column(Integer, default=0)
    # Null = unlimited.
    user_limit = Column(Integer, nullable=True)
    patient_limit = Column(Integer, nullable=True)
    ehr_access = Column(Boolean, default=False)
    knowledge_base_access = Column(Boolean, default=False)
    # Comma-separated feature keys (same lightweight pattern as
    # Webhook.events_csv) — avoids a separate features table for what is,
    # today, just a small set of on/off flags shown in the admin UI.
    features_csv = Column(String, default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    subscriptions = relationship("Subscription", back_populates="plan")


class Subscription(Base):
    """
    One row per organization: which Plan it currently has and the status
    of that assignment. Separate from Plan itself so plan definitions can
    be edited/deactivated without rewriting every org's history, and
    separate from Organization so the existing tenant table/queries never
    need an `if` for "does this org have a subscription yet".
    """

    __tablename__ = "subscriptions"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), unique=True, nullable=False)
    plan_id = Column(String(64), ForeignKey("plans.id"), nullable=False)
    status = Column(String, default="active")  # active | canceled | past_due
    started_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization")
    plan = relationship("Plan", back_populates="subscriptions")


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(String(64), primary_key=True, default=gen_id)
    org_id = Column(String(64), ForeignKey("organizations.id"), nullable=False)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=True)
    subject = Column(String, default="Technical Issue")
    priority = Column(String, default="Normal")
    message = Column(Text, nullable=False)
    status = Column(String, default="Open")
    created_at = Column(DateTime, default=datetime.utcnow)