import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Phone, Calendar, Stethoscope, Pencil, PhoneCall, Play, Pause,
  ChevronRight, ArrowDown, Pill, MapPin, PhoneOff, FileText,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import { Card, Chip, Skeleton, EmptyState, ErrorState } from "../../components/ui";
import PatientFormModal from "../../components/PatientFormModal";
import AppointmentFormModal from "../../components/AppointmentFormModal";
import * as api from "../../lib/api";
import { formatCallTimeLabel } from "../../lib/date";

const TABS = ["Overview", "Call History", "Appointments", "Insurance & Docs"];

const OUTCOME_TONE = {
  Booked: "success",
  "FAQ Answered": "info",
  "Transferred to Nurse": "warning",
};

function CallHistoryTab({ patientId }) {
  const [calls, setCalls] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .listCalls()
      .then((rows) => {
        if (cancelled) return;
        setCalls(rows.filter((c) => c.patient_id === patientId));
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (error) return <ErrorState detail="Couldn't load this patient's call history." className="py-12" />;
  if (!calls) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }
  if (calls.length === 0) {
    return <EmptyState icon={PhoneOff} title="No calls yet" detail="This patient hasn't called or been called by the AI receptionist." className="py-12" />;
  }
  return (
    <div className="space-y-3">
      {calls.map((c) => (
        <div key={c.id} className="rounded-xl border border-outline-variant p-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-on-surface">
              {formatCallTimeLabel(c.started_at) || "—"} {c.duration ? `· ${c.duration}` : ""}
            </p>
            <Chip tone={OUTCOME_TONE[c.outcome] || "neutral"}>{c.outcome || c.status}</Chip>
          </div>
          {c.reason && <p className="mt-1 text-xs text-on-surface-variant">{c.reason}</p>}
        </div>
      ))}
    </div>
  );
}

export default function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("Overview");
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  function load() {
    setLoading(true);
    setError(false);
    return api
      .getPatient(id)
      .then((data) => {
        setPatient(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    api
      .getPatient(id)
      .then((data) => {
        if (cancelled) return;
        setPatient(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
      audioRef.current?.pause();
    };
  }, [id]);

  function togglePlay(interaction) {
    if (!interaction.audio_url) return;
    if (playingId === interaction.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(interaction.audio_url);
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    audio.play();
    setPlayingId(interaction.id);
  }

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-64 w-full rounded-2xl lg:col-span-2" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !patient) {
    return (
      <AppShell>
        <EmptyState
          icon={ArrowLeft}
          title={error ? "Couldn't load this patient" : "Patient not found"}
          detail={error ? "Something went wrong loading this profile." : "This patient may have been removed."}
          action={
            error ? (
              <button onClick={load} className="focus-ring text-sm font-semibold" style={{ color: "#059669" }}>
                Try again
              </button>
            ) : undefined
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <button onClick={() => navigate("/app/patients")} className="focus-ring mb-4 flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant hover:text-on-surface">
        <ArrowLeft size={16} /> Patient Profile
      </button>

      <Card className="p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#0f172a] text-lg font-bold text-white">
              {patient.initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-bold text-on-surface">{patient.name}</h1>
                <Chip tone="success">{patient.status}</Chip>
              </div>
              <p className="text-xs text-on-surface-variant">ID: {patient.mrn}</p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-on-surface-variant">
                {patient.dob && (
                  <span className="flex items-center gap-1.5"><Calendar size={14} /> {patient.dob} {patient.age ? `(${patient.age} y/o)` : ""}</span>
                )}
                {patient.phone && <span className="flex items-center gap-1.5"><Phone size={14} /> {patient.phone}</span>}
                {patient.doctor && <span className="flex items-center gap-1.5"><Stethoscope size={14} /> {patient.doctor}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="focus-ring flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              <Pencil size={14} /> Edit
            </button>
            <button
              disabled
              title="Placing a live call from the dashboard isn't available yet — this requires integration with the voice call system."
              aria-disabled="true"
              className="focus-ring flex cursor-not-allowed items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white opacity-50"
              style={{ backgroundColor: "#059669" }}
            >
              <PhoneCall size={14} /> Init Call
            </button>
          </div>
        </div>

        <div className="mt-6 flex gap-6 overflow-x-auto border-b border-outline-variant">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`focus-ring whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${tab === t ? "border-[#059669] text-on-surface" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </Card>

      {tab === "Overview" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center gap-2">
              <Pill size={16} style={{ color: "#059669" }} />
              <h2 className="font-display text-base font-bold text-on-surface">Active Prescriptions</h2>
            </div>
            {patient.prescriptions.length === 0 ? (
              <p className="mt-4 text-sm text-on-surface-variant">No prescriptions on file.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {patient.prescriptions.map((rx) => (
                  <div key={rx.id} className="flex items-center justify-between rounded-xl border border-outline-variant p-3.5">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">{rx.name}</p>
                      <p className="text-xs text-on-surface-variant">{rx.detail}</p>
                    </div>
                    <div className="text-right">
                      <Chip tone={rx.status === "Refill Soon" ? "warning" : "success"}>{rx.status}</Chip>
                      <p className="mt-1 text-xs text-on-surface-variant">{rx.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-7 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-on-surface">Recent AI Interactions</h2>
              <span className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Live agent available
              </span>
            </div>
            {patient.interactions.length === 0 ? (
              <p className="mt-4 text-sm text-on-surface-variant">No AI interactions yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {patient.interactions.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 rounded-xl border border-outline-variant p-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-on-surface">{it.title}</p>
                      <p className="text-xs text-on-surface-variant">{it.date_label} — {it.detail}</p>
                    </div>
                    {it.has_audio && it.audio_url ? (
                      <button
                        onClick={() => togglePlay(it)}
                        className="focus-ring flex shrink-0 items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold hover:bg-surface-container"
                      >
                        {playingId === it.id ? <Pause size={12} /> : <Play size={12} />} {it.duration}
                      </button>
                    ) : it.has_audio ? (
                      <span className="shrink-0 text-xs text-on-surface-variant">{it.duration}</span>
                    ) : (
                      <ChevronRight size={16} className="shrink-0 text-on-surface-variant" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="font-display text-base font-bold text-on-surface">Latest Vitals</h2>
              {!patient.vitals_bp && !patient.vitals_hr ? (
                <p className="mt-4 text-sm text-on-surface-variant">No vitals recorded.</p>
              ) : (
                <>
                  <div className="mt-4 space-y-4">
                    {patient.vitals_bp && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-on-surface-variant">Blood Pressure</span>
                        <span className="flex items-center gap-1 text-sm font-semibold text-on-surface">
                          {patient.vitals_bp}
                          {patient.vitals_bp_trend === "down" && <ArrowDown size={13} className="text-green-600" />}
                        </span>
                      </div>
                    )}
                    {patient.vitals_hr && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-on-surface-variant">Heart Rate</span>
                        <span className="text-sm font-semibold text-on-surface">{patient.vitals_hr}</span>
                      </div>
                    )}
                    {patient.vitals_weight && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-on-surface-variant">Weight</span>
                        <span className="text-sm font-semibold text-on-surface">{patient.vitals_weight}</span>
                      </div>
                    )}
                  </div>
                  {patient.vitals_recorded && (
                    <p className="mt-4 text-xs text-on-surface-variant">Recorded: {patient.vitals_recorded}</p>
                  )}
                </>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-on-surface">Appointments</h2>
                <button onClick={() => setShowSchedule(true)} className="focus-ring text-sm font-semibold" style={{ color: "#059669" }}>Schedule New</button>
              </div>
              {patient.appointments.length === 0 ? (
                <p className="mt-4 text-sm text-on-surface-variant">No appointments scheduled.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {patient.appointments.map((a) => (
                    <div key={a.id} className="rounded-xl border border-outline-variant p-3.5">
                      <p className="text-sm font-semibold text-on-surface">{a.title}</p>
                      <p className="text-xs text-on-surface-variant">{a.time_label || a.day_label}</p>
                      {a.location && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-on-surface-variant">
                          <MapPin size={12} /> {a.location}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "Call History" && (
        <Card className="mt-6 p-6">
          <CallHistoryTab patientId={patient.id} />
        </Card>
      )}

      {tab === "Appointments" && (
        <Card className="mt-6 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-on-surface">All Appointments</h2>
            <button onClick={() => setShowSchedule(true)} className="focus-ring text-sm font-semibold" style={{ color: "#059669" }}>Schedule New</button>
          </div>
          {patient.appointments.length === 0 ? (
            <EmptyState icon={Calendar} title="No appointments" detail="This patient has no appointments on record." className="py-12" />
          ) : (
            <div className="mt-4 space-y-3">
              {patient.appointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl border border-outline-variant p-3.5">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{a.title}</p>
                    <p className="text-xs text-on-surface-variant">{a.time_label || a.day_label}</p>
                    {a.location && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-on-surface-variant">
                        <MapPin size={12} /> {a.location}
                      </p>
                    )}
                  </div>
                  <Chip tone={a.status === "cancelled" ? "error" : "success"}>{a.status}</Chip>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "Insurance & Docs" && (
        <Card className="mt-6 p-6">
          <EmptyState
            icon={FileText}
            title="No insurance or documents on file"
            detail="MedVoice AI doesn't yet store per-patient insurance details or documents — this will appear here once that's added to the clinical record."
            className="py-12"
          />
        </Card>
      )}

      <PatientFormModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        patient={patient}
        onSaved={(updated) => setPatient((p) => ({ ...p, ...updated }))}
      />
      <AppointmentFormModal
        open={showSchedule}
        onClose={() => setShowSchedule(false)}
        defaultPatient={patient}
        onSaved={(appt) => setPatient((p) => ({ ...p, appointments: [...p.appointments, appt] }))}
      />
    </AppShell>
  );
}