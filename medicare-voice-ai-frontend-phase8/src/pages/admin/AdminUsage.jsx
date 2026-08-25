import { useEffect, useState } from "react";
import {
  BarChart3,
  PhoneCall,
  Clock,
  CalendarCheck,
  HeartPulse,
  Users,
  BookOpen,
  Database,
  KeyRound,
  Filter,
} from "lucide-react";
import AdminShell from "../../components/AdminShell";
import { Card, Chip, EmptyState, ErrorState, Skeleton } from "../../components/ui";
import * as adminApi from "../../lib/adminApi";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

function StatCard({ icon: Icon, label, value, sublabel }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container">
          <Icon size={18} className="text-on-surface-variant" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-on-surface-variant">{label}</p>
          <p className="font-display text-2xl font-bold text-on-surface">{value}</p>
          {sublabel && <p className="truncate text-xs text-on-surface-variant">{sublabel}</p>}
        </div>
      </div>
    </Card>
  );
}

function UsageBar({ used, limit }) {
  if (!limit) {
    return <span className="text-xs text-on-surface-variant">No limit set</span>;
  }
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const tone = pct >= 100 ? "#dc2626" : pct >= 80 ? "#d97706" : "#059669";
  return (
    <div className="w-32">
      <div className="flex items-center justify-between text-xs text-on-surface-variant">
        <span>{used.toLocaleString()}</span>
        <span>{limit.toLocaleString()}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: tone }} />
      </div>
    </div>
  );
}

