"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { ClipboardList, Radio, Users, CheckSquare, Plus, FileQuestion, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  firstName, PageHeader, Panel, StatCard, StatusBadge, EmptyState, LoadingState, EXAM_STATUS_TONE, humanize,
} from "@/components/ui/saas";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/org/exams").then((r) => r.json()),
    ])
      .then(([statsRes, examsRes]) => {
        if (statsRes.success) setStats(statsRes.stats);
        if (examsRes.success) setExams(examsRes.exams || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const count = (s) => exams.filter((e) => e.status === s).length;
  const pending = stats?.pendingGrades ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${firstName(user?.name)}`}
        description="Here's what's happening with your exams today."
        actions={
          <Button asChild>
            <Link href="/dashboard/teacher/exams?new=1"><Plus className="size-4" /> New exam</Link>
          </Button>
        }
      />

      {pending > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 shrink-0 text-warning-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {pending} submission{pending !== 1 ? "s" : ""} waiting for grading
              </p>
              <p className="text-xs text-muted-foreground">Students see their final result once written answers are marked.</p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/teacher/grading">Start grading <ArrowRight className="size-3.5" /></Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ClipboardList} label="Total exams" value={exams.length} hint={`${count("DRAFT")} draft${count("DRAFT") !== 1 ? "s" : ""}`} tone="primary" loading={loading} href="/dashboard/teacher/exams" />
        <StatCard icon={Radio} label="Live now" value={count("ACTIVE")} hint={`${count("PUBLISHED")} scheduled`} tone="success" loading={loading} />
        <StatCard icon={Users} label="Students in exams" value={stats?.activeAttempts ?? 0} hint="Attempts in progress" tone="info" loading={loading} />
        <StatCard icon={CheckSquare} label="To grade" value={pending} hint="Written answers pending" tone="warning" loading={loading} href="/dashboard/teacher/grading" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Recent exams"
          actions={<Link href="/dashboard/teacher/exams" className="text-sm font-medium text-primary hover:underline">View all</Link>}
          noPadding
        >
          {loading ? (
            <LoadingState />
          ) : exams.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No exams yet"
              description="Create your first exam, add questions from the bank and publish it to a batch."
              action={<Button asChild size="sm"><Link href="/dashboard/teacher/exams?new=1"><Plus className="size-4" /> Create exam</Link></Button>}
              className="m-5"
            />
          ) : (
            <ul className="divide-y">
              {exams.slice(0, 6).map((exam) => (
                <li key={exam.id}>
                  <Link href={`/dashboard/teacher/exams/${exam.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{exam.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {exam.subject?.name} · {exam._count?.questions ?? 0} questions · {exam._count?.attempts ?? 0} attempts
                      </p>
                    </div>
                    <StatusBadge tone={EXAM_STATUS_TONE[exam.status]} dot>{humanize(exam.status)}</StatusBadge>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Quick actions" bodyClassName="space-y-2">
          {[
            { label: "Create an exam", desc: "Draft, add questions, publish", icon: Plus, href: "/dashboard/teacher/exams?new=1" },
            { label: "Question bank", desc: "Write or import questions", icon: FileQuestion, href: "/dashboard/teacher/questions" },
            { label: "Grade submissions", desc: "Mark written answers", icon: CheckSquare, href: "/dashboard/teacher/grading" },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><item.icon className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </Panel>
      </div>
    </div>
  );
}
