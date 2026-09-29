"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Award, BarChart3, CheckCircle2 } from "lucide-react";
import {
  PageHeader, Panel, StatCard, StatusBadge, EmptyState, LoadingState, GRADING_STATUS_TONE,
} from "@/components/ui/saas";

export default function StudentResults() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/results")
      .then((res) => res.json())
      .then((data) => { if (data.success) setSummary(data.summary); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const results = summary?.results || [];
  const semesters = summary?.gpaBySemester || [];
  const graded = results.filter((r) => r.gradingStatus !== "MANUAL_REVIEW_PENDING");
  const passed = graded.filter((r) => r.isPassed).length;
  const avg = graded.length ? Math.round(graded.reduce((s, r) => s + (r.percentage || 0), 0) / graded.length) : null;
  const latestGPA = semesters[0]?.gpa ?? "—";
  const cgpa = summary?.cgpa ?? "—";

  return (
    <div className="space-y-8">
      <PageHeader title="Results" description="Your exam scores and GPA (4.0 scale: 90%+ = 4.0, 80% = 3.0, 70% = 2.0, 60% = 1.0)." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={GraduationCap} label="Semester GPA" value={latestGPA} hint={semesters[0] ? `Semester ${semesters[0].semester} · CGPA ${cgpa}` : "No graded exams yet"} tone="primary" loading={loading} />
        <StatCard icon={BarChart3} label="Average score" value={avg != null ? `${avg}%` : "—"} hint="Graded exams" tone="info" loading={loading} />
        <StatCard icon={CheckCircle2} label="Passed" value={`${passed} / ${graded.length}`} hint="Graded exams" tone="success" loading={loading} />
        <StatCard icon={Award} label="Awaiting review" value={results.length - graded.length} hint="Written answers being marked" tone="warning" loading={loading} />
      </div>

      {semesters.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {semesters.map((g) => (
            <Panel
              key={g.semester}
              title={`Semester ${g.semester}`}
              actions={<span className="text-xl font-semibold tabular-nums text-primary">{g.gpa}</span>}
            >
              <ul className="space-y-2.5">
                {g.breakDown.map((sub, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate text-foreground">{sub.subject}</span>
                      <span className="block truncate text-xs text-muted-foreground">{sub.credits} credits · {sub.examTitle}</span>
                    </span>
                    <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-foreground">GP {sub.gradePoint}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">{g.totalCredits} credits · best graded exam per subject counts</p>
            </Panel>
          ))}
        </div>
      )}

      <Panel title="Exam results" noPadding>
        {loading ? (
          <LoadingState />
        ) : results.length === 0 ? (
          <EmptyState icon={Award} title="No results yet" description="Your scores will appear here after you submit an exam." className="m-5" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Exam</th>
                  <th className="px-5 py-3 font-medium">Subject</th>
                  <th className="px-5 py-3 font-medium text-right">Score</th>
                  <th className="px-5 py-3 font-medium text-right">%</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {results.map((r) => {
                  const pending = r.gradingStatus === "MANUAL_REVIEW_PENDING";
                  return (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3 font-medium text-foreground">{r.exam.title}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.exam.subject.name}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-foreground">
                        {r.totalMarksObtained}<span className="text-muted-foreground"> / {r.exam.totalMarks}</span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-foreground">{(r.percentage ?? 0).toFixed(1)}</td>
                      <td className="px-5 py-3">
                        <StatusBadge tone={GRADING_STATUS_TONE[r.gradingStatus]}>{pending ? "Awaiting review" : "Released"}</StatusBadge>
                      </td>
                      <td className="px-5 py-3">
                        {pending || r.isPassed == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <StatusBadge tone={r.isPassed ? "success" : "danger"}>{r.isPassed ? "Pass" : "Fail"}</StatusBadge>
                        )}
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
