import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Search } from "lucide-react";
import AdminShell from "../../components/AdminShell";
import { Card, Chip, EmptyState, ErrorState, Skeleton } from "../../components/ui";

import * as adminApi from "../../lib/adminApi";

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

export default function AdminOrganizations() {
  const [orgs, setOrgs] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setOrgs(await adminApi.listOrganizations());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!orgs) return null;
    const q = search.trim().toLowerCase();
    return orgs.filter((org) => {
      if (q && !org.name.toLowerCase().includes(q)) return false;
      if (statusFilter === "active" && org.suspended) return false;
      if (statusFilter === "suspended" && !org.suspended) return false;
      return true;
    });
  }, [orgs, search, statusFilter]);

  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-bold text-on-surface">Organizations</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Every clinic registered on the platform.</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clinics by name…"
            className="focus-ring w-full rounded-lg border border-outline-variant bg-surface-lowest py-2.5 pl-9 pr-3 text-sm text-on-surface"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="focus-ring rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2.5 text-sm text-on-surface"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        {!loading && !error && orgs && (
          <p className="text-sm text-on-surface-variant">
            {filtered.length} of {orgs.length} clinics
          </p>
        )}
      </div>

      <Card className="mt-4 overflow-hidden">
        {loading && (
          <div className="space-y-0 divide-y divide-outline-variant">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4">
                <Skeleton className="h-5 w-1/3" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && <ErrorState detail={error.message} onRetry={load} />}

        {!loading && !error && orgs?.length === 0 && (
          <EmptyState icon={Building2} title="No organizations yet" />
        )}

        {!loading && !error && orgs?.length > 0 && filtered.length === 0 && (
          <EmptyState
            icon={Search}
            title="No clinics match your search"
            detail="Try a different name or status filter."
          />
        )}

        {!loading && !error && filtered?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-outline-variant bg-surface-container/60 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                <tr>
                  <th className="px-5 py-3">Organization</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Users</th>
                  <th className="px-5 py-3">Patients</th>
                  <th className="px-5 py-3">Voice minutes</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filtered.map((org) => (
                  <tr key={org.id} className="transition hover:bg-surface-container/40">
                    <td className="px-5 py-4">
                      <Link
                        to={`/admin/organizations/${org.id}`}
                        className="focus-ring font-semibold text-on-surface hover:underline"
                      >
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-on-surface-variant">{org.plan}</td>
                    <td className="px-5 py-4 text-on-surface-variant">{org.user_count}</td>
                    <td className="px-5 py-4 text-on-surface-variant">{org.patient_count}</td>
                    <td className="px-5 py-4 text-on-surface-variant">
                      {org.voice_minutes_used} / {org.voice_minutes_limit}
                    </td>
                    <td className="px-5 py-4">
                      {org.suspended ? (
                        <Chip tone="error">Suspended</Chip>
                      ) : (
                        <Chip tone="success">Active</Chip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminShell>
  );
}
