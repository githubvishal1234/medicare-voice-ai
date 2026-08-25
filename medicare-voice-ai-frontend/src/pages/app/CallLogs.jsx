import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Bot, Play, Pause, MoreVertical, CheckCircle2, PhoneOff, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import AppShell from "../../components/AppShell";
import { Card, Chip, Skeleton, EmptyState, ErrorState } from "../../components/ui";
import * as api from "../../lib/api";
import { useRealtime } from "../../lib/realtime";
import { formatCallTimeLabel, isSameDay, addDays } from "../../lib/date";

// Real call records carry `started_at` (from the LiveKit/SIP call record);
// older/seeded rows may only have the legacy `timestamp_label` string.
// Prefer the real timestamp whenever it's present instead of showing a
// stale or missing label.
function callTimeLabel(call) {
  return formatCallTimeLabel(call.started_at) || call.timestamp_label || "—";
}

const OUTCOME_TONE = {
  Booked: "success",
  "FAQ Answered": "info",
  "Transferred to Nurse": "warning",
};

const SENTIMENT_TONE = {
  Positive: "success",
  Neutral: "neutral",
  Concerned: "warning",
};

const STATUS_TONE = {
  in_progress: "info",
  completed: "success",
  failed: "error",
  no_answer: "neutral",
};

const OUTCOME_OPTIONS = ["Booked", "FAQ Answered", "Transferred to Nurse"];
const DATE_OPTIONS = ["All Dates", "Today", "Yesterday", "Last 7 Days"];

// Client-side date filter over each call's real `started_at` timestamp.
// The backend doesn't expose a date-range query param, and there's no
// other real timestamp to filter on, so this filters the already-loaded
// list rather than fabricating a server-side filter.
function matchesDateFilter(call, filter, now) {
  if (filter === "All Dates") return true;
  if (!call.started_at) return false;
  const d = new Date(call.started_at);
  if (Number.isNaN(d.getTime())) return false;
  if (filter === "Today") return isSameDay(d, now);
  if (filter === "Yesterday") return isSameDay(d, addDays(now, -1));
  if (filter === "Last 7 Days") return d >= addDays(now, -7) && d <= now;
  return true;
}

