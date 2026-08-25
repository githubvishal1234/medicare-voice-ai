import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Card, Button } from "./ui";
import * as api from "../lib/api";
import { ApiError } from "../lib/api";

// Mirrors the backend's own label formatting (see _format_day_label /
// _format_time_label in app/routers/appointments.py) so an appointment
// created here displays identically to one the voice agent books.
function formatDayLabel(date) {
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const month = date.toLocaleDateString(undefined, { month: "short" });
  return `${weekday}, ${month} ${date.getDate()}`;
}
function formatTimeLabel(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const inputClass =
  "focus-ring w-full rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/70";
const labelClass = "mb-1.5 block text-sm font-medium text-on-surface";

/**
 * Staff-facing "book an appointment" form. Posts to the freeform
 * POST /appointments endpoint (see appointments.py) rather than the voice
 * agent's validated /appointments/book — staff can schedule outside a
 * doctor's normal slot grid (e.g. a quick admin entry), so this
 * intentionally doesn't enforce the same slot/availability rules.
 *
 * If `defaultPatient` is supplied (e.g. from the Patient Profile page) the
 * patient is fixed and the picker is hidden; otherwise the caller (the
 * Appointments page) lets staff pick any patient from the org.
 */
export default function AppointmentFormModal({ open, onClose, defaultPatient, onSaved }) {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [location, setLocation] = useState("Main Clinic");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitting(false);
    setPatientId(defaultPatient?.id || "");
    setDoctorId("");
    setTitle("");
    setDate("");
    setTime("");
    setReason("");
    setLocation("Main Clinic");
    if (!defaultPatient) {
      api.listPatients().then(setPatients).catch(() => setPatients([]));
    }
    api.listDoctors().then(setDoctors).catch(() => setDoctors([]));
  }, [open, defaultPatient]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();

    const patient = defaultPatient || patients.find((p) => p.id === patientId);
    if (!patient) {
      setError("Please select a patient.");
      return;
    }
    if (!date || !time) {
      setError("Please choose a date and time.");
      return;
    }
    const startAt = new Date(`${date}T${time}`);
    if (Number.isNaN(startAt.getTime())) {
      setError("That date/time isn't valid.");
      return;
    }

    const doctor = doctors.find((d) => d.id === doctorId);
    const durationMinutes = doctor?.slot_minutes || 30;
    const endAt = new Date(startAt.getTime() + durationMinutes * 60000);
    const finalTitle = title.trim() || (doctor ? `Appointment with ${doctor.name}` : "Appointment");

    setError(null);
    setSubmitting(true);
    try {
      const appt = await api.createAppointment({
        title: finalTitle,
        patient_id: patient.id,
        patient_name: patient.name,
        doctor_id: doctor?.id || undefined,
        reason: reason.trim() || undefined,
        day_label: formatDayLabel(startAt),
        time_label: formatTimeLabel(startAt),
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        location: location.trim() || undefined,
        status: "upcoming",
        ai_generated: false,
      });
      onSaved?.(appt);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the appointment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={submitting ? undefined : onClose} />
      <Card className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-on-surface">New Appointment</h2>
          <button
            onClick={onClose}
            className="focus-ring rounded-md p-1 text-on-surface-variant hover:bg-surface-container"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {defaultPatient ? (
            <div>
              <label className={labelClass}>Patient</label>
              <p className="rounded-lg border border-outline-variant bg-surface-low px-3 py-2.5 text-sm text-on-surface">
                {defaultPatient.name}
              </p>
            </div>
          ) : (
            <div>
              <label className={labelClass} htmlFor="appt-patient">Patient</label>
              <select
                id="appt-patient"
                required
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>Select a patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.mrn ? ` (${p.mrn})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor="appt-doctor">Doctor</label>
            <select
              id="appt-doctor"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className={inputClass}
            >
              <option value="">No preference</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.specialty ? ` — ${d.specialty}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="appt-date">Date</label>
              <input
                id="appt-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="appt-time">Time</label>
              <input
                id="appt-time"
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="appt-reason">Reason (optional)</label>
            <input
              id="appt-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Follow-up, annual physical"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="appt-location">Location (optional)</label>
            <input
              id="appt-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Scheduling…" : "Schedule"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
