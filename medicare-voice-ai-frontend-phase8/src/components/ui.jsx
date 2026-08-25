import { AlertTriangle, X } from "lucide-react";

export function Card({ className = "", children, hoverable = false, ...props }) {
  return (
    <div
      className={`rounded-2xl border border-outline-variant bg-surface-lowest shadow-[0_4px_20px_rgba(15,23,42,0.05)] transition-shadow duration-200 dark:shadow-[0_4px_20px_rgba(0,0,0,0.25)] ${
        hoverable ? "hover:shadow-[0_8px_28px_rgba(15,23,42,0.09)]" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

const TONES = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  info: "bg-info-bg text-info",
  neutral: "bg-surface-container text-on-surface-variant",
  error: "bg-error-bg text-error",
};

export function Chip({ tone = "neutral", children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Button({ variant = "primary", className = "", children, ...props }) {
  const styles = {
    primary: "text-white shadow-sm hover:brightness-110",
    secondary: "border border-[#0f172a] text-[#0f172a] hover:bg-surface-container",
    ghost: "text-on-surface-variant hover:bg-surface-container",
    outline: "border border-outline-variant text-on-surface hover:bg-surface-container",
  };
  return (
    <button
      className={`focus-ring inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${styles[variant]} ${className}`}
      style={variant === "primary" ? { backgroundColor: "#059669" } : undefined}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * EmptyState — consistent "nothing here yet" treatment for lists, tables, and panels.
 * icon: a lucide-react component (not an element) so size/color can be controlled here.
 */
export function EmptyState({ icon: Icon, title, detail, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container">
          <Icon size={20} className="text-on-surface-variant" />
        </div>
      )}
      <p className="text-sm font-semibold text-on-surface">{title}</p>
      {detail && <p className="mt-1 max-w-xs text-sm text-on-surface-variant">{detail}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * ErrorState — consistent "this failed to load" treatment for panels/lists that hit
 * an API error. Pass onRetry to show a retry action (omit it for a static message).
 */
export function ErrorState({ title = "Something went wrong", detail, onRetry, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-error-bg">
        <AlertTriangle size={20} className="text-error" />
      </div>
      <p className="text-sm font-semibold text-on-surface">{title}</p>
      {detail && <p className="mt-1 max-w-xs text-sm text-on-surface-variant">{detail}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="focus-ring mt-4 text-sm font-semibold"
          style={{ color: "#059669" }}
        >
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * Skeleton — animated placeholder block for loading states. Pass className to size it,
 * e.g. <Skeleton className="h-4 w-32" /> or <Skeleton className="h-10 w-10 rounded-full" />.
 */
export function Skeleton({ className = "", style }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-surface-container ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

/**
 * ConfirmDialog — modal confirmation for destructive/state-changing actions
 * (suspend org, reinstate org, deactivate user, etc). Renders nothing when
 * `open` is false. `children` (optional) can hold extra inline controls,
 * e.g. a "reason" text input, above the Cancel/Confirm buttons.
 */
export function ConfirmDialog({
  open,
  title,
  detail,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "error",
  busy = false,
  onConfirm,
  onCancel,
  children,
}) {
  if (!open) return null;
  const confirmStyle =
    tone === "error"
      ? { backgroundColor: "#dc2626" }
      : { backgroundColor: "#059669" };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && !busy && onCancel?.()}
    >
      <Card className="w-full max-w-sm p-5">
        <p className="text-sm font-semibold text-on-surface">{title}</p>
        {detail && <p className="mt-1.5 text-sm text-on-surface-variant">{detail}</p>}
        {children && <div className="mt-3">{children}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
            style={confirmStyle}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </Card>
    </div>
  );
}

/**
 * Modal — generic centered dialog for forms (create/edit plan, etc).
 * Renders nothing when `open` is false. Closing via backdrop click or the
 * X button both call onClose; callers control their own busy/disabled state.
 */
export function Modal({ open, title, onClose, children, className = "" }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <Card className={`w-full max-w-lg p-5 ${className}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-base font-bold text-on-surface">{title}</p>
          <button
            onClick={onClose}
            className="focus-ring rounded-lg p-1 text-on-surface-variant hover:bg-surface-container"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </Card>
    </div>
  );
}
