import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Card, Button } from "./ui";
import * as api from "../lib/api";
import { ApiError } from "../lib/api";

const inputClass =
  "focus-ring w-full rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/70";
const labelClass = "mb-1.5 block text-sm font-medium text-on-surface";

/**
 * Edit-patient form, used from the Patient Profile page's "Edit" button.
 * `patient` is always a loaded, existing patient at the only current call
 * site (PatientProfile only renders this after its own loading/error guard),
 * so this only PATCHes — it doesn't handle patient creation (there is
 * intentionally no "New Patient" entry point in this app).
 */
export default function PatientFormModal({ open, onClose, patient, onSaved }) {
  const [name, setName] = useState("");
  const [mrn, setMrn] = useState("");
  const [dob, setDob] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [doctor, setDoctor] = useState("");
  const [status, setStatus] = useState("Active");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitting(false);
    setName(patient?.name || "");
    setMrn(patient?.mrn || "");
    setDob(patient?.dob || "");
    setAge(patient?.age != null ? String(patient.age) : "");
    setPhone(patient?.phone || "");
    setEmail(patient?.email || "");
    setDoctor(patient?.doctor || "");
    setStatus(patient?.status || "Active");
  }, [open, patient]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!patient?.id) {
      setError("Couldn't determine which patient to update.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const updated = await api.updatePatient(patient.id, {
        name: name.trim(),
        mrn: mrn.trim() || undefined,
        dob: dob.trim() || undefined,
        age: age !== "" ? Number(age) : undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        doctor: doctor.trim() || undefined,
        status,
      });
      onSaved?.(updated);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save changes. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={submitting ? undefined : onClose} />
      <Card className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-on-surface">Edit Patient</h2>
          <button
            onClick={onClose}
            className="focus-ring rounded-md p-1 text-on-surface-variant hover:bg-surface-container"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="patient-name">Name</label>
            <input
              id="patient-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="patient-mrn">MRN</label>
              <input
                id="patient-mrn"
                type="text"
                value={mrn}
                onChange={(e) => setMrn(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="patient-status">Status</label>
              <select
                id="patient-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputClass}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="patient-dob">Date of Birth</label>
              <input
                id="patient-dob"
                type="text"
                placeholder="MM/DD/YYYY"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="patient-age">Age</label>
              <input
                id="patient-age"
                type="number"
                min="0"
                max="150"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="patient-phone">Phone</label>
            <input
              id="patient-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="patient-email">Email</label>
            <input
              id="patient-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="patient-doctor">Doctor</label>
            <input
              id="patient-doctor"
              type="text"
              value={doctor}
              onChange={(e) => setDoctor(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
