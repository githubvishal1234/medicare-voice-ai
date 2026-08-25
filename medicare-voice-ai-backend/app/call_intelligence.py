"""
Rule-based call-intelligence helpers: AI call summary and sentiment
inference, generated purely from data already stored on a CallLog
(transcript messages, reason, outcome, actions taken).

Consistent with the knowledge_base router's keyword-matching approach,
this stays dependency-free (no external NLP/LLM call) so it works
out-of-the-box in any environment. All of it runs server-side, on the
backend, so the voice agent never needs to know how a summary is built.
"""

import re

from . import models

_NEGATIVE_WORDS = {
    "angry", "upset", "frustrated", "annoyed", "worried", "urgent",
    "pain", "hurts", "hurting", "emergency", "terrible", "worse",
    "complain", "complaint", "unhappy", "disappointed", "cancel",
    "cancelled", "wrong", "mistake", "confused", "help me", "scared",
}
_POSITIVE_WORDS = {
    "thanks", "thank you", "great", "perfect", "appreciate", "wonderful",
    "awesome", "helpful", "good", "excellent", "happy", "sounds good",
}

_BOOKING_HINTS = {"book", "booked", "appointment", "schedule", "scheduled"}
_RESCHEDULE_HINTS = {"reschedule", "rescheduled", "move", "moved", "change"}
_CANCEL_HINTS = {"cancel", "cancelled", "canceled"}
_TRANSFER_HINTS = {"transfer", "transferred", "staff", "nurse", "human"}


def _patient_texts(call: models.CallLog) -> list[str]:
    return [m.text for m in call.transcript_messages if m.who == "patient" and m.text]


def infer_sentiment(call: models.CallLog) -> str:
    """Best-effort sentiment label (Positive | Neutral | Concerned) from
    the patient's side of the transcript."""
    text = " ".join(_patient_texts(call)).lower()
    if not text:
        return "Neutral"

    neg_hits = sum(1 for w in _NEGATIVE_WORDS if w in text)
    pos_hits = sum(1 for w in _POSITIVE_WORDS if w in text)

    if neg_hits > pos_hits:
        return "Concerned"
    if pos_hits > 0:
        return "Positive"
    return "Neutral"


def infer_outcome(call: models.CallLog) -> str:
    """Best-effort outcome label from actions_taken (set by the voice
    agent as its tools succeed) or, failing that, the transcript."""
    if call.actions_taken:
        actions = [a.strip().lower() for a in call.actions_taken.splitlines() if a.strip()]
        if actions:
            last = actions[-1]
            if any(h in last for h in _CANCEL_HINTS):
                return "Cancelled"
            if any(h in last for h in _RESCHEDULE_HINTS):
                return "Rescheduled"
            if any(h in last for h in _BOOKING_HINTS):
                return "Booked"
            if any(h in last for h in _TRANSFER_HINTS):
                return "Transferred to Staff"
            return "FAQ Answered"

    if call.status == "failed":
        return "Call Failed"
    if call.status == "no_answer":
        return "No Answer"

    all_text = " ".join(m.text.lower() for m in call.transcript_messages if m.text)
    if any(h in all_text for h in _CANCEL_HINTS):
        return "Cancelled"
    if any(h in all_text for h in _RESCHEDULE_HINTS):
        return "Rescheduled"
    if any(h in all_text for h in _BOOKING_HINTS):
        return "Booked"
    if any(h in all_text for h in _TRANSFER_HINTS):
        return "Transferred to Staff"
    return "Completed" if call.transcript_messages else "No Interaction"


def format_duration_label(duration_seconds: int) -> str:
    minutes, seconds = divmod(max(0, int(duration_seconds)), 60)
    if minutes:
        return f"{minutes}m {seconds}s"
    return f"{seconds}s"


def generate_summary(call: models.CallLog) -> str:
    """
    Builds a short, human-readable call summary from what's already on
    the CallLog record: caller, reason, key actions, and outcome. Falls
    back gracefully when a field wasn't captured.
    """
    who = call.patient_name or "The caller"
    parts: list[str] = []

    opener = f"{who} called"
    if call.reason:
        opener += f" regarding {call.reason.strip().rstrip('.')}"
    parts.append(opener + ".")

    if call.actions_taken:
        actions = [a.strip() for a in call.actions_taken.splitlines() if a.strip()]
        if actions:
            parts.append("Actions taken: " + "; ".join(actions) + ".")

    outcome = call.outcome or infer_outcome(call)
    parts.append(f"Outcome: {outcome}.")

    if call.status == "failed":
        parts.append("The call could not be completed.")
    elif call.status == "no_answer":
        parts.append("The call was not answered.")

    patient_msgs = _patient_texts(call)
    if patient_msgs and not call.reason:
        first = re.sub(r"\s+", " ", patient_msgs[0]).strip()
        if first:
            snippet = first if len(first) <= 140 else first[:137] + "..."
            parts.append(f'Caller opened with: "{snippet}"')

    return " ".join(parts)