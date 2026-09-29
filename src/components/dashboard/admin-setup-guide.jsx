"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  GitBranch, Layers, BookOpen, Users, GraduationCap, CreditCard,
  CheckCircle2, Circle, Lock, ArrowRight, X, Sparkles, ListChecks,
} from "lucide-react";

// ---------------------------------------------------------------------------
// First-run setup guide for college admins. Progress is computed from real
// data (so steps tick themselves off), while "dismissed" is a per-browser
// convenience kept in local/session storage.
// ---------------------------------------------------------------------------

export const SETUP_STEPS = [
  {
    key: "branches",
    title: "Create your departments",
    desc: "Add branches such as CSE or ECE. You can create graduation-year batches at the same time.",
    href: "/dashboard/admin/branches",
    cta: "Add a branch",
    icon: GitBranch,
    done: (c) => c.branches > 0,
  },
  {
    key: "batches",
    title: "Set up class batches",
    desc: "Batches are student cohorts inside a branch, named by graduation year (e.g. 2028).",
    href: "/dashboard/admin/batches",
    cta: "Add a batch",
    icon: Layers,
    done: (c) => c.batches > 0,
    requires: (c) => (c.branches > 0 ? null : "Create a branch first"),
  },
  {
    key: "subjects",
    title: "Add subjects",
    desc: "Teachers build question banks and exams per subject. Credits are used for GPA.",
    href: "/dashboard/admin/subjects",
    cta: "Add subjects",
    icon: BookOpen,
    done: (c) => c.subjects > 0,
  },
  {
    key: "teachers",
    title: "Invite teachers",
    desc: "Each teacher gets an email with a temporary password. Upload a spreadsheet to add many at once.",
    href: "/dashboard/admin/teachers",
    cta: "Invite teachers",
    icon: Users,
    done: (c) => c.teachers > 0,
  },
  {
    key: "students",
    title: "Enrol students",
    desc: "Pick a branch and batch, then add students one by one or upload a spreadsheet (Name, Email, Branch, Batch).",
    href: "/dashboard/admin/students",
    cta: "Enrol students",
    icon: GraduationCap,
    done: (c) => c.students > 0,
    requires: (c) => (c.batches > 0 ? null : "Create a batch first"),
  },
];

const PLAN_STEP = {
  key: "plan",
  title: "Choose a plan (optional)",
  desc: "Your trial has limits on teachers, students and exams. Upgrade any time to remove them.",
  href: "/dashboard/admin/billing",
  cta: "View plans",
  icon: CreditCard,
};

function storage(kind) {
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}
function readFlag(kind, key) {
  try { return storage(kind)?.getItem(key) === "1"; } catch { return false; }
}
function writeFlag(kind, key) {
  try { storage(kind)?.setItem(key, "1"); } catch {}
}

export function useSetupProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(null);

  const [reloadTick, setReloadTick] = useState(0);
  const load = useCallback(() => setReloadTick((t) => t + 1), []);

  // Re-check whenever the admin navigates, so finished steps tick off
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/setup-progress")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.success) setProgress(json.progress);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pathname, reloadTick]);

  const counts = progress?.counts;
  const steps = SETUP_STEPS.map((s) => ({
    ...s,
    isDone: counts ? s.done(counts) : false,
    blockedBy: counts && s.requires ? s.requires(counts) : null,
  }));
  const doneCount = steps.filter((s) => s.isDone).length;

  return {
    loaded: !!progress,
    progress,
    steps,
    doneCount,
    total: steps.length,
    complete: !!progress && doneCount === steps.length,
    reload: load,
  };
}

