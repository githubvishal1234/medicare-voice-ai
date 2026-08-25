import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Users,
  UserCheck,
  HeartPulse,
  PhoneCall,
  Clock,
  ShieldOff,
  CalendarCheck,
  CreditCard,
  Activity,
  ScrollText,
} from "lucide-react";
import AdminShell from "../../components/AdminShell";
import { Card, Chip, EmptyState, ErrorState, Skeleton } from "../../components/ui";
import * as adminApi from "../../lib/adminApi";

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

const ACTIVITY_STYLE = {
  org_created: { tone: "info", label: "New org" },
  org_suspended: { tone: "error", label: "Suspended" },
  super_admin_action: { tone: "neutral", label: "Admin action" },
  call_completed: { tone: "success", label: "Call" },
};

function ActivityRow({ item }) {
  const style = ACTIVITY_STYLE[item.type] || { tone: "neutral", label: item.type };
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Chip tone={style.tone}>{style.label}</Chip>
          <p className="truncate text-sm font-semibold text-on-surface">{item.title}</p>
        </div>
        {item.detail && <p className="mt-1 text-sm text-on-surface-variant">{item.detail}</p>}
        {item.org_id && (
          <Link
            to={`/admin/organizations/${item.org_id}`}
            className="focus-ring text-xs text-on-surface-variant hover:underline"
          >
            {item.org_name || item.org_id}
          </Link>
        )}
      </div>
      <p className="whitespace-nowrap text-xs text-on-surface-variant">
        {new Date(item.occurred_at).toLocaleString()}
      </p>
    </div>
  );
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [activity, setActivity] = useState(null);
  const [activityError, setActivityError] = useState(null);
  const [activityLoading, setActivityLoading] = useState(true);

  async function loadStats() {
    setStatsLoading(true);
    setStatsError(null);
    try {
      setStats(await adminApi.getPlatformStats());
    } catch (err) {
      setStatsError(err);
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadActivity() {
    setActivityLoading(true);
    setActivityError(null);
    try {
      setActivity(await adminApi.getRecentActivity(15));
    } catch (err) {
      setActivityError(err);
    } finally {
      setActivityLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
    loadActivity();
  }, []);

  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-bold text-on-surface">Platform overview</h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        Aggregate usage across every organization on Medicare Voice AI.
      </p>

      {/* ---------- Stat cards ---------- */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading &&
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[84px] rounded-2xl" />)}

        {!statsLoading && statsError && (
          <Card className="col-span-full">
            <ErrorState detail={statsError.message} onRetry={loadStats} />
          </Card>
        )}

        {!statsLoading && !statsError && stats && (
          <>
            <StatCard icon={Building2} label="Total clinics" value={stats.org_count} />
            <StatCard icon={UserCheck} label="Active clinics" value={stats.active_org_count} />
            <StatCard icon={ShieldOff} label="Suspended clinics" value={stats.suspended_org_count} />
            <StatCard
              icon={Users}
              label="Total users"
              value={stats.user_count}
              sublabel={`${stats.active_user_count} active`}
            />
            <StatCard icon={HeartPulse} label="Total patients" value={stats.patient_count} />
            <StatCard
              icon={PhoneCall}
              label="Total calls"
              value={stats.total_calls}
              sublabel={`${stats.calls_today} today`}
            />
            <StatCard
              icon={Clock}
              label="Voice minutes used"
              value={stats.total_voice_minutes_used.toLocaleString()}
              sublabel={`of ${stats.total_voice_minutes_limit.toLocaleString()} limit`}
            />
            <StatCard
              icon={CalendarCheck}
              label="Appointments"
              value={stats.total_appointments}
              sublabel={`${stats.appointments_today} today`}
            />
          </>
        )}
      </div>

      {/* ---------- Subscription / plan overview ---------- */}
      <h2 className="mt-8 flex items-center gap-2 font-display text-lg font-bold text-on-surface">
        <CreditCard size={18} className="text-on-surface-variant" />
        Subscription &amp; plan overview
      </h2>
      <Card className="mt-3 overflow-hidden">
        {statsLoading && (
          <div className="space-y-0 divide-y divide-outline-variant">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-5 py-4">
                <Skeleton className="h-5 w-2/3" />
              </div>
            ))}
          </div>
        )}

        {!statsLoading && statsError && <ErrorState detail={statsError.message} onRetry={loadStats} />}

        {!statsLoading && !statsError && stats?.plan_breakdown?.length === 0 && (
          <EmptyState icon={CreditCard} title="No organizations yet" />
        )}

        {!statsLoading && !statsError && stats?.plan_breakdown?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-xs font-medium text-on-surface-variant">
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Organizations</th>
                  <th className="px-5 py-3">Voice minutes used</th>
                  <th className="px-5 py-3">Voice minutes limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {stats.plan_breakdown.map((row) => (
                  <tr key={row.plan}>
                    <td className="px-5 py-3 font-semibold text-on-surface">{row.plan}</td>
                    <td className="px-5 py-3 text-on-surface-variant">{row.org_count}</td>
                    <td className="px-5 py-3 text-on-surface-variant">
                      {row.voice_minutes_used.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-on-surface-variant">
                      {row.voice_minutes_limit.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ---------- Recent platform activity ---------- */}
      <h2 className="mt-8 flex items-center gap-2 font-display text-lg font-bold text-on-surface">
        <Activity size={18} className="text-on-surface-variant" />
        Recent platform activity
      </h2>
      <Card className="mt-3 overflow-hidden">
        {activityLoading && (
          <div className="space-y-0 divide-y divide-outline-variant">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4">
                <Skeleton className="h-5 w-2/3" />
              </div>
            ))}
          </div>
        )}

        {!activityLoading && activityError && (
          <ErrorState detail={activityError.message} onRetry={loadActivity} />
        )}

        {!activityLoading && !activityError && activity?.length === 0 && (
          <EmptyState icon={ScrollText} title="No platform activity yet" />
        )}

        {!activityLoading && !activityError && activity?.length > 0 && (
          <div className="divide-y divide-outline-variant">
            {activity.map((item, i) => (
              <ActivityRow key={`${item.type}-${item.occurred_at}-${i}`} item={item} />
            ))}
          </div>
        )}
      </Card>
    </AdminShell>
  );
}
