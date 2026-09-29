"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, RefreshCw, Users, BarChart3, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Panel, StatCard, StatusBadge, EmptyState, LoadingState, SegmentedTabs, SearchInput,
} from "@/components/ui/saas";

function statusFor(r) {
  if (r.attempt?.status === "CHEATED") return { label: "Terminated", tone: "danger" };
  if (r.gradingStatus === "MANUAL_REVIEW_PENDING") return { label: "Needs grading", tone: "warning" };
  if (r.gradingStatus === "PUBLISHED") return { label: "Published", tone: "primary" };
  return { label: "Graded", tone: "success" };
}

export default function ExamAttemptsList() {
  const { id } = useParams();
  const [attempts, setAttempts] = useState([]);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [res, exRes] = await Promise.all([
        fetch(`/api/grading/pending?examId=${id}`).then((r) => r.json()),
        fetch(`/api/org/exams/${id}`).then((r) => r.json()),
      ]);
      if (res.success) setAttempts(res.attempts);
      if (exRes.success) setExam(exRes.exam);
    } catch {
      toast.error("Couldn't load submissions");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/org/exams/${id}/sync`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`Recalculated ${data.count} result${data.count !== 1 ? "s" : ""}`);
        loadData();
      } else toast.error(data.message || "Recalculation failed");
    } catch {
      toast.error("Recalculation failed");
    }
    setSyncing(false);
  }

  if (loading) return <LoadingState label="Loading submissions…" />;

  const pending = attempts.filter((a) => a.gradingStatus === "MANUAL_REVIEW_PENDING").length;
  const graded = attempts.filter((a) => a.gradingStatus !== "MANUAL_REVIEW_PENDING");
  const avg = graded.length ? Math.round(graded.reduce((s, a) => s + (a.percentage || 0), 0) / graded.length) : null;
  const passRate = graded.length ? Math.round((graded.filter((a) => a.isPassed).length / graded.length) * 100) : null;

  const shown = attempts
    .filter((a) => tab === "all" || (tab === "pending" ? a.gradingStatus === "MANUAL_REVIEW_PENDING" : a.gradingStatus !== "MANUAL_REVIEW_PENDING"))
    .filter((a) => `${a.student?.name} ${a.student?.email}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href="/dashboard/teacher/grading" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> Grading
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{exam?.title || "Submissions"}</h1>
          {exam && <p className="mt-1 text-sm text-muted-foreground">{exam.subject?.name} · out of {exam.totalMarks} marks{exam.passingMarks ? ` · pass mark ${exam.passingMarks}` : ""}</p>}
        </div>
        <Button variant="outline" onClick={handleSync} disabled={syncing} title="Re-run auto-grading for every submission (keeps your manual marks)">
          <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} /> Recalculate results
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Submissions" value={attempts.length} tone="primary" />
        <StatCard icon={Clock} label="Needs grading" value={pending} tone="warning" />
        <StatCard icon={BarChart3} label="Average score" value={avg != null ? `${avg}%` : "—"} hint="Graded submissions" tone="info" />
        <StatCard icon={CheckCircle2} label="Pass rate" value={passRate != null ? `${passRate}%` : "—"} hint="Graded submissions" tone="success" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: "All", count: attempts.length },
            { value: "pending", label: "Needs grading", count: pending },
            { value: "graded", label: "Graded", count: graded.length },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search students…" className="sm:w-64" />
      </div>

      <Panel noPadding>
        {shown.length === 0 ? (
          <EmptyState icon={Users} title="No submissions here" description="Try a different tab or search." className="m-5" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Student</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Submitted</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Score</th>
                  <th className="px-5 py-3"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((r) => {
                  const st = statusFor(r);
                  return (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">{r.student?.name}</p>
                        <p className="text-xs text-muted-foreground">{r.student?.email}</p>
                      </td>
                      <td className="hidden px-5 py-3 text-muted-foreground md:table-cell">
                        {r.attempt?.submittedAt ? new Date(r.attempt.submittedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="px-5 py-3"><StatusBadge tone={st.tone} dot>{st.label}</StatusBadge></td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        <span className="font-medium text-foreground">{r.totalMarksObtained}</span>
                        <span className="text-muted-foreground"> / {exam?.totalMarks ?? "—"}</span>
                        {r.percentage != null && <span className="ml-2 text-xs text-muted-foreground">({Math.round(r.percentage)}%)</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button asChild size="sm" variant={r.gradingStatus === "MANUAL_REVIEW_PENDING" ? "default" : "outline"}>
                          <Link href={`/dashboard/teacher/grading/attempt/${r.attempt.id}`}>
                            {r.gradingStatus === "MANUAL_REVIEW_PENDING" ? "Grade" : "Review"} <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
