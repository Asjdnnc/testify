"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { useSetupProgress, SetupChecklist } from "@/components/dashboard/admin-setup-guide";
import {
  GitBranch, Users, GraduationCap, BookOpen, ClipboardList, CreditCard, ArrowRight, AlertTriangle, Layers, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  firstName, PageHeader, Panel, StatCard, StatusBadge, SUBSCRIPTION_TONE } from "@/components/ui/saas";

const STATUS_LABEL = { TRIAL: "Free trial", TRIAL_EXPIRED: "Trial expired", ACTIVE: "Active", SUSPENDED: "Suspended", CANCELLED: "Cancelled" };

function daysUntil(date) {
  if (!date) return null;
  return Math.max(0, Math.ceil((new Date(date) - new Date()) / 864e5));
}

function SetupCard() {
  const guide = useSetupProgress();
  if (!guide.loaded || guide.complete) return null;
  return (
    <Panel title="Finish setting up your college" description="Complete these steps so teachers can create exams and students can take them.">
      <SetupChecklist guide={guide} />
    </Panel>
  );
}

function Meter({ label, current, max }) {
  const unlimited = max == null;
  const pct = unlimited ? 100 : Math.min(100, Math.round((current / Math.max(max, 1)) * 100));
  const tone = unlimited ? "bg-success/40" : pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary";
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">{current}<span className="text-muted-foreground"> / {unlimited ? "∞" : max}</span></span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/account/billing").then((r) => r.json()),
    ])
      .then(([statsRes, billingRes]) => {
        if (statsRes.success) setStats(statsRes.stats);
        if (billingRes.success) setBilling(billingRes.billing);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const status = billing?.subscriptionStatus || "TRIAL";
  const isLocked = ["TRIAL_EXPIRED", "SUSPENDED", "CANCELLED"].includes(status);
  const expiryDays = status === "TRIAL" ? daysUntil(billing?.trialEndsAt) : status === "ACTIVE" ? daysUntil(billing?.currentPeriodEnd) : null;
  const c = stats?.college || {};

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${firstName(user?.name)}`}
        description={`Here's how ${user?.college?.name || "your college"} is doing.`}
        actions={
          <>
            <Button asChild variant="outline"><Link href="/dashboard/admin/students"><UserPlus className="size-4" /> Add students</Link></Button>
            <Button asChild><Link href="/dashboard/admin/teachers"><UserPlus className="size-4" /> Invite teachers</Link></Button>
          </>
        }
      />

      {isLocked && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-foreground">Your account is read-only</p>
              <p className="text-sm text-muted-foreground">
                {status === "TRIAL_EXPIRED" ? "Your free trial has ended." : status === "SUSPENDED" ? "Your subscription has lapsed." : "Your account is cancelled."} Choose a plan to restore full access.
              </p>
            </div>
          </div>
          {status !== "CANCELLED" && <Button asChild size="sm"><Link href="/dashboard/admin/billing">Choose a plan</Link></Button>}
        </div>
      )}

      <SetupCard />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={GraduationCap} label="Students" value={c.studentCount ?? 0} hint="Across all batches" tone="primary" loading={loading} href="/dashboard/admin/students" />
        <StatCard icon={Users} label="Teachers" value={c.teacherCount ?? 0} hint="Faculty accounts" tone="info" loading={loading} href="/dashboard/admin/teachers" />
        <StatCard icon={ClipboardList} label="Exams" value={c.examTotal ?? 0} hint="Created by your teachers" tone="success" loading={loading} />
        <StatCard icon={GitBranch} label="Branches" value={c.branchCount ?? 0} hint="Academic departments" tone="warning" loading={loading} href="/dashboard/admin/branches" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="Subscription"
          actions={<Link href="/dashboard/admin/billing" className="text-sm font-medium text-primary hover:underline">Manage</Link>}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-semibold text-foreground">{billing?.plan || "Trial"}</p>
              <p className="text-sm text-muted-foreground">
                {status === "TRIAL" && expiryDays != null ? `${expiryDays} day${expiryDays !== 1 ? "s" : ""} left in trial`
                  : status === "ACTIVE" && expiryDays != null ? `Renews in ${expiryDays} day${expiryDays !== 1 ? "s" : ""}`
                  : "Upgrade to restore access"}
              </p>
            </div>
            <StatusBadge tone={SUBSCRIPTION_TONE[status]} dot>{STATUS_LABEL[status]}</StatusBadge>
          </div>
          {billing?.usage && (
            <div className="mt-5 space-y-4 border-t pt-5">
              <Meter label="Teachers" {...billing.usage.teachers} />
              <Meter label="Students" {...billing.usage.students} />
              <Meter label="Exams" {...billing.usage.exams} />
            </div>
          )}
          {status === "TRIAL" && (
            <Button asChild className="mt-5 w-full"><Link href="/dashboard/admin/billing"><CreditCard className="size-4" /> Upgrade plan</Link></Button>
          )}
        </Panel>

        <Panel title="Manage your college" className="lg:col-span-2" bodyClassName="grid gap-2 sm:grid-cols-2">
          {[
            { label: "Branches", desc: "Departments such as CSE or ECE", icon: GitBranch, href: "/dashboard/admin/branches" },
            { label: "Batches", desc: "Student cohorts by graduation year", icon: Layers, href: "/dashboard/admin/batches" },
            { label: "Subjects", desc: "Courses, codes and credits", icon: BookOpen, href: "/dashboard/admin/subjects" },
            { label: "Teachers", desc: "Invite and manage faculty", icon: Users, href: "/dashboard/admin/teachers" },
            { label: "Students", desc: "Enrol individually or in bulk", icon: GraduationCap, href: "/dashboard/admin/students" },
            { label: "Billing & plan", desc: "Subscription and invoices", icon: CreditCard, href: "/dashboard/admin/billing" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><item.icon className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="truncate text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </Panel>
      </div>
    </div>
  );
}