export default function AdminUsage() {
  const [range, setRange] = useState(defaultRange());
  const [orgId, setOrgId] = useState("");

  const [orgs, setOrgs] = useState(null);
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadOrgs() {
    try {
      setOrgs(await adminApi.listOrganizations());
    } catch {
      // Non-fatal — the clinic filter just won't populate; the usage
      // table itself will still load and show its own error if needed.
    }
  }

  async function loadUsage() {
    setLoading(true);
    setError(null);
    try {
      setUsage(
        await adminApi.getUsage({
          startDate: range.startDate,
          endDate: range.endDate,
          orgId: orgId || undefined,
        })
      );
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrgs();
  }, []);

  useEffect(() => {
    loadUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.startDate, range.endDate, orgId]);

  const summary = usage?.summary;
  const clinics = usage?.clinics;

  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-bold text-on-surface">Usage management</h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        Real usage by clinic — calls, voice minutes, appointments, patients, AI activity, knowledge base, and
        EHR/API, against each clinic's plan limits.
      </p>

      {/* ---------- Filters ---------- */}
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">From</label>
          <input
            type="date"
            value={range.startDate}
            max={range.endDate}
            onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))}
            className="focus-ring rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2.5 text-sm text-on-surface"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">To</label>
          <input
            type="date"
            value={range.endDate}
            min={range.startDate}
            max={isoDate(new Date())}
            onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))}
            className="focus-ring rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2.5 text-sm text-on-surface"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">Clinic</label>
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="focus-ring rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2.5 text-sm text-on-surface"
          >
            <option value="">All clinics</option>
            {(orgs || []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            setRange(defaultRange());
            setOrgId("");
          }}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container"
        >
          <Filter size={14} />
          Reset filters
        </button>
      </div>

      {/* ---------- Summary ---------- */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading &&
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[84px] rounded-2xl" />)}

        {!loading && error && (
          <Card className="col-span-full">
            <ErrorState detail={error.message} onRetry={loadUsage} />
          </Card>
        )}

        {!loading && !error && summary && (
          <>
            <StatCard icon={BarChart3} label="Clinics in view" value={summary.clinic_count} />
            <StatCard icon={PhoneCall} label="Total calls" value={summary.total_calls} sublabel="Selected range" />
            <StatCard
              icon={Clock}
              label="Voice minutes"
              value={summary.total_voice_minutes_used_period.toLocaleString()}
              sublabel="Selected range"
            />
            <StatCard
              icon={CalendarCheck}
              label="Appointments"
              value={summary.total_appointments}
              sublabel={`${summary.total_ai_appointments} AI-booked`}
            />
            <StatCard icon={HeartPulse} label="Patients" value={summary.total_patients} sublabel="Current roster" />
            <StatCard icon={Users} label="Staff users" value={summary.total_users} />
            <StatCard
              icon={BookOpen}
              label="Knowledge base"
              value={summary.total_kb_documents + summary.total_kb_sources + summary.total_faqs}
              sublabel={`${summary.total_kb_documents} docs · ${summary.total_kb_sources} sources · ${summary.total_faqs} FAQs`}
            />
            <StatCard
              icon={Database}
              label="EHR connected"
              value={summary.total_ehr_integrations_connected}
              sublabel={`${summary.total_api_keys_active} active API keys`}
            />
          </>
        )}
      </div>

      {/* ---------- Per-clinic usage ---------- */}
      <h2 className="mt-8 font-display text-lg font-bold text-on-surface">Usage by clinic</h2>
      <Card className="mt-3 overflow-hidden">
        {loading && (
          <div className="space-y-0 divide-y divide-outline-variant">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4">
                <Skeleton className="h-5 w-2/3" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && <ErrorState detail={error.message} onRetry={loadUsage} />}

        {!loading && !error && clinics?.length === 0 && (
          <EmptyState
            icon={BarChart3}
            title="No usage data"
            detail="No clinics match the current filters, or none have activity in this range."
          />
        )}

        {!loading && !error && clinics?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-outline-variant bg-surface-container/60 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                <tr>
                  <th className="px-5 py-3">Clinic</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Calls</th>
                  <th className="px-5 py-3">Voice min.</th>
                  <th className="px-5 py-3">Appointments</th>
                  <th className="px-5 py-3">Patients</th>
                  <th className="px-5 py-3">Knowledge base</th>
                  <th className="px-5 py-3">EHR / API</th>
                  <th className="px-5 py-3">Plan usage (all-time)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {clinics.map((c) => (
                  <tr key={c.org_id} className="transition hover:bg-surface-container/40">
                    <td className="px-5 py-4 font-semibold text-on-surface">{c.org_name}</td>
                    <td className="px-5 py-4">
                      <Chip tone={c.has_subscription ? "info" : "neutral"}>{c.plan_name}</Chip>
                    </td>
                    <td className="px-5 py-4 text-on-surface-variant">{c.total_calls}</td>
                    <td className="px-5 py-4 text-on-surface-variant">{c.voice_minutes_used_period}</td>
                    <td className="px-5 py-4 text-on-surface-variant">
                      {c.appointments_total}
                      <span className="text-xs text-on-surface-variant"> ({c.appointments_ai_booked} AI)</span>
                    </td>
                    <td className="px-5 py-4 text-on-surface-variant">
                      {c.patient_count}
                      {c.plan_patient_limit != null && (
                        <span className="text-xs"> / {c.plan_patient_limit}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-on-surface-variant">
                      <span className="text-xs">
                        {c.kb_document_count} docs · {c.kb_source_count} sources · {c.faq_count} FAQs
                      </span>
                    </td>
                    <td className="px-5 py-4 text-on-surface-variant">
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Database size={12} />
                          {c.ehr_integrations_connected}/{c.ehr_integrations_total} connected
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <KeyRound size={12} />
                          {c.api_keys_active} active keys
                        </span>
                        <span className="text-on-surface-variant/70">
                          EHR syncs: {c.ehr_sync_count == null ? "Not available" : c.ehr_sync_count}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <UsageBar used={c.plan_voice_minutes_used_alltime} limit={c.plan_voice_minutes_limit} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-on-surface-variant">
        Calls, voice minutes, and appointments reflect activity within the selected date range. Patients, users,
        knowledge base, EHR, and API figures reflect current totals. "Plan usage" is each clinic's all-time voice
        minute counter against its plan limit, the same figure shown on its Billing page.
      </p>
    </AdminShell>
  );
}
