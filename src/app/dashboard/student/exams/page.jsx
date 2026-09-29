"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { studentClient } from "@/lib/api-client/student.client";
import { Button } from "@/components/ui/button";
import { Clock, FileText, CalendarClock, Play, History, ArrowRight, ShieldAlert } from "lucide-react";
import {
  PageHeader, SegmentedTabs, StatusBadge, EmptyState, LoadingState, ATTEMPT_STATUS_TONE, humanize,
} from "@/components/ui/saas";

const FINAL = ["SUBMITTED", "TIMED_OUT", "CHEATED"];

function formatDateTime(date) {
  if (!date) return "";
  return new Date(date).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ExamCard({ exam, kind }) {
  const attempt = exam.attempts?.[0];
  const inProgress = attempt?.status === "IN_PROGRESS";

  return (
    <div className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <StatusBadge tone="neutral">{exam.subject?.name}</StatusBadge>
        {kind === "open" && inProgress && <StatusBadge tone="info" dot>In progress</StatusBadge>}
        {kind === "open" && !inProgress && <StatusBadge tone="success" dot>Open</StatusBadge>}
        {kind === "upcoming" && <StatusBadge tone="info">Opens {formatDateTime(exam.startTime)}</StatusBadge>}
        {kind === "past" && (
          attempt && FINAL.includes(attempt.status)
            ? <StatusBadge tone={ATTEMPT_STATUS_TONE[attempt.status]}>{attempt.status === "CHEATED" ? "Terminated" : humanize(attempt.status)}</StatusBadge>
            : <StatusBadge tone="danger">Missed</StatusBadge>
        )}
      </div>

      <h3 className="mt-3 text-base font-semibold leading-snug text-foreground">{exam.title}</h3>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" /> {exam.duration} min</span>
        <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" /> {exam.totalMarks} marks</span>
        {kind === "open" && exam.endTime && <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-3.5" /> Closes {formatDateTime(exam.endTime)}</span>}
      </div>

      <div className="mt-auto pt-5">
        {kind === "open" ? (
          <Button asChild className="w-full">
            <Link href={`/dashboard/student/exams/${exam.id}/lobby`}>
              {inProgress ? "Resume exam" : "Start exam"} <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : kind === "past" && attempt?.status === "CHEATED" ? (
          <p className="flex items-center gap-1.5 text-xs text-destructive"><ShieldAlert className="size-3.5" /> Ended for proctoring violations</p>
        ) : kind === "past" && attempt && FINAL.includes(attempt.status) ? (
          <Link href="/dashboard/student/results" className="text-sm font-medium text-primary hover:underline">View result</Link>
        ) : kind === "upcoming" ? (
          <p className="text-xs text-muted-foreground">You can start once the window opens.</p>
        ) : (
          <p className="text-xs text-muted-foreground">The exam window has closed.</p>
        )}
      </div>
    </div>
  );
}

export default function StudentExamsPage() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("open");

  useEffect(() => {
    if (!user) return;
    studentClient.exams.list()
      .then((res) => { if (res.success) setExams(res.exams); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const now = new Date();
  const finished = (e) => e.attempts?.[0] && FINAL.includes(e.attempts[0].status);
  const windowClosed = (e) => e.status === "COMPLETED" || (e.endTime && new Date(e.endTime) < now);

  const open = exams.filter((e) =>
    !finished(e) && !windowClosed(e) &&
    (e.status === "ACTIVE" || (e.status === "PUBLISHED" && (!e.startTime || new Date(e.startTime) <= now)))
  );
  const upcoming = exams.filter((e) => !finished(e) && e.status === "PUBLISHED" && e.startTime && new Date(e.startTime) > now);
  const past = exams.filter((e) => finished(e) || windowClosed(e));

  const lists = { open, upcoming, past };
  const current = lists[tab];

  const empty = {
    open: { icon: Play, title: "No exams open right now", description: "Check the Upcoming tab for scheduled exams." },
    upcoming: { icon: CalendarClock, title: "Nothing scheduled", description: "New exams from your teachers will show up here." },
    past: { icon: History, title: "No past exams yet", description: "Exams you've taken or missed will be listed here." },
  }[tab];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My exams"
        description={[user?.branch?.name, user?.batch?.name && `Batch ${user.batch.name}`].filter(Boolean).join(" · ") || "Exams assigned to your batch"}
      />

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "open", label: "Open", count: open.length },
          { value: "upcoming", label: "Upcoming", count: upcoming.length },
          { value: "past", label: "Past", count: past.length },
        ]}
      />

      {loading ? (
        <LoadingState label="Loading exams…" />
      ) : current.length === 0 ? (
        <EmptyState {...empty} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {current.map((exam) => <ExamCard key={exam.id} exam={exam} kind={tab} />)}
        </div>
      )}
    </div>
  );
}
