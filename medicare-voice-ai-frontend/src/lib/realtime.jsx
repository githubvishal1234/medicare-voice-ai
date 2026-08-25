/**
 * Dashboard real-time context (Phase 6).
 *
 * Wraps the shared dashboardSocket (src/lib/ws.js) in a React provider so
 * any page under AppShell can read live connection status, staff
 * notifications, and in-progress calls without managing the WebSocket
 * itself. Mounted once in AppShell — see components/AppShell.jsx.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { dashboardSocket, STATUS } from "./ws";
import { getToken } from "./api";

const RealtimeContext = createContext(null);

const MAX_NOTIFICATIONS = 30;
const TERMINAL_CALL_STATUSES = new Set(["completed", "failed", "no_answer"]);

/**
 * A call only belongs in "Live Active Calls" if it is genuinely in progress
 * *right now*. In addition to status/ended_at (already checked elsewhere),
 * guard against stale/demo rows whose start timestamp isn't today — a real
 * in-progress call is always started the same calendar day it's viewed.
 */
function isStartedToday(call) {
  const startedRaw = call.started_at || call.occurred_at;
  if (!startedRaw) return true; // no timestamp to judge by — don't hide it
  const started = new Date(startedRaw);
  if (Number.isNaN(started.getTime())) return true;
  const now = new Date();
  return (
    started.getFullYear() === now.getFullYear() &&
    started.getMonth() === now.getMonth() &&
    started.getDate() === now.getDate()
  );
}

function isGenuinelyActive(call) {
  return !TERMINAL_CALL_STATUSES.has(call.status) && !call.ended_at && isStartedToday(call);
}

export function RealtimeProvider({ children }) {
  const [status, setStatus] = useState(dashboardSocket.status);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveCalls, setLiveCalls] = useState({}); // id -> call summary

  useEffect(() => {
    if (!getToken()) return undefined;

    dashboardSocket.connect();
    const offStatus = dashboardSocket.onStatusChange(setStatus);

    const offNotification = dashboardSocket.on("notification", (data) => {
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        receivedAt: new Date().toISOString(),
        level: data.level || "info",
        title: data.title,
        message: data.message,
        data: data.data || {},
      };
      setNotifications((prev) => [entry, ...prev].slice(0, MAX_NOTIFICATIONS));
      setUnreadCount((c) => c + 1);
    });

    const upsertOrRemoveCall = (call) => {
      setLiveCalls((prev) => {
        // A call with a real ended_at timestamp, a terminal status, or a
        // start date that isn't today is never "live" — ended_at/status are
        // set once, by the backend, only when the call actually finished
        // (see app/routers/calls.py); the today-check guards against any
        // stale/demo record whose status was never correctly finalized.
        if (!isGenuinelyActive(call)) {
          if (!(call.id in prev)) return prev;
          const next = { ...prev };
          delete next[call.id];
          return next;
        }
        return { ...prev, [call.id]: call };
      });
    };

    const offStarted = dashboardSocket.on("call.started", upsertOrRemoveCall);
    const offUpdated = dashboardSocket.on("call.updated", upsertOrRemoveCall);
    const offEnded = dashboardSocket.on("call.ended", upsertOrRemoveCall);

    return () => {
      offStatus();
      offNotification();
      offStarted();
      offUpdated();
      offEnded();
      dashboardSocket.disconnect();
    };
  }, []);

  const markAllRead = useCallback(() => setUnreadCount(0), []);

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  /** Subscribe to any raw event ("appointment.booked", "call.transcript_message", "*", ...). */
  const subscribe = useCallback((eventType, handler) => dashboardSocket.on(eventType, handler), []);

  /** Manually re-sync liveCalls from a fresh REST fetch (e.g. list_calls filtered to in_progress). */
  const seedLiveCalls = useCallback((calls) => {
    setLiveCalls(() => {
      const next = {};
      for (const c of calls) {
        if (isGenuinelyActive(c)) next[c.id] = c;
      }
      return next;
    });
  }, []);

  const value = {
    connected: status === STATUS.OPEN,
    status,
    notifications,
    unreadCount,
    markAllRead,
    dismissNotification,
    liveCalls: Object.values(liveCalls).sort(
      (a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0)
    ),
    subscribe,
    seedLiveCalls,
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
}