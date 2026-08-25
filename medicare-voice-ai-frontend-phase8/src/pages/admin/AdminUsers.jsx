import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Search, X } from "lucide-react";
import AdminShell from "../../components/AdminShell";
import { Card, Chip, ConfirmDialog, EmptyState, ErrorState, Skeleton } from "../../components/ui";
import * as adminApi from "../../lib/adminApi";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "medical_staff", label: "Medical staff" },
  { value: "ai_agent", label: "AI agent" },
];

const ROLE_FILTERS = [{ value: "all", label: "All roles" }, ...ROLE_OPTIONS];

function roleLabel(role) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
}

function UserDetailDialog({ user, onClose }) {
  if (!user) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <Card className="w-full max-w-sm p-5">
        <div className="flex items-start justify-between">
          <p className="font-display text-base font-bold text-on-surface">{user.full_name}</p>
          <button onClick={onClose} className="focus-ring text-on-surface-variant hover:text-on-surface">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <p className="text-xs text-on-surface-variant">Email</p>
            <p className="font-medium text-on-surface">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Role</p>
            <p className="font-medium text-on-surface">{roleLabel(user.role)}</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Organization</p>
            <Link
              to={`/admin/organizations/${user.org_id}`}
              className="focus-ring font-medium text-on-surface hover:underline"
            >
              {user.org_name}
            </Link>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Status</p>
            {user.is_active ? <Chip tone="success">Active</Chip> : <Chip tone="neutral">Deactivated</Chip>}
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Created</p>
            <p className="font-medium text-on-surface">{new Date(user.created_at).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Last activity</p>
            <p className="font-medium text-on-surface-variant">Not tracked</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const [detailUser, setDetailUser] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setUsers(await adminApi.listAllUsers());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const orgOptions = useMemo(() => {
    if (!users) return [];
    const seen = new Map();
    for (const u of users) seen.set(u.org_id, u.org_name);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [users]);

  const filtered = useMemo(() => {
    if (!users) return null;
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !u.full_name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (orgFilter !== "all" && u.org_id !== orgFilter) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      return true;
    });
  }, [users, search, orgFilter, roleFilter]);

  async function reactivate(user) {
    setBusyUserId(user.id);
    setActionError(null);
    try {
      await adminApi.updateOrgUser(user.org_id, user.id, { is_active: true });
      await load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyUserId(null);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setBusyUserId(deactivateTarget.id);
    setActionError(null);
    try {
      await adminApi.updateOrgUser(deactivateTarget.org_id, deactivateTarget.id, { is_active: false });
      setDeactivateTarget(null);
      await load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyUserId(null);
    }
  }

  async function changeRole(user, newRole) {
    if (newRole === user.role) return;
    setBusyUserId(user.id);
    setActionError(null);
    try {
      await adminApi.updateOrgUser(user.org_id, user.id, { role: newRole });
      await load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-bold text-on-surface">Users</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Every user across every clinic on the platform.</p>

      {actionError && (
        <p className="mt-4 rounded-lg bg-error-bg px-3 py-2 text-sm text-error">{actionError}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="focus-ring w-full rounded-lg border border-outline-variant bg-surface-lowest py-2.5 pl-9 pr-3 text-sm text-on-surface"
          />
        </div>
        <select
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          className="focus-ring rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2.5 text-sm text-on-surface"
        >
          <option value="all">All clinics</option>
          {orgOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="focus-ring rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2.5 text-sm text-on-surface"
        >
          {ROLE_FILTERS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {!loading && !error && users && (
          <p className="text-sm text-on-surface-variant">
            {filtered.length} of {users.length} users
          </p>
        )}
      </div>

      <Card className="mt-4 overflow-hidden">
        {loading && (
          <div className="space-y-0 divide-y divide-outline-variant">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-4">
                <Skeleton className="h-5 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && <ErrorState detail={error.message} onRetry={load} />}

        {!loading && !error && users?.length === 0 && (
          <EmptyState icon={Users} title="No users yet" />
        )}

        {!loading && !error && users?.length > 0 && filtered.length === 0 && (
          <EmptyState
            icon={Search}
            title="No users match your search"
            detail="Try a different name, clinic, or role filter."
          />
        )}

        {!loading && !error && filtered?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-outline-variant bg-surface-container/60 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Organization</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filtered.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setDetailUser(user)}
                        className="focus-ring font-semibold text-on-surface hover:underline"
                      >
                        {user.full_name}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-on-surface-variant">{user.email}</td>
                    <td className="px-5 py-3">
                      <Link
                        to={`/admin/organizations/${user.org_id}`}
                        className="focus-ring text-on-surface-variant hover:underline"
                      >
                        {user.org_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={user.role}
                        onChange={(e) => changeRole(user, e.target.value)}
                        disabled={busyUserId === user.id}
                        className="focus-ring rounded-lg border border-outline-variant bg-surface-lowest px-2 py-1.5 text-sm text-on-surface"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      {user.is_active ? (
                        <Chip tone="success">Active</Chip>
                      ) : (
                        <Chip tone="neutral">Deactivated</Chip>
                      )}
                    </td>
                    <td className="px-5 py-3 text-on-surface-variant">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() =>
                          user.is_active ? setDeactivateTarget(user) : reactivate(user)
                        }
                        disabled={busyUserId === user.id}
                        className="focus-ring text-sm font-semibold text-on-surface-variant hover:underline"
                      >
                        {user.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <UserDetailDialog user={detailUser} onClose={() => setDetailUser(null)} />

      <ConfirmDialog
        open={!!deactivateTarget}
        title={`Deactivate ${deactivateTarget?.full_name}?`}
        detail={`This immediately blocks ${deactivateTarget?.full_name} from logging into ${deactivateTarget?.org_name}'s dashboard.`}
        confirmLabel="Deactivate user"
        tone="error"
        busy={busyUserId === deactivateTarget?.id}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={confirmDeactivate}
      />
    </AdminShell>
  );
}
