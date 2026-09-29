"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Play, CalendarClock, CheckCircle2, Trophy, ArrowRight, ClipboardList, BarChart3, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  firstName, PageHeader, Panel, StatCard, StatusBadge, EmptyState, LoadingState,
} from "@/components/ui/saas";

function formatWhen(date) {
  if (!date) return null;
  return new Date(date).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ExamRow({ exam }) {
  const attempt = exam.attempts?.[0];
  const done = attempt && attempt.status !== "IN_PROGRESS";
  const inProgress = attempt?.status === "IN_PROGRESS";
  const live = exam.status === "ACTIVE" || (exam.status === "PUBLISHED" && (!exam.startTime || new Date(exam.startTime) <= new Date()));

  return (
    <li className="flex items-center gap-4 px-5 py-3.5">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${live ? "bg-success/12 text-success-foreground" : "bg-muted text-muted-foreground"}`}>
        {live ? <Play className="size-4" /> : <CalendarClock className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{exam.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {exam.subject?.name} · {exam.duration} min
          {exam.startTime && !live && ` · Opens ${formatWhen(exam.startTime)}`}
          {exam.endTime && live && ` · Closes ${formatWhen(exam.endTime)}`}
        </p>
      </div>
      {done ? (
        <StatusBadge tone="neutral">Submitted</StatusBadge>
      ) : live ? (
        <Button asChild size="sm">
          <Link href={`/dashboard/student/exams/${exam.id}/lobby`}>
            {inProgress ? "Resume" : "Start"} <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      ) : (
        <StatusBadge tone="info">Upcoming</StatusBadge>
      )}
    </li>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/student/exams").then((r) => r.json()),
      fetch("/api/student/results").then((r) => r.json()),
    ])
      .then(([statsRes, examsRes, resultsRes]) => {
        if (statsRes.success) setStats(statsRes.stats);
        if (examsRes.success) setExams(examsRes.exams || []);
        if (resultsRes.success) setResults(resultsRes.summary?.results || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const FINAL = ["SUBMITTED", "TIMED_OUT", "CHEATED"];
  // Open/upcoming = not yet taken and the window hasn't closed (same rules as the My exams page)
  const open = exams.filter((e) =>
    (e.status === "ACTIVE" || e.status === "PUBLISHED") &&
    (!e.endTime || new Date(e.endTime) >= new Date()) &&
    !FINAL.includes(e.attempts?.[0]?.status)
  );
  const liveCount = open.filter((e) => e.status === "ACTIVE" || !e.startTime || new Date(e.startTime) <= new Date()).length;
  const inProgress = stats?.inProgressAttempt;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${firstName(user?.name)}`}
        description="Your exams, deadlines and results in one place."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/student/exams"><ClipboardList className="size-4" /> All exams</Link>
          </Button>
        }
      />

      {inProgress && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary"><Clock className="size-4" /></span>
            <div>
              <p className="text-sm font-medium text-foreground">You have an exam in progress: {inProgress.exam?.title}</p>
              <p className="text-xs text-muted-foreground">Your answers are saved — the timer keeps running.</p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href={`/dashboard/student/exams/${inProgress.examId}/lobby`}><Play className="size-3.5" /> Resume exam</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Play} label="Open now" value={liveCount} hint="Ready to start" tone="success" loading={loading} />
        <StatCard icon={CalendarClock} label="Upcoming" value={open.length - liveCount} hint="Scheduled exams" tone="info" loading={loading} />
        <StatCard icon={CheckCircle2} label="Completed" value={stats?.completedAttempts ?? 0} hint="Exams submitted" tone="primary" loading={loading} />
        <StatCard
          icon={Trophy}
          label="Average score"
          value={stats?.avgPercentage != null ? `${stats.avgPercentage}%` : "—"}
          hint="Across graded exams"
          tone="warning"
          loading={loading}
          href="/dashboard/student/results"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="Your exams"
          description="Open and upcoming exams assigned to your batch."
          actions={<Link href="/dashboard/student/exams" className="text-sm font-medium text-primary hover:underline">View all</Link>}
          noPadding
        >
          {loading ? (
            <LoadingState />
          ) : open.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No exams right now" description="When your teachers publish an exam for your batch, it will appear here." className="m-5" />
          ) : (
            <ul className="divide-y">
              {open.slice(0, 6).map((exam) => <ExamRow key={exam.id} exam={exam} />)}
            </ul>
          )}
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="Recent results"
          actions={<Link href="/dashboard/student/results" className="text-sm font-medium text-primary hover:underline">View all</Link>}
          noPadding
        >
          {loading ? (
            <LoadingState />
          ) : results.length === 0 ? (
            <EmptyState icon={BarChart3} title="No results yet" description="Scores appear here after you submit an exam." className="m-5" />
          ) : (
            <ul className="divide-y">
              {results.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{r.exam?.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.exam?.subject?.name}</p>
                  </div>
                  {r.gradingStatus === "MANUAL_REVIEW_PENDING" ? (
                    <StatusBadge tone="warning">Awaiting review</StatusBadge>
                  ) : (
                    <span className={`text-sm font-semibold tabular-nums ${r.isPassed ? "text-success-foreground" : "text-destructive"}`}>
                      {Math.round(r.percentage ?? 0)}%
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