function StepRow({ step, index, onNavigate, isNext }) {
  const Icon = step.icon;
  return (
    <li
      className={`flex gap-4 rounded-2xl border p-4 transition-colors ${
        step.isDone ? "border-emerald-500/20 bg-emerald-500/5" : isNext ? "border-primary/40 bg-primary/5" : "border-border"
      }`}
    >
      <div className="pt-0.5">
        {step.isDone ? (
          <CheckCircle2 className="size-6 text-emerald-500" />
        ) : step.blockedBy ? (
          <Lock className="size-6 text-muted-foreground/60" />
        ) : (
          <Circle className={`size-6 ${isNext ? "text-primary" : "text-muted-foreground/60"}`} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground shrink-0" />
          <p className={`font-semibold ${step.isDone ? "text-muted-foreground line-through decoration-emerald-500/40" : "text-foreground"}`}>
            {index + 1}. {step.title}
          </p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
        {!step.isDone && (
          step.blockedBy ? (
            <p className="mt-2 text-xs font-medium text-muted-foreground">{step.blockedBy}</p>
          ) : (
            <Link
              href={step.href}
              onClick={onNavigate}
              className={`mt-3 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                isNext ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border hover:bg-muted"
              }`}
            >
              {step.cta} <ArrowRight className="size-4" />
            </Link>
          )
        )}
      </div>
    </li>
  );
}

export function SetupChecklist({ guide, onNavigate, showPlan = true }) {
  const nextKey = guide.steps.find((s) => !s.isDone && !s.blockedBy)?.key;
  const pct = Math.round((guide.doneCount / guide.total) * 100);
  const onPaidPlan = guide.progress?.subscriptionStatus === "ACTIVE";

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">{guide.doneCount} of {guide.total} steps complete</span>
          <span className="tabular-nums text-muted-foreground">{pct}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ol className="space-y-3">
        {guide.steps.map((step, i) => (
          <StepRow key={step.key} step={step} index={i} isNext={step.key === nextKey} onNavigate={onNavigate} />
        ))}
      </ol>
      {showPlan && !onPaidPlan && (
        <Link
          href={PLAN_STEP.href}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-2xl border border-dashed p-4 text-sm hover:bg-muted transition-colors"
        >
          <PLAN_STEP.icon className="size-5 text-muted-foreground" />
          <span className="flex-1">
            <span className="font-semibold text-foreground">{PLAN_STEP.title}</span>
            <span className="block text-muted-foreground">{PLAN_STEP.desc}</span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
      )}
    </div>
  );
}

/**
 * Mounted once in the dashboard layout for ADMIN users:
 *  - opens automatically (first login / until setup is done) unless dismissed
 *  - leaves a floating "Setup x/5" pill to reopen it
 */
export default function AdminSetupGuide() {
  const { user } = useAuth();
  const guide = useSetupProgress();
  const [open, setOpen] = useState(false);
  const [pillHidden, setPillHidden] = useState(false);

  const permKey = `testify:setup-guide:dismissed:${user?.id}`;
  const sessionKey = `testify:setup-guide:snoozed:${user?.id}`;
  const celebratedKey = `testify:setup-guide:celebrated:${user?.id}`;

  useEffect(() => {
    if (!guide.loaded || !user?.id) return;
    if (guide.complete) {
      // Show a one-time "all done" message, then get out of the way
      if (!readFlag("local", celebratedKey) && !readFlag("local", permKey) && guide.doneCount > 0) {
        setOpen(true);
      }
      return;
    }
    if (!readFlag("local", permKey) && !readFlag("session", sessionKey)) setOpen(true);
    setPillHidden(readFlag("local", permKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.loaded, guide.complete, user?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") snooze(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function snooze() {
    writeFlag("session", sessionKey);
    if (guide.complete) writeFlag("local", celebratedKey);
    setOpen(false);
  }
  function dismissForever() {
    writeFlag("local", permKey);
    setPillHidden(true);
    setOpen(false);
  }

  if (!user || user.role !== "ADMIN" || !guide.loaded) return null;

  return (
    <>
      {/* Floating re-open pill */}
      {!open && !guide.complete && !pillHidden && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-xl hover:bg-primary/90 transition-colors"
        >
          <ListChecks className="size-4" />
          Setup {guide.doneCount}/{guide.total}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-sm p-0 sm:p-6" onClick={snooze}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="setup-guide-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border bg-card p-6 sm:p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-300"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="size-5 text-primary" />
                </div>
                <div>
                  <h2 id="setup-guide-title" className="text-xl font-bold tracking-tight text-foreground">
                    {guide.complete ? "Your college is ready 🎉" : `Welcome${user.name ? `, ${user.name.split(" ")[0]}` : ""}! Let's set up ${guide.progress?.collegeName || "your college"}`}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {guide.complete
                      ? "Teachers can now build exams and students will see them on their dashboard."
                      : "Follow these steps in order — each one ticks off automatically when it's done."}
                  </p>
                </div>
              </div>
              <button onClick={snooze} aria-label="Close" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-6">
              <SetupChecklist guide={guide} onNavigate={snooze} />
            </div>

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              {guide.complete ? (
                <span />
              ) : (
                <button onClick={dismissForever} className="text-sm text-muted-foreground hover:text-foreground">
                  Don&apos;t show this again
                </button>
              )}
              <button
                onClick={snooze}
                className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
              >
                {guide.complete ? "Great, thanks" : "I'll do it later"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
