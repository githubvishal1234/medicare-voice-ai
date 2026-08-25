import { useCallback, useEffect, useState } from "react";
import { CreditCard, Download, Pencil, Calendar, Receipt } from "lucide-react";
import AppShell from "../../components/AppShell";
import { Card, Chip, Button, Skeleton, EmptyState, ErrorState } from "../../components/ui";
import * as api from "../../lib/api";

function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Billing() {
  const [plan, setPlan] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([api.getPlan(), api.listInvoices()])
      .then(([planData, invoicesData]) => {
        if (cancelled) return;
        setPlan(planData);
        setInvoices(invoicesData);
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

  async function handleUpgrade() {
    setUpgrading(true);
    setUpgradeError(null);
    try {
      const updated = await api.upgradePlan();
      setPlan(updated);
    } catch (err) {
      setUpgradeError(err?.message || "Couldn't upgrade your plan. Please try again.");
    } finally {
      setUpgrading(false);
    }
  }

  const pct = plan ? Math.round(plan.usage_pct) : 0;

  if (error) {
    return (
      <AppShell title="Billing & Usage" subtitle="Manage your current plan, monitor AI voice minutes usage, and view your billing history.">
        <ErrorState detail="We couldn't load your billing information." onRetry={load} className="py-24" />
      </AppShell>
    );
  }

  return (
    <AppShell title="Billing & Usage" subtitle="Manage your current plan, monitor AI voice minutes usage, and view your billing history.">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-10 w-56" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-on-surface">{plan?.plan}</h2>
                    <Chip tone="success">{plan?.status}</Chip>
                  </div>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Includes up to {plan?.minutes_limit?.toLocaleString()} AI Voice minutes per month, premium EHR integrations, and dedicated support.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <Button onClick={handleUpgrade} disabled={upgrading}>{upgrading ? "Upgrading..." : "Upgrade Plan"}</Button>
                <Button variant="outline">View Features</Button>
              </div>
              {upgradeError && <p className="mt-3 rounded-lg bg-error-bg px-3 py-2 text-sm text-error">{upgradeError}</p>}

              <div className="mt-7 border-t border-outline-variant pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-on-surface">Voice Minutes Usage</h3>
                  <span className="text-sm font-semibold text-on-surface">{plan?.minutes_used?.toLocaleString()} / {plan?.minutes_limit?.toLocaleString()} min</span>
                </div>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#059669" }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-on-surface-variant">
                  <span>{plan?.next_billing_date ? `Renews ${plan.next_billing_date}` : "No upcoming renewal"}</span>
                  {pct >= 80 && <Chip tone="warning">{pct}% Used — Approaching limit</Chip>}
                </div>
              </div>
            </>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Calendar size={16} style={{ color: "#059669" }} />
              <h3 className="text-sm font-bold text-on-surface">Next Billing Date</h3>
            </div>
            {loading ? (
              <Skeleton className="mt-2 h-6 w-28" />
            ) : (
              <p className="mt-2 text-lg font-semibold text-on-surface">{plan?.next_billing_date || "—"}</p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-on-surface">Payment Method</h3>
              <button className="focus-ring text-on-surface-variant hover:text-on-surface"><Pencil size={14} /></button>
            </div>
            {loading ? (
              <Skeleton className="mt-3 h-14 w-full rounded-xl" />
            ) : (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-outline-variant p-3.5">
                <CreditCard size={20} className="text-on-surface-variant" />
                <div>
                  <p className="text-sm font-semibold text-on-surface">{plan?.payment_label || "No card on file"}</p>
                  {plan?.payment_expires && <p className="text-xs text-on-surface-variant">Expires {plan.payment_expires}</p>}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
          <h2 className="font-display text-base font-bold text-on-surface">Billing History</h2>
          <button className="focus-ring flex items-center gap-2 text-sm font-semibold" style={{ color: "#059669" }}>
            <Download size={14} /> Download All
          </button>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No invoices yet"
            detail="Your billing history will appear here once your first invoice is issued."
            className="py-16"
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-low text-left text-xs font-bold uppercase tracking-wide text-on-surface-variant">
              <tr>
                <th className="px-6 py-3">Invoice ID</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-6 py-3.5 font-medium text-on-surface">{inv.invoice_number}</td>
                  <td className="px-6 py-3.5 text-on-surface-variant">{formatDate(inv.issued_at)}</td>
                  <td className="px-6 py-3.5 text-on-surface-variant">{formatCents(inv.amount_cents)}</td>
                  <td className="px-6 py-3.5"><Chip tone={inv.status === "Paid" ? "success" : "neutral"}>{inv.status}</Chip></td>
                  <td className="px-6 py-3.5 text-right">
                    <button className="focus-ring text-on-surface-variant hover:text-on-surface"><Download size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}