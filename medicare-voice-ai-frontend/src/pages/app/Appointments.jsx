import { useEffect, useState, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Bot, Check, X, RefreshCw, ClipboardCheck, Plus } from "lucide-react";
import AppShell from "../../components/AppShell";
import { Card, EmptyState, Skeleton, ErrorState, Button } from "../../components/ui";
import AppointmentFormModal from "../../components/AppointmentFormModal";
import * as api from "../../lib/api";
import * as dateUtil from "../../lib/date";

// Covers both seeded doctors' working hours (8AM–5PM / 9AM–5PM, see seed.py)
// with an extra hour of buffer on each side so a booking right at the edge
// of a doctor's schedule still has a row to land in.
const HOURS = [
  "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM",
];
 
export default function Appointments() {
  const [view, setView] = useState("Week");
  // Always starts on the real current date/time — never a fixed date.
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [appointments, setAppointments] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
 
  // The set of calendar days to render for the active view, always derived
  // from `anchorDate` (which starts at `new Date()` and moves via
  // Previous/Next) so the grid is never a hardcoded date range.
  const gridDays = useMemo(() => {
    if (view === "Day") return [anchorDate];
    if (view === "Month") return dateUtil.getMonthGrid(anchorDate).flat();
    return dateUtil.getWeekdays(anchorDate); // Week
  }, [view, anchorDate]);
 
  const dayColumns = useMemo(
    () => gridDays.map((d) => ({ date: d, key: dateUtil.dayKey(d), label: dateUtil.relativeDayLabel(d) })),
    [gridDays]
  );
 
  const headerLabel =
    view === "Day"
      ? dateUtil.formatDayHeader(anchorDate)
      : view === "Month"
      ? dateUtil.formatMonthHeader(anchorDate)
      : dateUtil.formatWeekRangeHeader(anchorDate);
 
  function goPrevious() {
    setAnchorDate((d) => {
      if (view === "Day") return dateUtil.addDays(d, -1);
      if (view === "Month") return dateUtil.addMonths(d, -1);
      return dateUtil.addDays(d, -7); // Week
    });
  }
 
  function goNext() {
    setAnchorDate((d) => {
      if (view === "Day") return dateUtil.addDays(d, 1);
      if (view === "Month") return dateUtil.addMonths(d, 1);
      return dateUtil.addDays(d, 7); // Week
    });
  }
 
  const loadAll = useCallback(() => {
    setLoading(true);
    setError(false);
    return Promise.all([api.listAppointments(), api.listPendingBookings()])
      .then(([appts, pending]) => {
        setAppointments(appts);
        setPendingBookings(pending);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAll().catch(() => {});
    return () => {
      cancelled = true;
    };
    // loadAll already guards its own state updates; cancelled kept for parity
    // with the effect-cleanup pattern used elsewhere in this file.
  }, [loadAll]);
 
  async function verify(id) {
    setPendingBookings((prev) => prev.filter((b) => b.id !== id));
    try {
      await api.verifyPendingBooking(id);
      api.listAppointments().then(setAppointments);
    } catch {
      // Roll back the optimistic removal so the item isn't silently lost.
      api.listPendingBookings().then(setPendingBookings);
    }
  }
 
  async function decline(id) {
    setPendingBookings((prev) => prev.filter((b) => b.id !== id));
    try {
      await api.declinePendingBooking(id);
    } catch {
      api.listPendingBookings().then(setPendingBookings);
    }
  }
 
  // Match appointments to a grid cell by the actual `start_at` timestamp
  // rather than the backend's `day_label`/`time_label` strings — those are
  // formatted differently ("Wed, Aug 19" / "10:00 AM") than this calendar's
  // own day keys ("Wed 19"), so a string-equality match against them never
  // hits and every booking silently fails to render. Bucketed by hour only
  // (not exact minute) so appointments booked off the hour — e.g. a 20-minute
  // slot doctor's 9:20 booking — still land in the 9:00 AM row instead of
  // vanishing because no HOURS label matches their exact minute.
  const cell = (dayKey, hour) =>
    appointments.filter((a) => {
      if (!a.start_at) return false;
      const d = new Date(a.start_at);
      const bucket = new Date(d);
      bucket.setMinutes(0, 0, 0);
      return dateUtil.dayKey(d) === dayKey && dateUtil.hourLabel(bucket) === hour;
    });
  const dayCount = (dayKey) =>
    appointments.filter((a) => a.start_at && dateUtil.dayKey(new Date(a.start_at)) === dayKey).length;
 
  return (
    <AppShell title="Appointment Manager" subtitle="A live view of every booking, synced with your EHR.">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-lowest p-1">
          <button
            onClick={goPrevious}
            aria-label={`Previous ${view.toLowerCase()}`}
            className="focus-ring rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="px-2 text-sm font-semibold text-on-surface">{headerLabel}</span>
          <button
            onClick={goNext}
            aria-label={`Next ${view.toLowerCase()}`}
            className="focus-ring rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-lowest p-1">
          {["Day", "Week", "Month"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`focus-ring rounded-md px-3 py-1.5 text-sm font-semibold transition ${view === v ? "text-white" : "text-on-surface-variant hover:bg-surface-container"}`}
              style={view === v ? { backgroundColor: "#059669" } : undefined}
            >
              {v}
            </button>
          ))}
        </div>
        <Button onClick={() => setShowNewAppointment(true)} className="px-3.5 py-2">
          <Plus size={15} /> New Appointment
        </Button>
        <div className="ml-auto flex items-center gap-2 text-sm font-medium text-on-surface-variant">
          <RefreshCw size={14} />
          Epic EHR Synced (1m ago)
        </div>
      </div>
 
      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="overflow-x-auto lg:col-span-3">
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : error ? (
            <ErrorState detail="We couldn't load your appointments." onRetry={loadAll} className="py-20" />
          ) : view === "Month" ? (
            <div className="min-w-[640px] p-2">
              <div className="grid grid-cols-7 border-b border-outline-variant bg-surface-low">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((wd) => (
                  <div key={wd} className="px-2 py-3 text-center text-sm font-semibold text-on-surface">{wd}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {dayColumns.map((col) => {
                  const inMonth = col.date.getMonth() === anchorDate.getMonth();
                  const count = dayCount(col.key);
                  return (
                    <div
                      key={col.date.toISOString()}
                      className={`min-h-[80px] border-b border-l border-outline-variant p-2 ${inMonth ? "" : "opacity-40"}`}
                    >
                      <p className="text-xs font-semibold text-on-surface">
                        {col.label === "Today" || col.label === "Tomorrow" ? col.label : col.date.getDate()}
                      </p>
                      {count > 0 && (
                        <p className="mt-1 text-[11px] font-medium" style={{ color: "#059669" }}>
                          {count} booking{count === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={view === "Day" ? "min-w-[280px]" : "min-w-[640px]"}>
              <div className={`grid border-b border-outline-variant bg-surface-low ${view === "Day" ? "grid-cols-[70px_1fr]" : "grid-cols-[70px_repeat(5,1fr)]"}`}>
                <div />
                {dayColumns.map((col) => (
                  <div key={col.key} className="px-2 py-3 text-center text-sm font-semibold text-on-surface">{col.label}</div>
                ))}
              </div>
              {HOURS.map((h) => (
                <div key={h} className={`grid border-b border-outline-variant ${view === "Day" ? "grid-cols-[70px_1fr]" : "grid-cols-[70px_repeat(5,1fr)]"}`}>
                  <div className="px-2 py-3 text-right text-xs text-on-surface-variant">{h}</div>
                  {dayColumns.map((col) => (
                    <div key={col.key} className="min-h-[64px] border-l border-outline-variant p-1">
                      {cell(col.key, h).map((a) => (
                        <div key={a.id} className="rounded-md border-l-2 bg-[#f0fdfa] p-1.5" style={{ borderColor: "#059669" }}>
                          <div className="flex items-center gap-1">
                            {a.ai_generated && <Bot size={11} style={{ color: "#059669" }} />}
                            <p className="truncate text-[11px] font-semibold text-on-surface">{a.title}</p>
                          </div>
                          <p className="truncate text-[11px] text-on-surface-variant">{a.patient_name}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Card>
 
        <Card className="p-5">
          <div className="mb-1 flex items-center gap-2">
            <Bot size={16} style={{ color: "#059669" }} />
            <h2 className="font-display text-base font-bold text-on-surface">AI Bookings to Verify</h2>
          </div>
          <p className="mb-4 text-xs text-on-surface-variant">Require staff review before sync.</p>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : pendingBookings.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="All caught up"
              detail="No AI bookings are waiting on staff review."
              className="py-8"
            />
          ) : (
            <div className="space-y-3">
              {pendingBookings.map((b) => (
                <div key={b.id} className="rounded-xl border border-outline-variant p-3.5 transition-colors hover:bg-surface-low">
                  <p className="text-sm font-semibold text-on-surface">{b.patient_name}</p>
                  <p className="text-xs text-on-surface-variant">{b.type_label}</p>
                  <p className="mt-1 text-xs font-medium text-on-surface">{b.when_label}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => verify(b.id)}
                      className="focus-ring flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: "#059669" }}
                    >
                      <Check size={13} /> Verify
                    </button>
                    <button
                      onClick={() => decline(b.id)}
                      className="focus-ring flex flex-1 items-center justify-center gap-1 rounded-lg border border-outline-variant py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
                    >
                      <X size={13} /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <AppointmentFormModal
        open={showNewAppointment}
        onClose={() => setShowNewAppointment(false)}
        onSaved={(appt) => setAppointments((prev) => [...prev, appt])}
      />
    </AppShell>
  );
}