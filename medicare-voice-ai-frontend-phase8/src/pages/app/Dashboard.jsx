import { useCallback, useEffect, useState } from "react";
import { Phone, ClipboardCheck, Clock3, MoreVertical, CheckCircle2, PhoneOff, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppShell from "../../components/AppShell";
import { Card, Chip, Skeleton, EmptyState, ErrorState } from "../../components/ui";
import * as api from "../../lib/api";
import { useRealtime } from "../../lib/realtime";
import { formatCallTimeLabel } from "../../lib/date";

const STAT_CARDS = [
  { key: "calls_handled_today", label: "Calls Handled Today", icon: Phone, format: (v) => `${v}` },
  { key: "appointments_booked_today", label: "Appointments Booked", icon: ClipboardCheck, format: (v) => `${v}` },
  { key: "resolution_rate_pct", label: "Resolution Rate", icon: CheckCircle2, format: (v) => `${v}%` },
  { key: "staff_time_saved_hrs", label: "Staff Time Saved", icon: Clock3, format: (v) => `${v} hrs` },
];

const STATUS_TONE = {
  in_progress: "info",
  completed: "success",
  failed: "error",
  no_answer: "neutral",
};

const STATUS_LABEL = {
  in_progress: "In Progress",
  completed: "Completed",
  failed: "Failed",
  no_answer: "No Answer",
};

function initials(name) {
  return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

// Dashboard's actual content lives in DashboardBody, which is rendered as a
// *child* of AppShell (see the default export below). AppShell is what
// mounts RealtimeProvider, so useRealtime() must be called from a component
// that renders underneath it — not from the component that renders AppShell
// itself, since at that point RealtimeProvider isn't in the tree yet.
function DashboardBody() {
  const navigate = useNavigate();
  const { liveCalls, seedLiveCalls, subscribe } = useRealtime();

  const [stats, setStats] = useState(null);
  const [volume, setVolume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Initial load: dashboard stats, hourly call volume, and any calls already
  // in progress (so the live panel isn't empty until the next WS event).
  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([api.getDashboardStats(), api.getCallVolume(), api.listCalls()])
      .then(([statsRes, volumeRes, callsRes]) => {
        if (cancelled) return;
        setStats(statsRes);
        setVolume(volumeRes);
        seedLiveCalls(callsRes.filter((c) => c.status === "in_progress" && !c.ended_at));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [seedLiveCalls]);

  useEffect(() => {
    return load();
  }, [load]);

  // Keep stats/volume fresh as calls finish and appointments change, without
  // requiring a page refresh — the live-call panel itself is driven directly
  // by RealtimeProvider's liveCalls state.
  useEffect(() => {
    const refresh = () => {
      api.getDashboardStats().then(setStats);
      api.getCallVolume().then(setVolume);
    };
    const unsubs = [
      subscribe("call.ended", refresh),
      subscribe("appointment.booked", refresh),
      subscribe("appointment.cancelled", refresh),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [subscribe]);

  // Safety-net reconciliation for "Live Active Calls": call.ended is pushed
  // over the dashboard WebSocket, but if that single message is missed
  // (a reconnect gap, a dropped frame, the tab regaining focus after
  // sleep, etc.) there's no replay — the panel would otherwise show a
  // call as "In Progress" forever after it actually ended. Periodically
  // re-syncing from the same REST source used on initial load (listCalls)
  // via seedLiveCalls — which already drops any call in a terminal status
  // (completed | failed | no_answer) — self-heals that drift without
  // touching the WS-driven fast path above.
  useEffect(() => {
    const reconcile = () => {
      api.listCalls().then(seedLiveCalls).catch(() => {});
    };
    const interval = setInterval(reconcile, 10000);
    return () => clearInterval(interval);
  }, [seedLiveCalls]);

  const maxVolume = volume ? Math.max(1, ...volume.hours) : 1;

  if (error) {
    return <ErrorState detail="We couldn't load your dashboard." onRetry={load} className="py-24" />;
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((s) => (
          <Card key={s.key} hoverable className="p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{s.label}</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container">
                <s.icon size={15} className="text-on-surface-variant" />
              </div>
            </div>
            {loading || !stats ? (
              <Skeleton className="mt-4 h-8 w-20" />
            ) : (
              <div className="mt-3 flex items-baseline gap-2">
                <p className="font-display text-3xl font-extrabold text-on-surface">{s.format(stats[s.key])}</p>
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${liveCalls.length > 0 ? "bg-red-500 animate-pulse" : "bg-outline-variant"}`} />
              <h2 className="font-display text-lg font-bold text-on-surface">Live Active Calls</h2>
            </div>
            <button onClick={() => navigate("/app/calls")} className="focus-ring text-sm font-semibold" style={{ color: "#059669" }}>
              View All →
            </button>
          </div>
          {loading ? (
            <div className="divide-y divide-outline-variant">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              ))}
            </div>
          ) : liveCalls.length === 0 ? (
            <EmptyState
              icon={PhoneOff}
              title="No active calls right now"
              detail="Your AI receptionist is ready — calls will appear here the moment one comes in."
            />
          ) : (
            <div className="divide-y divide-outline-variant">
              {liveCalls.map((c) => (
                <div key={c.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-sm font-semibold text-on-surface-variant">
                    {initials(c.patient_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-on-surface">
                      {c.direction === "outbound" ? (
                        <PhoneOutgoing size={12} className="text-on-surface-variant" />
                      ) : (
                        <PhoneIncoming size={12} className="text-on-surface-variant" />
                      )}
                      {c.patient_name || "Unknown Caller"}
                    </p>
                    {c.caller_phone && (
                      <p className="truncate text-xs text-on-surface-variant">{c.caller_phone}</p>
                    )}
                    <p className="text-xs text-on-surface-variant">
                      {c.reason || (c.direction === "outbound" ? "Outbound call" : "Inbound call")}
                      {formatCallTimeLabel(c.started_at) && ` · ${formatCallTimeLabel(c.started_at)}`}
                    </p>
                  </div>
                  <Chip tone={STATUS_TONE[c.status] || "info"}>{STATUS_LABEL[c.status] || c.status}</Chip>
                  <button className="focus-ring rounded-full p-1 text-on-surface-variant hover:bg-surface-container" onClick={() => navigate("/app/calls")}>
                    <MoreVertical size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-bold text-on-surface">Call Volume</h2>
          <p className="text-xs text-on-surface-variant">Last 24 Hours</p>
          {loading || !volume ? (
            <div className="mt-6 flex h-48 gap-2">
              <div className="flex h-48 w-6 shrink-0 flex-col justify-between text-right text-[10px] text-on-surface-variant">
                <span>&nbsp;</span>
                <span>&nbsp;</span>
                <span>&nbsp;</span>
              </div>
              <div className="flex h-48 flex-1 items-end gap-1.5 border-l border-outline-variant pl-2">
                {Array.from({ length: 24 }).map((_, i) => (
                  <Skeleton key={i} className="w-full flex-1 rounded-t-sm rounded-b-none" style={{ height: "30%" }} />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 flex h-48 gap-2">
              <div className="flex h-48 w-6 shrink-0 flex-col justify-between text-right text-[10px] leading-none text-on-surface-variant">
                <span>{maxVolume}</span>
                <span>{Math.round(maxVolume / 2)}</span>
                <span>0</span>
              </div>
              <div className="flex h-48 flex-1 items-end gap-1.5 border-l border-outline-variant pl-2">
                {volume.hours.map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm"
                    style={{ height: `${(v / maxVolume) * 100}%`, backgroundColor: "#059669", opacity: 0.55 + (v / maxVolume) * 0.45 }}
                    title={`${v} call${v === 1 ? "" : "s"}`}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="mt-2 flex justify-between pl-8 text-xs text-on-surface-variant">
            <span>12AM</span>
            <span>6AM</span>
            <span>12PM</span>
            <span>6PM</span>
          </div>
        </Card>

      </div>
    </>
  );
}

export default function Dashboard() {
  return (
    <AppShell title="Overview" subtitle="Real-time performance metrics for MedVoice AI.">
      <DashboardBody />
    </AppShell>
  );
}