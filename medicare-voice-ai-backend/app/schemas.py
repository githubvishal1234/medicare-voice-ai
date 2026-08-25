from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .security import validate_password_strength


# ---------- Auth ----------
class RegisterIn(BaseModel):
    org_name: str = Field(..., min_length=1, max_length=200)
    full_name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=72)

    @field_validator("password")
    @classmethod
    def _check_password_strength(cls, v: str) -> str:
        error = validate_password_strength(v)
        if error:
            raise ValueError(error)
        return v

    @field_validator("org_name", "full_name")
    @classmethod
    def _strip_and_require_nonblank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("This field cannot be blank.")
        return v


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    full_name: str
    role: str
    org_id: str
    org_name: str


# ---------- Org ----------
class OrgOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    plan: str


# ---------- Vitals (embedded) ----------
class VitalsIn(BaseModel):
    bp: Optional[str] = None
    bp_trend: Optional[str] = None
    hr: Optional[str] = None
    weight: Optional[str] = None
    recorded: Optional[str] = None


# ---------- Prescription ----------
class PrescriptionBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    detail: Optional[str] = Field(None, max_length=2000)
    status: str = "Active"
    note: Optional[str] = Field(None, max_length=2000)


class PrescriptionCreate(PrescriptionBase):
    pass


class PrescriptionOut(PrescriptionBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


# ---------- Interaction ----------
class InteractionBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    date_label: Optional[str] = Field(None, max_length=100)
    detail: Optional[str] = Field(None, max_length=5000)
    has_audio: bool = False
    duration: Optional[str] = None
    audio_url: Optional[str] = None


class InteractionCreate(InteractionBase):
    pass


class InteractionOut(InteractionBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    occurred_at: datetime


# ---------- Appointment (nested, on patient) ----------
class PatientAppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    day_label: Optional[str] = None
    time_label: Optional[str] = None
    location: Optional[str] = None
    status: str


# ---------- Patient ----------
class PatientBase(BaseModel):
    mrn: Optional[str] = Field(None, max_length=50)  # auto-generated server-side if omitted (e.g. AI registration over the phone)
    name: str = Field(..., min_length=1, max_length=200)
    dob: Optional[str] = Field(None, max_length=50)
    age: Optional[int] = Field(None, ge=0, le=150)
    phone: Optional[str] = Field(None, max_length=30)
    email: Optional[EmailStr] = None
    doctor: Optional[str] = Field(None, max_length=200)
    status: str = "Active"
    initials: Optional[str] = Field(None, max_length=10)

    @field_validator("name")
    @classmethod
    def _name_nonblank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Patient name cannot be blank.")
        return v


class PatientCreate(PatientBase):
    vitals: Optional[VitalsIn] = None


class PatientUpdate(BaseModel):
    mrn: Optional[str] = Field(None, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    dob: Optional[str] = Field(None, max_length=50)
    age: Optional[int] = Field(None, ge=0, le=150)
    phone: Optional[str] = Field(None, max_length=30)
    email: Optional[EmailStr] = None
    doctor: Optional[str] = Field(None, max_length=200)
    status: Optional[str] = None
    initials: Optional[str] = Field(None, max_length=10)
    vitals: Optional[VitalsIn] = None


class PatientListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    mrn: str
    name: str
    doctor: Optional[str] = None
    status: str
    initials: Optional[str] = None


class PatientDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    mrn: str
    name: str
    dob: Optional[str] = None
    age: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    doctor: Optional[str] = None
    status: str
    initials: Optional[str] = None
    vitals_bp: Optional[str] = None
    vitals_bp_trend: Optional[str] = None
    vitals_hr: Optional[str] = None
    vitals_weight: Optional[str] = None
    vitals_recorded: Optional[str] = None
    prescriptions: list[PrescriptionOut] = []
    interactions: list[InteractionOut] = []
    appointments: list[PatientAppointmentOut] = []


# ---------- Appointment (top-level) ----------
class AppointmentBase(BaseModel):
    title: str
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    doctor_id: Optional[str] = None
    reason: Optional[str] = None
    day_label: Optional[str] = None
    time_label: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    location: Optional[str] = None
    status: str = "upcoming"
    ai_generated: bool = False


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdate(BaseModel):
    title: Optional[str] = None
    day_label: Optional[str] = None
    time_label: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    location: Optional[str] = None
    status: Optional[str] = None
    ai_generated: Optional[bool] = None


class AppointmentOut(AppointmentBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


# ---------- Doctors & Scheduling ----------
class DoctorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    specialty: Optional[str] = None
    slot_minutes: int
    consultation_fee_label: Optional[str] = None


class AvailabilitySlotOut(BaseModel):
    start_at: datetime
    label: str  # e.g. "10:00 AM"


class AvailabilityOut(BaseModel):
    doctor_id: str
    doctor_name: str
    date: str  # YYYY-MM-DD
    slots: list[AvailabilitySlotOut]


class AppointmentBookIn(BaseModel):
    patient_id: str = Field(..., min_length=1)
    doctor_id: str = Field(..., min_length=1)
    start_at: datetime
    reason: Optional[str] = Field(None, max_length=500)


class AppointmentRescheduleIn(BaseModel):
    start_at: datetime
    doctor_id: Optional[str] = None  # omit to keep the same doctor


class PendingBookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_name: str
    type_label: Optional[str] = None
    when_label: Optional[str] = None
    status: str


class PendingBookingCreate(BaseModel):
    patient_name: str
    type_label: Optional[str] = None
    when_label: Optional[str] = None


# ---------- Calls ----------
class TranscriptMessageBase(BaseModel):
    who: str = Field(..., pattern="^(ai|patient)$")
    text: str = Field(..., min_length=1, max_length=10000)
    time_label: Optional[str] = Field(None, max_length=50)


class TranscriptMessageCreate(TranscriptMessageBase):
    pass


class TranscriptMessageOut(TranscriptMessageBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class CallLogBase(BaseModel):
    patient_id: Optional[str] = None
    appointment_id: Optional[str] = None
    patient_name: str = "Unknown Caller"
    timestamp_label: Optional[str] = None
    reason: Optional[str] = None
    duration: Optional[str] = None
    duration_seconds: Optional[int] = None
    outcome: Optional[str] = None
    sentiment: Optional[str] = None
    ai_summary: Optional[str] = None
    actions_taken: Optional[str] = None
    recording_url: Optional[str] = None
    direction: Optional[str] = None  # inbound | outbound
    status: Optional[str] = None  # in_progress | completed | failed | no_answer
    caller_phone: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class CallLogCreate(CallLogBase):
    pass


class CallLogUpdate(BaseModel):
    """Partial update used to finalize a call (metadata, associations, summary)."""

    patient_id: Optional[str] = None
    appointment_id: Optional[str] = None
    patient_name: Optional[str] = None
    caller_phone: Optional[str] = None
    reason: Optional[str] = None
    duration: Optional[str] = None
    duration_seconds: Optional[int] = None
    status: Optional[str] = None
    outcome: Optional[str] = None
    sentiment: Optional[str] = None
    ai_summary: Optional[str] = None
    actions_taken: Optional[str] = None
    recording_url: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class CallLogListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_id: Optional[str] = None
    appointment_id: Optional[str] = None
    patient_name: str
    timestamp_label: Optional[str] = None
    reason: Optional[str] = None
    duration: Optional[str] = None
    duration_seconds: Optional[int] = None
    outcome: Optional[str] = None
    sentiment: Optional[str] = None
    direction: Optional[str] = None
    status: Optional[str] = None
    caller_phone: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class CallLogDetailOut(CallLogListOut):
    ai_summary: Optional[str] = None
    actions_taken: Optional[str] = None
    recording_url: Optional[str] = None
    transcript_messages: list[TranscriptMessageOut] = []


class TranscriptBulkCreate(BaseModel):
    """Full/partial transcript submitted in one shot at call end. Replaces
    any transcript messages already stored for the call (idempotent on retry)."""

    messages: list[TranscriptMessageCreate]


# ---------- Dashboard ----------
class DashboardStatsOut(BaseModel):
    calls_handled_today: int
    appointments_booked_today: int
    resolution_rate_pct: float
    staff_time_saved_hrs: float


class LiveCallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    caller_name: str
    meta: Optional[str] = None
    status: Optional[str] = None
    tone: str


class LiveCallCreate(BaseModel):
    caller_name: str = "Unknown Caller"
    meta: Optional[str] = None
    status: Optional[str] = None
    tone: str = "neutral"


# ---------- Knowledge base ----------
class KBDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    size_bytes: int
    status: str
    updated_at: datetime


class KBSourceBase(BaseModel):
    url: str = Field(..., min_length=1, max_length=2000)


class KBSourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    url: str
    status: str
    updated_at: datetime


class FAQBase(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    answer: str = Field(..., min_length=1, max_length=5000)


class FAQOut(FAQBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


# ---------- Clinic info & services (Knowledge Base) ----------
class ClinicInfoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    timings_text: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    insurance_info: Optional[str] = None
    general_info: Optional[str] = None


class ClinicInfoUpdate(BaseModel):
    timings_text: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    insurance_info: Optional[str] = None
    general_info: Optional[str] = None


class ServiceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    fee_label: Optional[str] = Field(None, max_length=50)
    active: bool = True


class ServiceOut(ServiceBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


class KBAnswerOut(BaseModel):
    answer: str
    matched_question: Optional[str] = None
    source: str  # "faq" | "none"


# ---------- Agent settings ----------
class AgentSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    voice_profile: str
    greeting_script: str


class AgentSettingsUpdate(BaseModel):
    voice_profile: Optional[str] = None
    greeting_script: Optional[str] = None


class RoutingRuleBase(BaseModel):
    title: str
    detail: Optional[str] = None
    enabled: bool = True


class RoutingRuleOut(RoutingRuleBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


class RoutingRuleUpdate(BaseModel):
    title: Optional[str] = None
    detail: Optional[str] = None
    enabled: Optional[bool] = None


# ---------- EHR ----------
class EHRIntegrationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    status: str
    connected: bool
    detail: Optional[str] = None
    note: Optional[str] = None
    meta1_label: Optional[str] = None
    meta1_value: Optional[str] = None
    meta2_label: Optional[str] = None
    meta2_value: Optional[str] = None


class EHRIntegrationUpdate(BaseModel):
    status: Optional[str] = None
    connected: Optional[bool] = None
    api_key: Optional[str] = None


class APIKeyCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=200)
    environment: str = Field("production", pattern="^(production|staging)$")


class APIKeyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    label: str
    key_prefix: str
    environment: str
    created_at: datetime
    revoked: bool


class APIKeyCreatedOut(APIKeyOut):
    plaintext_key: str  # shown once, on creation only


class WebhookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    endpoint_url: Optional[str] = None
    events: list[str]


class WebhookUpdate(BaseModel):
    endpoint_url: Optional[str] = None
    events: Optional[list[str]] = None


# ---------- EHR sync & clinical history (Phase 7) ----------
class EHRStatusOut(BaseModel):
    connected: bool
    provider: Optional[str] = None
    configured: bool = False
    detail: Optional[str] = None


class EHRSyncResultOut(BaseModel):
    status: str  # synced | not_configured | unavailable | local_only
    provider: Optional[str] = None
    detail: Optional[str] = None
    synced_at: Optional[datetime] = None


class EHRPrescriptionOut(BaseModel):
    id: str
    name: str
    detail: Optional[str] = None
    status: str
    note: Optional[str] = None


class EHRVisitOut(BaseModel):
    id: str
    title: str
    date_label: Optional[str] = None
    occurred_at: Optional[datetime] = None
    detail: Optional[str] = None


class EHRAppointmentOut(BaseModel):
    id: str
    title: str
    day_label: Optional[str] = None
    time_label: Optional[str] = None
    status: str
    start_at: Optional[datetime] = None


class EHRSourceOut(BaseModel):
    connected: bool
    provider: Optional[str] = None


class PatientHistoryOut(BaseModel):
    patient_id: str
    mrn: str
    name: str
    prescriptions: list[EHRPrescriptionOut] = []
    visits: list[EHRVisitOut] = []
    appointments: list[EHRAppointmentOut] = []
    ehr_source: EHRSourceOut


# ---------- Security ----------
class ComplianceOut(BaseModel):
    hipaa_verified: bool = True
    last_security_audit: str
    data_retention_years: int
    baa_status: str
    encryption_at_rest: str = "AES-256"
    encryption_in_transit: str = "TLS 1.3"


class RoleSummaryOut(BaseModel):
    name: str
    count: int
    detail: str


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    occurred_at: datetime
    action: str
    who: Optional[str] = None
    status: str


# ---------- Billing ----------
class PlanOut(BaseModel):
    plan: str
    status: str = "Active"
    minutes_used: int
    minutes_limit: int
    usage_pct: float
    next_billing_date: Optional[str] = None
    payment_label: str
    payment_expires: str


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    invoice_number: str
    issued_at: datetime
    amount_cents: int
    status: str


# ---------- Support ----------
class SupportTicketCreate(BaseModel):
    subject: str = Field("Technical Issue", max_length=300)
    priority: str = Field("Normal", max_length=50)
    message: str = Field(..., min_length=1, max_length=5000)


class SupportTicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    subject: str
    priority: str
    message: str
    status: str
    created_at: datetime


# ---------- Super Admin ----------
class SuperAdminLoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SuperAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    full_name: str


class AdminOrgListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    plan: str
    suspended: bool
    voice_minutes_used: int
    voice_minutes_limit: int
    user_count: int
    patient_count: int
    created_at: datetime

    @field_validator("suspended", mode="before")
    @classmethod
    def _null_suspended_is_false(cls, v):
        # Organizations created before the `suspended` column existed have
        # NULL there (the additive schema-sync ALTER TABLE doesn't backfill
        # existing rows) — treat "never suspended" (NULL) the same as
        # explicitly-not-suspended (False), never as a validation error.
        return bool(v) if v is not None else False


class AdminOrgUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime


class AdminUserListOut(BaseModel):
    """
    Cross-org user row for the platform-wide /admin/users page. Same
    underlying `User` row as AdminOrgUserOut (nothing new is stored) —
    just annotated with which org it belongs to, since this list spans
    every organization instead of being scoped to one.
    """

    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    org_id: str
    org_name: str


class AdminOrgDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    plan: str
    suspended: bool
    suspended_reason: Optional[str] = None
    voice_minutes_used: int
    voice_minutes_limit: int
    patient_count: int
    call_count: int
    appointment_count: int
    created_at: datetime
    users: list[AdminOrgUserOut]
    # Contact info — reuses the org-scoped ClinicInfo table (the same
    # record the clinic's own Clinic Info settings page reads/writes),
    # not a new field on Organization.
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_address: Optional[str] = None
    contact_website: Optional[str] = None

    @field_validator("suspended", mode="before")
    @classmethod
    def _null_suspended_is_false(cls, v):
        # Same NULL-safety as AdminOrgListOut.suspended above — pre-existing
        # organizations have NULL here, not False.
        return bool(v) if v is not None else False
    # Admin/owner — the org's oldest active admin user, same selection
    # logic already used by POST /admin/organizations/{id}/impersonate.
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None


class AdminOrgUpdateIn(BaseModel):
    plan: Optional[str] = None
    voice_minutes_limit: Optional[int] = Field(None, ge=0)
    suspended: Optional[bool] = None
    suspended_reason: Optional[str] = Field(None, max_length=500)


class AdminUserUpdateIn(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[str] = None

    @field_validator("role")
    @classmethod
    def _valid_role(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("admin", "medical_staff", "ai_agent"):
            raise ValueError("Invalid role.")
        return v


class AdminImpersonateOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    org_id: str
    org_name: str
    acting_as_user_id: str
    acting_as_email: str


class AdminPlanBreakdownOut(BaseModel):
    plan: str
    org_count: int
    voice_minutes_used: int
    voice_minutes_limit: int


class AdminPlatformStatsOut(BaseModel):
    org_count: int
    active_org_count: int
    suspended_org_count: int
    user_count: int
    active_user_count: int
    patient_count: int
    total_calls: int
    calls_today: int
    total_appointments: int
    appointments_today: int
    total_voice_minutes_used: int
    total_voice_minutes_limit: int
    plan_breakdown: list[AdminPlanBreakdownOut]


class AdminRecentActivityItemOut(BaseModel):
    type: str  # org_created | org_suspended | super_admin_action | call_completed
    title: str
    detail: Optional[str] = None
    occurred_at: datetime
    org_id: Optional[str] = None
    org_name: Optional[str] = None


class AdminAuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    occurred_at: datetime
    action: str
    status: str = "success"
    target_org_id: Optional[str] = None
    target_org_name: Optional[str] = None
    target_user_id: Optional[str] = None
    target_user_email: Optional[str] = None
    detail: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    # Who performed the action — resolved from SuperAdmin, never a raw id
    # on its own in the UI.
    super_admin_id: str
    super_admin_name: Optional[str] = None
    super_admin_email: Optional[str] = None


class AdminAuditLogPageOut(BaseModel):
    """Paginated envelope for GET /admin/audit-log (Phase 7)."""

    items: list[AdminAuditLogOut]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---------- Admin: Plans & Subscriptions (Phase 5) ----------
class PlanIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(None, max_length=2000)
    monthly_price_cents: int = Field(0, ge=0)
    voice_minutes_limit: int = Field(0, ge=0)
    user_limit: Optional[int] = Field(None, ge=0)
    patient_limit: Optional[int] = Field(None, ge=0)
    ehr_access: bool = False
    knowledge_base_access: bool = False
    features: list[str] = Field(default_factory=list)
    is_active: bool = True


class PlanUpdateIn(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    description: Optional[str] = Field(None, max_length=2000)
    monthly_price_cents: Optional[int] = Field(None, ge=0)
    voice_minutes_limit: Optional[int] = Field(None, ge=0)
    user_limit: Optional[int] = Field(None, ge=0)
    patient_limit: Optional[int] = Field(None, ge=0)
    ehr_access: Optional[bool] = None
    knowledge_base_access: Optional[bool] = None
    features: Optional[list[str]] = None
    is_active: Optional[bool] = None


class AdminPlanOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    monthly_price_cents: int
    voice_minutes_limit: int
    user_limit: Optional[int] = None
    patient_limit: Optional[int] = None
    ehr_access: bool
    knowledge_base_access: bool
    features: list[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    # Denormalized for the Plans list — how many clinics currently have an
    # active subscription to this plan. Not a stored column.
    subscribed_org_count: int = 0


class AdminSubscriptionOut(BaseModel):
    id: str
    org_id: str
    org_name: str
    plan_id: str
    plan_name: str
    status: str
    started_at: datetime
    updated_at: datetime
    voice_minutes_used: int
    voice_minutes_limit: int


# ---------- Admin: Usage Management (Phase 6) ----------
class AdminUsageClinicOut(BaseModel):
    """
    One clinic's row in the Super Admin usage table. Every count/sum here
    is read straight from existing tables (CallLog, Appointment, Patient,
    KBDocument/KBSource/FAQ, EHRIntegration, APIKey, Organization,
    Subscription/Plan) for the requested date range — nothing here is
    synthesized. Fields the platform genuinely does not track yet
    (e.g. a persisted EHR sync count) are left `None` so the frontend can
    show "Not available" instead of a fabricated number.
    """

    org_id: str
    org_name: str
    plan_name: str
    has_subscription: bool  # False = no Plan(Phase 5) row assigned; legacy Organization.plan is used instead

    # Calls (from CallLog, filtered to the requested date range by occurred_at)
    total_calls: int
    voice_minutes_used_period: float  # sum(duration_seconds)/60 for calls in range; only calls with a recorded duration are counted

    # Appointments (from Appointment, filtered by created_at)
    appointments_total: int
    appointments_ai_booked: int

    # Patients — current roster size (Patient count), not date-filtered,
    # since "how many patients does this clinic have" isn't a period metric.
    patient_count: int
    user_count: int

    # Knowledge base (KBDocument / KBSource / FAQ) — current totals
    kb_document_count: int
    kb_source_count: int
    faq_count: int

    # EHR / API — only what's actually tracked today
    ehr_integrations_connected: int
    ehr_integrations_total: int
    ehr_sync_count: Optional[int] = None  # not persisted anywhere in the system today
    api_keys_active: int

    # Plan limit vs. current (all-time) usage — Organization's running
    # counter, same field the clinic's own Billing page reads.
    plan_voice_minutes_limit: int
    plan_voice_minutes_used_alltime: int
    plan_voice_minutes_usage_pct: float
    plan_user_limit: Optional[int] = None  # None = unlimited (subscribed) or unknown (no subscription)
    plan_patient_limit: Optional[int] = None


class AdminUsageSummaryOut(BaseModel):
    clinic_count: int
    total_calls: int
    total_voice_minutes_used_period: float
    total_appointments: int
    total_ai_appointments: int
    total_patients: int
    total_users: int
    total_kb_documents: int
    total_kb_sources: int
    total_faqs: int
    total_ehr_integrations_connected: int
    total_api_keys_active: int


class AdminUsageOut(BaseModel):
    start_date: date
    end_date: date
    org_id: Optional[str] = None
    summary: AdminUsageSummaryOut
    clinics: list[AdminUsageClinicOut]


class SubscriptionAssignIn(BaseModel):
    org_id: str
    plan_id: str
    status: str = "active"

    @field_validator("status")
    @classmethod
    def _valid_status(cls, v: str) -> str:
        if v not in ("active", "canceled", "past_due"):
            raise ValueError("Invalid status.")
        return v


class SubscriptionStatusUpdateIn(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def _valid_status(cls, v: str) -> str:
        if v not in ("active", "canceled", "past_due"):
            raise ValueError("Invalid status.")
        return v