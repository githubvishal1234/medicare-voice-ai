import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Lock, Users, Headset, ShieldAlert, ScrollText, Search, Filter, Plus } from "lucide-react";
import AppShell from "../../components/AppShell";
import { Card, Chip, Button, Skeleton, EmptyState, ErrorState } from "../../components/ui";
import * as api from "../../lib/api";

const ROLE_ICON = { Administrators: Users, "Medical Staff": ShieldAlert, "AI Agents": Headset };
const STATUS_TONE = { Success: "success", Blocked: "error", Logged: "neutral" };

function formatTimestamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function Security() {
  const [compliance, setCompliance] = useState(null);
  const [roles, setRoles] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([api.getCompliance(), api.getRoles(), api.getAuditLog()])
      .then(([complianceData, rolesData, auditLogData]) => {
        if (cancelled) return;
        setCompliance(complianceData);
        setRoles(rolesData);
        setAuditLog(auditLogData);
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
  }, []);

  useEffect(() => {
    return load();
  }, [load]);

  if (error) {
    return (
      <AppShell
        title="Security & Compliance"
        subtitle="Manage your organization's security posture, monitor audit logs, and maintain data protection."
      >
        <ErrorState detail="We couldn't load your security settings." onRetry={load} className="py-24" />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Security & Compliance"
      subtitle="Manage your organization's security posture, monitor audit logs, and maintain data protection."
    >
      <Card className="mb-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#dcfce7]">
            <ShieldCheck size={20} className="text-[#15803d]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-bold text-on-surface">Security & Privacy</h2>
              {loading ? (
                <Skeleton className="h-5 w-24 rounded-full" />
              ) : (
                <Chip tone={compliance?.hipaa_verified ? "success" : "warning"}>
                  {compliance?.hipaa_verified ? "Verified Active" : "Review Needed"}
                </Chip>
              )}
            </div>
            <p className="mt-1 text-sm text-on-surface-variant">
              Your instance is fully verified and compliant with healthcare privacy regulations.
            </p>
            {loading ? (
              <div className="mt-3 flex gap-8">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-32" />
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-xs text-on-surface-variant">
                <span>Last Security Audit: <b className="text-on-surface">{compliance?.last_security_audit}</b></span>
                <span>Data Retention Policy: <b className="text-on-surface">{compliance?.data_retention_years} Years</b></span>
              </div>
            )}
          </div>
        </div>
        <Button variant="outline">Download PDF</Button>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Lock size={16} style={{ color: "#059669" }} />
            <h2 className="font-display text-base font-bold text-on-surface">End-to-End Encryption</h2>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            All patient voice data and transcripts are encrypted at rest and in transit.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-outline-variant p-3.5">
              <p className="text-xs text-on-surface-variant">At Rest</p>
              <p className="text-sm font-semibold text-on-surface">{compliance?.encryption_at_rest || "AES-256"} ✓</p>
            </div>
            <div className="rounded-xl border border-outline-variant p-3.5">
              <p className="text-xs text-on-surface-variant">In Transit</p>
              <p className="text-sm font-semibold text-on-surface">{compliance?.encryption_in_transit || "TLS 1.3"} ✓</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-on-surface">Access Control</h2>
            <button className="focus-ring flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#059669" }}>
              <Plus size={14} /> Create Custom Role
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
            ) : (
              roles.map((r) => {
                const Icon = ROLE_ICON[r.name] || Users;
                return (
                  <div key={r.name} className="flex items-start gap-3 rounded-xl border border-outline-variant p-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container">
                      <Icon size={16} className="text-on-surface-variant" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        {r.name} · <span className="text-on-surface-variant">{r.count} User{r.count === 1 ? "" : "s"}</span>
                      </p>
                      <p className="text-xs text-on-surface-variant">{r.detail}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex flex-col gap-3 border-b border-outline-variant px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-on-surface">System Audit Logs</h2>
            <p className="text-xs text-on-surface-variant">Recent administrative and automated system actions.</p>
          </div>
          <div className="flex gap-2">
            <button className="focus-ring rounded-lg border border-outline-variant p-2 text-on-surface-variant hover:bg-surface-container"><Search size={15} /></button>
            <button className="focus-ring rounded-lg border border-outline-variant p-2 text-on-surface-variant hover:bg-surface-container"><Filter size={15} /></button>
          </div>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : auditLog.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No audit events yet"
            detail="Administrative and automated system actions will appear here as they happen."
            className="py-16"
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-surface-low text-left text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">User/System</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {auditLog.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-3.5 text-on-surface-variant">{formatTimestamp(row.occurred_at)}</td>
                    <td className="px-6 py-3.5 font-medium text-on-surface">{row.action}</td>
                    <td className="px-6 py-3.5 text-on-surface-variant">{row.who || "System"}</td>
                    <td className="px-6 py-3.5"><Chip tone={STATUS_TONE[row.status] || "neutral"}>{row.status}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-outline-variant px-6 py-3 text-center">
              <button className="focus-ring text-sm font-semibold" style={{ color: "#059669" }}>View All Logs</button>
            </div>
          </>
        )}
      </Card>
    </AppShell>
  );
}