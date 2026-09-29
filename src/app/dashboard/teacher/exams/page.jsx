"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { orgClient } from "@/lib/api-client/org.client";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList, Trash2, StopCircle, BarChart3, ArrowRight, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  PageHeader, Panel, SegmentedTabs, SearchInput, StatusBadge, EmptyState, LoadingState, Modal, Field,
  inputClass, selectClass,
} from "@/components/ui/saas";

const EMPTY_FORM = {
  title: "", description: "", duration: 60, totalMarks: 100, subjectId: "", semester: 1, branchId: "", batchId: "",
};

function formatDateTime(date) {
  if (!date) return null;
  return new Date(date).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** The status students effectively see, accounting for the schedule window. */
function effectiveStatus(ex) {
  const now = new Date();
  if ((ex.status === "ACTIVE" || ex.status === "PUBLISHED") && ex.endTime && new Date(ex.endTime) < now) return "ENDED";
  if (ex.status === "PUBLISHED" && ex.startTime && new Date(ex.startTime) > now) return "SCHEDULED";
  if (ex.status === "PUBLISHED") return "OPEN";
  return ex.status;
}

const STATUS_UI = {
  DRAFT: { label: "Draft", tone: "neutral", group: "draft" },
  SCHEDULED: { label: "Scheduled", tone: "info", group: "scheduled" },
  OPEN: { label: "Open", tone: "success", group: "live" },
  ACTIVE: { label: "Live", tone: "success", group: "live" },
  ENDED: { label: "Ended", tone: "primary", group: "completed" },
  COMPLETED: { label: "Completed", tone: "primary", group: "completed" },
};

function FacultyExams() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [branches, setBranches] = useState([]);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [isAdding, setIsAdding] = useState(searchParams.get("new") === "1");
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (user?.collegeId) loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [subRes, brRes, exRes] = await Promise.all([
        orgClient.subjects.list(user.collegeId),
        orgClient.branches.list(user.collegeId),
        orgClient.exams.list(),
      ]);
      if (subRes.success) setSubjects(subRes.subjects);
      if (brRes.success) setBranches(brRes.branches || []);
      if (exRes.success) setExams(exRes.exams);
    } catch (e) {
      console.error("Load failed", e);
    }
    setLoading(false);
  }

  function closeModal() {
    setIsAdding(false);
    if (searchParams.get("new")) router.replace("/dashboard/teacher/exams");
  }

  async function handleBranchChange(branchId) {
    setFormData((prev) => ({ ...prev, branchId, batchId: "" }));
    setAvailableBatches([]);
    if (branchId) {
      const bRes = await orgClient.batches.list(branchId);
      if (bRes.success) setAvailableBatches(bRes.batches || []);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.subjectId) return toast.error("Select a subject");
    setSaving(true);
    try {
      const res = await orgClient.exams.create(formData);
      if (res.success) {
        toast.success("Draft created — now add questions");
        setFormData(EMPTY_FORM);
        setAvailableBatches([]);
        router.push(`/dashboard/teacher/exams/${res.exam.id}`);
      } else {
        toast.error(res.message || "Couldn't create the exam");
      }
    } catch {
      toast.error("Couldn't create the exam");
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this exam? This can't be undone.")) return;
    const res = await orgClient.exams.delete(id).catch(() => null);
    if (res?.success) { toast.success("Exam deleted"); loadInitialData(); }
    else toast.error(res?.message || "Delete failed");
  }

  async function handleComplete(id) {
    if (!confirm("End this exam now? Students still writing will be submitted automatically.")) return;
    const res = await orgClient.exams.complete(id).catch(() => null);
    if (res?.success) { toast.success("Exam ended"); loadInitialData(); }
    else toast.error(res?.message || "Couldn't end the exam");
  }

  const withStatus = useMemo(() => exams.map((ex) => ({ ...ex, _status: effectiveStatus(ex) })), [exams]);
  const counts = useMemo(() => {
    const c = { all: withStatus.length, draft: 0, scheduled: 0, live: 0, completed: 0 };
    withStatus.forEach((ex) => { c[STATUS_UI[ex._status].group]++; });
    return c;
  }, [withStatus]);

  const filtered = withStatus.filter(
    (ex) =>
      (tab === "all" || STATUS_UI[ex._status].group === tab) &&
      ex.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exams"
        description="Create, schedule and monitor your assessments."
        actions={<Button onClick={() => setIsAdding(true)}><Plus className="size-4" /> New exam</Button>}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "draft", label: "Drafts", count: counts.draft },
            { value: "scheduled", label: "Scheduled", count: counts.scheduled },
            { value: "live", label: "Live", count: counts.live },
            { value: "completed", label: "Completed", count: counts.completed },
          ]}
          className="overflow-x-auto"
        />
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search exams…" className="lg:w-72" />
      </div>

      <Panel noPadding>
        {loading ? (
          <LoadingState label="Loading exams…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={exams.length === 0 ? "No exams yet" : "No exams match"}
            description={exams.length === 0 ? "Create a draft, add questions from your bank, then publish it to a batch." : "Try a different tab or search term."}
            action={exams.length === 0 && <Button size="sm" onClick={() => setIsAdding(true)}><Plus className="size-4" /> New exam</Button>}
            className="m-5"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Exam</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Schedule</th>
                  <th className="hidden px-5 py-3 text-right font-medium sm:table-cell">Questions</th>
                  <th className="hidden px-5 py-3 text-right font-medium sm:table-cell">Attempts</th>
                  <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((ex) => {
                  const ui = STATUS_UI[ex._status];
                  const canGrade = ["ENDED", "COMPLETED"].includes(ex._status) || ex._count?.attempts > 0;
                  return (
                    <tr key={ex.id} className="group hover:bg-muted/30">
                      <td className="px-5 py-3.5">
                        <Link href={`/dashboard/teacher/exams/${ex.id}`} className="block min-w-0">
                          <p className="truncate font-medium text-foreground group-hover:text-primary">{ex.title}</p>
                          <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-muted-foreground">
                            {ex.subject?.name}{ex.semester ? ` · Sem ${ex.semester}` : ""}
                            <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {ex.duration} min</span>
                          </p>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge tone={ui.tone} dot>{ui.label}</StatusBadge>
                      </td>
                      <td className="hidden px-5 py-3.5 text-xs text-muted-foreground md:table-cell">
                        {ex.startTime || ex.endTime ? (
                          <>
                            {ex.startTime && <div>{formatDateTime(ex.startTime)}</div>}
                            {ex.endTime && <div>→ {formatDateTime(ex.endTime)}</div>}
                          </>
                        ) : (
                          "No time window"
                        )}
                      </td>
                      <td className="hidden px-5 py-3.5 text-right tabular-nums text-foreground sm:table-cell">{ex._count?.questions ?? 0}</td>
                      <td className="hidden px-5 py-3.5 text-right tabular-nums text-foreground sm:table-cell">{ex._count?.attempts ?? 0}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {canGrade && (
                            <Button asChild variant="ghost" size="sm" title="Results">
                              <Link href={`/dashboard/teacher/grading/${ex.id}`}><BarChart3 className="size-4" /><span className="hidden xl:inline">Results</span></Link>
                            </Button>
                          )}
                          {ex.status === "ACTIVE" && ex._status !== "ENDED" && (
                            <Button variant="ghost" size="icon-sm" onClick={() => handleComplete(ex.id)} title="End exam now" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                              <StopCircle className="size-4" />
                            </Button>
                          )}
                          {(ex.status === "DRAFT" || ex.status === "PUBLISHED") && (
                            <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(ex.id)} title="Delete" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                          <Button asChild variant="ghost" size="icon-sm" title="Open">
                            <Link href={`/dashboard/teacher/exams/${ex.id}`}><ArrowRight className="size-4" /></Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        open={isAdding}
        onClose={closeModal}
        title="New exam"
        description="Create a draft. You'll add questions and publish it on the next screen."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit" form="new-exam-form" disabled={saving}>{saving ? "Creating…" : "Create draft"}</Button>
          </>
        }
      >
        <form id="new-exam-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2">
            <input className={inputClass} placeholder="e.g. Data Structures — Mid-semester" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
          </Field>
          <Field label="Subject">
            <select className={selectClass} value={formData.subjectId} onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })} required>
              <option value="">Select a subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Semester">
            <input type="number" min="1" className={inputClass} value={formData.semester} onChange={(e) => setFormData({ ...formData, semester: e.target.value })} />
          </Field>
          <Field label="Branch" hint="Leave empty to make it available college-wide.">
            <select className={selectClass} value={formData.branchId} onChange={(e) => handleBranchChange(e.target.value)}>
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Batch" hint="Optional — narrow to one graduating batch.">
            <select className={selectClass} value={formData.batchId} onChange={(e) => setFormData({ ...formData, batchId: e.target.value })} disabled={!formData.branchId}>
              <option value="">All students in branch</option>
              {availableBatches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Duration (minutes)">
            <input type="number" min="1" className={inputClass} value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} required />
          </Field>
          <Field label="Total marks">
            <input type="number" min="1" className={inputClass} value={formData.totalMarks} onChange={(e) => setFormData({ ...formData, totalMarks: e.target.value })} required />
          </Field>
          <Field label="Instructions" hint="Shown to students before they start." className="sm:col-span-2">
            <textarea
              className={`${inputClass} h-24 py-2`}
              placeholder="e.g. Answer all questions. Calculators are not allowed."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

export default function FacultyExamsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading exams…" />}>
      <FacultyExams />
    </Suspense>
  );
}
