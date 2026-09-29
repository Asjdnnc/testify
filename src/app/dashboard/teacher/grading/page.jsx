"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckSquare, ArrowRight, ClipboardCheck, Clock, Users } from "lucide-react";
import { PageHeader, Panel, StatCard, StatusBadge, EmptyState, LoadingState } from "@/components/ui/saas";

export default function GradingDashboard() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/grading/pending")
      .then((res) => res.json())
      .then((data) => { if (data.success) setExams(data.exams); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pending = exams.reduce((n, e) => n + e.pendingCount, 0);
  const total = exams.reduce((n, e) => n + e.totalCount, 0);
  const sorted = [...exams].sort((a, b) => b.pendingCount - a.pendingCount);

  return (
    <div className="space-y-8">
      <PageHeader title="Grading" description="Review submissions and mark written answers. Multiple-choice answers are graded automatically." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Clock} label="Waiting for you" value={pending} hint="Submissions with ungraded written answers" tone="warning" loading={loading} />
        <StatCard icon={ClipboardCheck} label="Graded" value={total - pending} hint="Results ready for students" tone="success" loading={loading} />
        <StatCard icon={Users} label="Total submissions" value={total} hint={`Across ${exams.length} exam${exams.length !== 1 ? "s" : ""}`} tone="primary" loading={loading} />
      </div>

      <Panel title="Exams with submissions" noPadding>
        {loading ? (
          <LoadingState />
        ) : sorted.length === 0 ? (
          <EmptyState icon={CheckSquare} title="Nothing to grade yet" description="Submissions appear here once students finish your exams." className="m-5" />
        ) : (
          <ul className="divide-y">
            {sorted.map((exam) => {
              const pct = exam.totalCount ? Math.round((exam.completedCount / exam.totalCount) * 100) : 0;
              return (
                <li key={exam.id}>
                  <Link href={`/dashboard/teacher/grading/${exam.id}`} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{exam.title}</p>
                      <p className="text-xs text-muted-foreground">{exam.subject}</p>
                    </div>
                    <div className="w-full sm:w-48">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{exam.completedCount} of {exam.totalCount} graded</span>
                        <span className="tabular-nums text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:w-40 sm:justify-end">
                      {exam.pendingCount > 0
                        ? <StatusBadge tone="warning" dot>{exam.pendingCount} to grade</StatusBadge>
                        : <StatusBadge tone="success">All graded</StatusBadge>}
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
