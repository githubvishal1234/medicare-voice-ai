"""
Patient-facing appointment notifications (email + WhatsApp).

Mirrors ehr_service.py's philosophy: this is a side effect of booking, not
part of it. A misconfigured or down notification channel must never turn
a successful booking into an error for the caller/staff. Each channel is
independently optional — skip silently (with a log line) if its settings
aren't filled in, rather than failing.

Routers should call `notify_appointment_booked(...)` from inside a
BackgroundTasks callback (see routers/appointments.py) so the HTTP
response for the booking itself never waits on an SMTP/Twilio round trip.
"""

import logging
import smtplib
from email.message import EmailMessage
from typing import Optional

import httpx

from . import models
from .config import settings

logger = logging.getLogger("notification-service")


def _format_when(appt: models.Appointment) -> str:
    day = appt.day_label or (appt.start_at.strftime("%a, %b %-d") if appt.start_at else "")
    time = appt.time_label or (appt.start_at.strftime("%-I:%M %p") if appt.start_at else "")
    return f"{day} at {time}".strip(" at")


def _email_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_from_email)


def _whatsapp_configured() -> bool:
    return bool(settings.twilio_account_sid and settings.twilio_auth_token and settings.whatsapp_from_number)


def _send_email(to_email: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    msg["To"] = to_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.notification_http_timeout_seconds) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
        logger.info(f"Sent appointment email to {to_email}")
    except Exception as e:
        # Never propagate — a failed confirmation email must not affect
        # the booking that already succeeded.
        logger.warning(f"Failed to send appointment email to {to_email}: {e}")


def _send_whatsapp(to_phone: str, body: str) -> None:
    # Twilio's WhatsApp numbers must be prefixed "whatsapp:", e.g.
    # "whatsapp:+919652359002". Accept a bare phone number and add the
    # prefix if it's missing.
    to = to_phone if to_phone.startswith("whatsapp:") else f"whatsapp:{to_phone}"

    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
    try:
        resp = httpx.post(
            url,
            auth=(settings.twilio_account_sid, settings.twilio_auth_token),
            data={
                "From": settings.whatsapp_from_number,
                "To": to,
                "Body": body,
            },
            timeout=settings.notification_http_timeout_seconds,
        )
        if resp.status_code >= 400:
            logger.warning(f"Twilio WhatsApp send to {to} failed: {resp.status_code} {resp.text}")
        else:
            logger.info(f"Sent appointment WhatsApp message to {to}")
    except Exception as e:
        logger.warning(f"Failed to send appointment WhatsApp message to {to}: {e}")


def notify_appointment_booked(
    patient: models.Patient,
    appt: models.Appointment,
    doctor: Optional[models.Doctor],
    clinic_name: str = "our clinic",
) -> None:
    """
    Fire-and-forget: sends an appointment-confirmed message over whichever
    of email/WhatsApp are configured AND the patient has contact info for.
    Call this from a BackgroundTasks callback, not inline in the request.
    """
    when = _format_when(appt)
    doctor_line = f" with {doctor.name}" if doctor else ""

    if patient.email and _email_configured():
        subject = f"Appointment confirmed — {when}"
        body = (
            f"Hi {patient.name},\n\n"
            f"Your appointment{doctor_line} at {clinic_name} is confirmed for {when}.\n\n"
            f"If you need to reschedule or cancel, just call us back.\n\n"
            f"— {clinic_name}"
        )
        _send_email(patient.email, subject, body)
    elif patient.email:
        logger.info("Patient has email but SMTP isn't configured — skipping email confirmation")

    if patient.phone and _whatsapp_configured():
        body = (
            f"Hi {patient.name}, your appointment{doctor_line} at {clinic_name} "
            f"is confirmed for {when}. Reply or call us if you need to reschedule."
        )
        _send_whatsapp(patient.phone, body)
    elif patient.phone:
        logger.info("Patient has phone but WhatsApp/Twilio isn't configured — skipping WhatsApp confirmation")


def notify_appointment_cancelled(
    patient: models.Patient,
    appt: models.Appointment,
    doctor: Optional[models.Doctor],
    clinic_name: str = "our clinic",
) -> None:
    when = _format_when(appt)
    doctor_line = f" with {doctor.name}" if doctor else ""

    if patient.email and _email_configured():
        _send_email(
            patient.email,
            "Appointment cancelled",
            f"Hi {patient.name},\n\nYour appointment{doctor_line} for {when} at {clinic_name} has been cancelled.\n\n— {clinic_name}",
        )
    if patient.phone and _whatsapp_configured():
        _send_whatsapp(
            patient.phone,
            f"Hi {patient.name}, your appointment{doctor_line} for {when} at {clinic_name} has been cancelled.",
        )
