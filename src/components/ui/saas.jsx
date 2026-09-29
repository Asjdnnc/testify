"use client";

import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared dashboard building blocks. Everything here uses theme tokens
// (bg-card, text-foreground, border, primary, success…) so it renders
// correctly in both light and dark mode — never hardcode slate/white/black.
// ---------------------------------------------------------------------------

export const TONES = {
  neutral: "bg-muted text-muted-foreground ring-border",
  primary: "bg-primary/10 text-primary ring-primary/20",
  success: "bg-success/12 text-success-foreground ring-success/25",
  warning: "bg-warning/15 text-warning-foreground ring-warning/30",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
  info: "bg-info/12 text-info-foreground ring-info/25",
};

const ICON_TONES = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/12 text-success-foreground",
  warning: "bg-warning/15 text-warning-foreground",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/12 text-info-foreground",
};

/** Page title row: title + description on the left, actions on the right. */
export function PageHeader({ title, description, actions, eyebrow, className }) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-wider text-primary">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Bordered surface with an optional header row. */
export function Panel({ title, description, actions, children, className, bodyClassName, noPadding = false }) {
  return (
    <section className={cn("rounded-xl border bg-card text-card-foreground shadow-xs", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(noPadding ? "" : "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** KPI tile. */
export function StatCard({ icon: Icon, label, value, hint, tone = "primary", href, loading = false }) {
  const body = (
    <div
      className={cn(
        "group h-full rounded-xl border bg-card p-5 shadow-xs transition-colors",
        href && "hover:border-primary/40 hover:bg-accent/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", ICON_TONES[tone])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {loading ? <span className="inline-block h-7 w-12 animate-pulse rounded bg-muted" /> : value ?? "—"}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">{body}</Link> : body;
}

/** Small coloured pill. */
export function StatusBadge({ tone = "neutral", children, dot = false, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone] || TONES.neutral,
        className
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Friendly placeholder for empty lists. */
export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center", className)}>
      {Icon && (
        <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </span>
      )}
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…", className }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground", className)}>
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

/** Search box with icon. */
export function SearchInput({ value, onChange, placeholder = "Search…", className }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary/50 focus:ring-3 focus:ring-ring"
      />
    </div>
  );
}

/** Pill-style tab switcher. options: [{ value, label, count? }] */
export function SegmentedTabs({ value, onChange, options, className }) {
  return (
    <div role="tablist" className={cn("inline-flex rounded-lg border bg-muted/60 p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
            {o.count != null && (
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-primary/10 text-primary" : "bg-muted")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Consistent form field label + control + hint. */
export function Field({ label, hint, children, className }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-9 w-full rounded-lg border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary/50 focus:ring-3 focus:ring-ring disabled:opacity-60";

/** Map domain statuses to badge tones in one place. */
export const EXAM_STATUS_TONE = { DRAFT: "neutral", PUBLISHED: "info", ACTIVE: "success", COMPLETED: "primary" };
export const ATTEMPT_STATUS_TONE = { IN_PROGRESS: "info", SUBMITTED: "success", TIMED_OUT: "warning", CHEATED: "danger" };
export const GRADING_STATUS_TONE = { AUTO_GRADED: "success", FULLY_GRADED: "success", MANUAL_REVIEW_PENDING: "warning", PUBLISHED: "primary" };
export const SUBSCRIPTION_TONE = { TRIAL: "warning", ACTIVE: "success", TRIAL_EXPIRED: "danger", SUSPENDED: "danger", CANCELLED: "neutral" };

export const humanize = (s) => (s ? s.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "");

/** Accessible modal dialog. */
export function Modal({ open, onClose, title, description, children, footer, size = "md" }) {
  if (!open) return null;
  const width = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" }[size];
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" onKeyDown={(e) => e.key === "Escape" && onClose?.()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cn("relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 sm:rounded-2xl", width)}
      >
        <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export const selectClass =
  "h-9 w-full rounded-lg border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-3 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const TITLES = new Set(["dr", "dr.", "prof", "prof.", "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "sir", "smt", "smt.", "shri"]);
/** First name for greetings — skips honorifics like "Dr." or "Prof.". */
export function firstName(name, fallback = "there") {
  const parts = (name || "").split(/\s+/).filter(Boolean);
  const first = parts.find((p) => !TITLES.has(p.toLowerCase()));
  return first || fallback;
}