function csvEscape(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function todayStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Flattens a call's real transcript_messages (from GET /calls/{id}) into a
// single readable block for the CSV cell. Nothing here is generated — if a
// call has no transcript_messages, we say so explicitly rather than leaving
// ambiguous blank output.
function transcriptText(detail) {
  const messages = detail?.transcript_messages;
  if (!messages || messages.length === 0) return "No transcript available";
  return messages
    .map((m) => {
      const speaker = m.who === "patient" ? "Patient" : "AI";
      const time = m.time_label ? ` [${m.time_label}]` : "";
      return `${speaker}${time}: ${m.text}`;
    })
    .join("\n");
}

// CallLogs' actual content lives in CallLogsBody, rendered as a *child* of
// AppShell (see default export below). AppShell mounts RealtimeProvider,
// so useRealtime() must be called from a component underneath it, not from
// the component that renders AppShell itself.
function CallLogsBody() {
  const { subscribe } = useRealtime();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState(false);
  const [dateFilter, setDateFilter] = useState("All Dates");
  const [outcomeFilter, setOutcomeFilter] = useState("All Outcomes");
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const audioRef = useRef(null);

  const loadList = useCallback(() => {
    setLoading(true);
    setError(false);
    return api
      .listCalls(outcomeFilter === "All Outcomes" ? undefined : outcomeFilter)
      .then((rows) => {
        setCalls(rows);
        setLoading(false);
        setSelectedId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? null));
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [outcomeFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);


  // Live-updates: refresh the list on start/update/end so in-progress calls,
  // durations, and outcomes stay current without a manual reload.
  useEffect(() => {
    const unsubs = [
      subscribe("call.started", loadList),
      subscribe("call.updated", loadList),
      subscribe("call.ended", loadList),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [subscribe, loadList]);

  // Load the transcript/summary panel whenever selection changes.
  const loadPanel = useCallback((id) => {
    if (!id) {
      setSelected(null);
      return undefined;
    }
    let cancelled = false;
    setPanelLoading(true);
    setPanelError(false);
    api
      .getCall(id)
      .then((detail) => {
        if (cancelled) return;
        setSelected(detail);
        setPanelLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPanelError(true);
        setPanelLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cleanup = loadPanel(selectedId);
    return cleanup;
  }, [selectedId, loadPanel]);

  // While a call is in progress and selected, append live transcript turns
  // and refresh call metadata (status/duration) as they arrive.
  useEffect(() => {
    if (!selected || selected.status !== "in_progress") return undefined;
    const offMessage = subscribe("call.transcript_message", (msg) => {
      if (msg.call_id !== selected.id) return;
      setSelected((prev) =>
        prev && prev.id === msg.call_id
          ? { ...prev, transcript_messages: [...prev.transcript_messages, { id: `live-${Date.now()}`, who: msg.who, text: msg.text, time_label: msg.time_label }] }
          : prev
      );
    });
    const offUpdate = subscribe("call.updated", (call) => {
      if (call.id !== selected.id) return;
      setSelected((prev) => (prev ? { ...prev, ...call } : prev));
    });
    return () => {
      offMessage();
      offUpdate();
    };
  }, [selected, subscribe]);

  function selectCall(c) {
    if (c.id === selectedId) return;
    setSelectedId(c.id);
  }

  const now = useMemo(() => new Date(), []);
  const filteredCalls = useMemo(
    () => calls.filter((c) => matchesDateFilter(c, dateFilter, now)),
    [calls, dateFilter, now]
  );

  // Exports exactly the currently filtered rows. The list endpoint
  // (GET /calls) intentionally omits transcript_messages for list
  // performance (see CallLogListOut in schemas.py), so the real
  // transcript for each row is pulled from the existing call-detail
  // endpoint (GET /calls/{id} — the same one the side panel already
  // uses) rather than fabricated. Any call whose detail fetch fails
  // just falls back to "No transcript available" for that row instead
  // of failing the whole export.
  async function exportCsv() {
    if (exporting || filteredCalls.length === 0) return;
    setExporting(true);
    try {
      const details = await Promise.all(
        filteredCalls.map((c) => api.getCall(c.id).catch(() => null))
      );

      const header = ["Patient", "Phone", "Direction", "Time", "Reason", "Duration", "Status", "Outcome", "Transcript"];
      const rows = filteredCalls.map((c, i) => [
        c.patient_name,
        c.caller_phone || "",
        c.direction || "",
        callTimeLabel(c),
        c.reason || "",
        c.duration || "",
        c.status || "",
        c.outcome || "",
        transcriptText(details[i]),
      ]);
      const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `call-logs-${todayStamp()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function togglePlayRecording() {
    if (!selected?.recording_url) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(selected.recording_url);
    audio.onended = () => setPlaying(false);
    audioRef.current = audio;
    audio.play();
    setPlaying(true);
  }

  useEffect(() => {
    // Stop playback if the selected call changes out from under it.
    audioRef.current?.pause();
    setPlaying(false);
  }, [selectedId]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="focus-ring rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2 text-sm text-on-surface-variant"
        >
          {DATE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="focus-ring rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2 text-sm text-on-surface-variant"
        >
          <option>All Outcomes</option>
          {OUTCOME_OPTIONS.map((o) => <option key={o}>{o}</option>)}
        </select>
        <button
          onClick={exportCsv}
          disabled={filteredCalls.length === 0 || exporting}
          className="focus-ring ml-auto flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={15} /> {exporting ? "Exporting…" : "Export"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-2">
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : error ? (
            <ErrorState detail="We couldn't load your call logs." onRetry={loadList} className="py-20" />
          ) : filteredCalls.length === 0 ? (
            <EmptyState
              icon={PhoneOff}
              title="No calls yet"
              detail={
                calls.length === 0
                  ? "Once your AI receptionist takes a call, it will show up here with a transcript and summary."
                  : "No calls match the current filters."
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-low text-left text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                <tr>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filteredCalls.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => selectCall(c)}
                    className={`cursor-pointer transition-colors ${selectedId === c.id ? "bg-surface-container" : "hover:bg-surface-low"}`}
                  >
                    <td className="px-4 py-3.5">
                      <p className="flex items-center gap-1.5 font-semibold text-on-surface">
                        {c.direction === "outbound" ? (
                          <PhoneOutgoing size={11} className="text-on-surface-variant" />
                        ) : (
                          <PhoneIncoming size={11} className="text-on-surface-variant" />
                        )}
                        {c.patient_name}
                      </p>
                      {c.caller_phone && (
                        <p className="truncate text-xs text-on-surface-variant">{c.caller_phone}</p>
                      )}
                      <p className="text-xs text-on-surface-variant">
                        {callTimeLabel(c)} · {c.reason || "—"} · {c.duration || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      {c.status === "in_progress" ? (
                        <Chip tone={STATUS_TONE.in_progress}>In Progress</Chip>
                      ) : (
                        <Chip tone={OUTCOME_TONE[c.outcome] || "neutral"}>{c.outcome || "—"}</Chip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="lg:col-span-3">
          {!selected ? (
            <EmptyState
              icon={PhoneOff}
              title="Select a call"
              detail="Choose a call from the list to see its transcript and AI summary."
              className="py-24"
            />
          ) : panelError ? (
            <ErrorState
              detail="We couldn't load this call's details."
              onRetry={() => loadPanel(selectedId)}
              className="py-24"
            />
          ) : panelLoading ? (
            <div className="space-y-6 px-6 py-5">
              <div className="flex items-start justify-between border-b border-outline-variant pb-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-3/4 rounded-xl" />
                <Skeleton className="ml-auto h-10 w-2/3 rounded-xl" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between border-b border-outline-variant px-6 py-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-on-surface">{selected.patient_name}</h2>
                  {selected.caller_phone && (
                    <p className="text-xs text-on-surface-variant">{selected.caller_phone}</p>
                  )}
                  <p className="text-xs text-on-surface-variant">
                    {callTimeLabel(selected)} {selected.duration ? `(${selected.duration})` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selected.status === "in_progress" ? (
                    <Chip tone="info">Live</Chip>
                  ) : (
                    selected.sentiment && <Chip tone={SENTIMENT_TONE[selected.sentiment] || "neutral"}>{selected.sentiment}</Chip>
                  )}
                  <button className="focus-ring rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container">
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-6 px-6 py-5">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Bot size={16} style={{ color: "#059669" }} />
                    <h3 className="text-sm font-bold text-on-surface">AI Summary</h3>
                  </div>
                  {selected.ai_summary ? (
                    <p className="rounded-xl bg-surface-low p-4 text-sm leading-relaxed text-on-surface-variant">
                      {selected.ai_summary}
                    </p>
                  ) : (
                    <p className="rounded-xl bg-surface-low p-4 text-sm leading-relaxed text-on-surface-variant">
                      {selected.status === "in_progress" ? "Call in progress — summary will appear once it ends." : "No summary available."}
                    </p>
                  )}
                  {selected.actions_taken && (
                    <ul className="mt-3 space-y-1.5">
                      {selected.actions_taken.split("\n").filter(Boolean).map((t) => (
                        <li key={t} className="flex items-center gap-2 text-sm text-on-surface">
                          <CheckCircle2 size={15} style={{ color: "#15803d" }} />
                          {t}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-on-surface">Transcript</h3>
                    {selected.recording_url && (
                      <button
                        onClick={togglePlayRecording}
                        className="focus-ring flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold hover:bg-surface-container"
                      >
                        {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? "Pause Recording" : "Play Recording"}
                      </button>
                    )}
                  </div>
                  {!selected.transcript_messages || selected.transcript_messages.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">No transcript yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {selected.transcript_messages.map((t) => (
                        <div key={t.id} className={`flex ${t.who === "patient" ? "justify-end" : ""}`}>
                          <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${t.who === "patient" ? "text-white" : "bg-surface-low text-on-surface"}`} style={t.who === "patient" ? { backgroundColor: "#059669" } : undefined}>
                            {t.text}
                            {t.time_label && (
                              <span className={`ml-2 text-[11px] ${t.who === "patient" ? "text-white/70" : "text-on-surface-variant"}`}>{t.time_label}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

export default function CallLogs() {
  return (
    <AppShell title="Recent Calls" subtitle="Review transcripts, outcomes, and AI summaries from every call.">
      <CallLogsBody />
    </AppShell>
  );
}