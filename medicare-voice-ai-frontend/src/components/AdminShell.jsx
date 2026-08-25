import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Building2, Users, ScrollText, LogOut, ShieldAlert, Layers, CreditCard, BarChart3 } from "lucide-react";
import Logo from "./Logo";
import { useAdminAuth } from "../lib/adminAuth";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/organizations", label: "Organizations", icon: Building2 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/plans", label: "Plans", icon: Layers },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { to: "/admin/usage", label: "Usage", icon: BarChart3 },
  { to: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
];

export default function AdminShell({ children }) {
  const { admin, signOut } = useAdminAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-surface-low">
      <aside className="hidden w-64 flex-col border-r border-outline-variant bg-surface-lowest lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <Logo variant="mark" />
          <div className="flex flex-col leading-none">
            <span className="font-display text-sm font-bold text-on-surface">Platform Admin</span>
            <span className="text-xs text-on-surface-variant">Super Admin</span>
          </div>
        </div>

        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-warning-bg px-3 py-2 text-xs font-semibold text-warning">
          <ShieldAlert size={14} />
          Cross-organization access
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-[#0f172a] text-white"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-outline-variant px-3 py-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-semibold text-on-surface">{admin?.full_name}</p>
            <p className="truncate text-xs text-on-surface-variant">{admin?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-outline-variant bg-surface-lowest px-5 py-4 lg:hidden">
          <Logo variant="mark" />
          <span className="text-sm font-semibold text-on-surface">Platform Admin</span>
        </header>
        <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
