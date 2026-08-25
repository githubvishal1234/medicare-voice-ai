import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, PhoneCall, CalendarDays, Users, PlugZap,
  Bot, ShieldCheck, CreditCard, Search, Bell, HelpCircle,
  LogOut, Menu, X, BookOpen, Sun, Moon,
  CheckCircle2, AlertTriangle, Info,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import { org } from "../lib/data";
import { RealtimeProvider, useRealtime } from "../lib/realtime";
import { useAuth } from "../lib/auth";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/calls", label: "Call Logs", icon: PhoneCall },
  { to: "/app/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/app/patients", label: "Patients", icon: Users },
  { to: "/app/knowledge-base", label: "Knowledge Base", icon: BookOpen },
  { to: "/app/ehr", label: "EHR Sync", icon: PlugZap },
  { to: "/app/agent", label: "Agent Settings", icon: Bot },
  { to: "/app/security", label: "Security", icon: ShieldCheck },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
];

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem("medvoice-theme");
    if (stored) return stored === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    window.localStorage.setItem("medvoice-theme", dark ? "dark" : "light");
  }, [dark]);

  return [dark, setDark];
}

const NOTIF_TONE = {
  success: { icon: CheckCircle2, className: "text-success" },
  warning: { icon: AlertTriangle, className: "text-warning" },
  info: { icon: Info, className: "text-info" },
};

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Live connection dot — green/pulsing when the dashboard WebSocket is open, gray otherwise. */
function ConnectionDot() {
  const { connected } = useRealtime();
  return (
    <span
      className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant"
      title={connected ? "Live updates connected" : "Reconnecting…"}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-on-surface-variant/40"}`} />
      {connected ? "Live" : "Offline"}
    </span>
  );
}

function NotificationBell() {
  const { notifications, unreadCount, markAllRead, dismissNotification } = useRealtime();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggle() {
    setOpen((o) => {
      if (!o) markAllRead();
      return !o;
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="focus-ring relative rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
        aria-label="Notifications"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-outline-variant bg-surface-lowest shadow-xl">
          <div className="border-b border-outline-variant px-4 py-3">
            <p className="text-sm font-bold text-on-surface">Notifications</p>
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-on-surface-variant">No notifications yet</p>
          ) : (
            <div className="max-h-96 divide-y divide-outline-variant overflow-y-auto">
              {notifications.map((n) => {
                const tone = NOTIF_TONE[n.level] || NOTIF_TONE.info;
                const Icon = tone.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => dismissNotification(n.id)}
                    className="flex w-full items-start gap-2.5 px-4 py-3 text-left hover:bg-surface-container"
                  >
                    <Icon size={16} className={`mt-0.5 shrink-0 ${tone.className}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-on-surface">{n.title}</p>
                      <p className="truncate text-xs text-on-surface-variant">{n.message}</p>
                      <p className="mt-0.5 text-[11px] text-on-surface-variant/70">{timeAgo(n.receivedAt)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SidebarContent({ onNavigate }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  function handleSignOut() {
    signOut();
    navigate("/");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-5">
        <button onClick={() => navigate("/")} className="focus-ring rounded-md">
          <Logo />
        </button>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
          Clinical Receptionist
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#0f172a] text-white"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`
            }
          >
            <item.icon size={18} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1 border-t border-outline-variant px-3 py-4">
        <button
          onClick={() => navigate("/app/support")}
          className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container"
        >
          <HelpCircle size={18} />
          Support
        </button>
        <button
          onClick={handleSignOut}
          className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function AppShell({ title, subtitle, children }) {
  return (
    <RealtimeProvider>
      <AppShellInner title={title} subtitle={subtitle}>
        {children}
      </AppShellInner>
    </RealtimeProvider>
  );
}

function AppShellInner({ title, subtitle, children }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useDarkMode();
  const [searchQuery, setSearchQuery] = useState("");

  // Only patients are actually searchable server-side (GET /patients?search=),
  // so this wires to that real endpoint rather than promising a unified
  // search across calls/appointments that the backend doesn't support.
  function submitSearch(e) {
    e.preventDefault();
    const q = searchQuery.trim();
    navigate(q ? `/app/patients?search=${encodeURIComponent(q)}` : "/app/patients");
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-outline-variant bg-surface-lowest lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface-lowest shadow-xl">
            <button
              className="focus-ring absolute right-3 top-4 rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b border-outline-variant bg-surface-lowest/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              className="focus-ring rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>

            <form onSubmit={submitSearch} className="relative hidden max-w-md flex-1 sm:block">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patients by name or MRN..."
                className="focus-ring w-full rounded-full border border-outline-variant bg-surface-low py-2 pl-9 pr-4 text-sm placeholder:text-on-surface-variant/70"
              />
            </form>

            <div className="ml-auto flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:block">
                <ConnectionDot />
              </div>
              <button
                onClick={() => setDark((d) => !d)}
                className="focus-ring relative rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
                aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {dark ? <Sun size={19} /> : <Moon size={19} />}
              </button>
              <NotificationBell />
              <button
                onClick={() => navigate("/app/support")}
                className="focus-ring hidden rounded-full p-2 text-on-surface-variant hover:bg-surface-container sm:block"
                aria-label="Help"
              >
                <HelpCircle size={19} />
              </button>
              <div className="flex items-center gap-2.5 border-l border-outline-variant pl-3">
                <div className="hidden text-right leading-tight sm:block">
                  <p className="text-sm font-semibold text-on-surface">{org.name}</p>
                  <p className="text-xs text-on-surface-variant">{org.admin}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0f172a] text-sm font-semibold text-white">
                  {org.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          {(title || subtitle) && (
            <div className="mb-6">
              {title && <h1 className="font-display text-2xl font-bold text-on-surface sm:text-[28px]">{title}</h1>}
              {subtitle && <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}