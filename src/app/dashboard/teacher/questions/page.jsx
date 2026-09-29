"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { orgClient } from "@/lib/api-client/org.client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, Copy, CheckCircle2, Link2, Loader2, ChevronDown, FileQuestion, SlidersHorizontal, X,
} from "lucide-react";
import { QuestionContributionModal } from "@/components/dashboard/question-contribution-modal";
import { PageHeader, SearchInput, StatusBadge, EmptyState, LoadingState, StatCard } from "@/components/ui/saas";
import { cn } from "@/lib/utils";

const TYPE_LABEL = { MCQ_SINGLE: "Single choice", MCQ_MULTIPLE: "Multiple choice", SUBJECTIVE: "Written" };
const TYPE_TONE = { MCQ_SINGLE: "primary", MCQ_MULTIPLE: "info", SUBJECTIVE: "warning" };

function FilterGroup({ title, children }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function CheckRow({ checked, onChange, label, count }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 rounded border-input accent-[var(--primary)]" />
      <span className="flex-1 truncate text-foreground">{label}</span>
      {count != null && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
    </label>
  );
}

export default function QuestionsPage() {
  const { user } = useAuth();

  const [subjects, setSubjects] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ subjects: [], types: [], marks: [], creators: [] });
  const [sort, setSort] = useState("newest");
  const [expanded, setExpanded] = useState(new Set());
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [globalProcessing, setGlobalProcessing] = useState(false);

  useEffect(() => {
    if (user?.collegeId) loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [subRes, qRes] = await Promise.all([orgClient.subjects.list(user.collegeId), orgClient.questions.list()]);
      if (subRes.success) setSubjects(subRes.subjects);
      if (qRes.success) setQuestions(qRes.questions);
    } catch (e) {
      console.error("Load failed", e);
      toast.error("Couldn't load the question bank.");
    }
    setLoading(false);
  }

  const toggle = (key, value) =>
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((v) => v !== value) : [...prev[key], value],
    }));
  const clearFilters = () => { setFilters({ subjects: [], types: [], marks: [], creators: [] }); setSearchQuery(""); };
  const toggleExpanded = (id) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function handleContributionFinalize(questionDataArray) {
    setIsContributionModalOpen(false);
    setGlobalProcessing(true);
    let successCount = 0;
    try {
      for (const q of questionDataArray) {
        const res = editingQuestion ? await orgClient.questions.update(editingQuestion.id, q) : await orgClient.questions.create(q);
        if (res.success) successCount++;
        else toast.error(res.message || "A question couldn't be saved");
      }
      if (successCount > 0) {
        toast.success(editingQuestion ? "Question saved" : `Added ${successCount} question${successCount !== 1 ? "s" : ""}`);
        loadInitialData();
      }
    } catch {
      toast.error("Something went wrong while saving.");
    } finally {
      setGlobalProcessing(false);
      setEditingQuestion(null);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this question? Exams that already use it keep their copy.")) return;
    const res = await orgClient.questions.delete(id).catch((e) => ({ success: false, message: e.message }));
    if (res.success) { toast.success("Question deleted"); loadInitialData(); }
    else toast.error(res.message || "Delete failed");
  }

  // Facet counts
  const facets = useMemo(() => {
    const count = (fn) => questions.reduce((m, q) => { const k = fn(q); if (k != null) m[k] = (m[k] || 0) + 1; return m; }, {});
    return {
      subjects: count((q) => q.subjectId),
      types: count((q) => q.type),
      marks: count((q) => String(q.defaultMarks)),
      creators: count((q) => q.creator?.name ?? null),
    };
  }, [questions]);

  const filtered = useMemo(() => {
    const term = searchQuery.toLowerCase();
    const list = questions.filter((q) =>
      (q.text || "").toLowerCase().includes(term) &&
      (filters.subjects.length === 0 || filters.subjects.includes(q.subjectId)) &&
      (filters.types.length === 0 || filters.types.includes(q.type)) &&
      (filters.marks.length === 0 || filters.marks.includes(String(q.defaultMarks))) &&
      (filters.creators.length === 0 || filters.creators.includes(q.creator?.name))
    );
    if (sort === "marks") list.sort((a, b) => b.defaultMarks - a.defaultMarks);
    else if (sort === "oldest") list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    else list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list;
  }, [questions, filters, searchQuery, sort]);

  const activeFilterCount = Object.values(filters).reduce((n, a) => n + a.length, 0) + (searchQuery ? 1 : 0);
  const mine = questions.filter((q) => q.creatorId === user?.id).length;

  const filterPanel = (
    <div className="space-y-6">
      <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search questions…" />
      <FilterGroup title="Subject">
        {subjects.map((s) => (
          <CheckRow key={s.id} checked={filters.subjects.includes(s.id)} onChange={() => toggle("subjects", s.id)} label={s.name} count={facets.subjects[s.id] || 0} />
        ))}
      </FilterGroup>
      <FilterGroup title="Type">
        {Object.entries(TYPE_LABEL).map(([k, label]) => (
          <CheckRow key={k} checked={filters.types.includes(k)} onChange={() => toggle("types", k)} label={label} count={facets.types[k] || 0} />
        ))}
      </FilterGroup>
      {Object.keys(facets.marks).length > 0 && (
        <FilterGroup title="Marks">
          <div className="flex flex-wrap gap-1.5 px-1">
            {Object.keys(facets.marks).sort((a, b) => a - b).map((m) => (
              <button
                key={m}
                onClick={() => toggle("marks", m)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                  filters.marks.includes(m) ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </FilterGroup>
      )}
      {Object.keys(facets.creators).length > 0 && (
        <FilterGroup title="Author">
          {Object.keys(facets.creators).map((c) => (
            <CheckRow key={c} checked={filters.creators.includes(c)} onChange={() => toggle("creators", c)} label={c === user?.name ? `${c} (you)` : c} count={facets.creators[c]} />
          ))}
        </FilterGroup>
      )}
      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-muted-foreground">
          <X className="size-3.5" /> Clear filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {globalProcessing && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 shadow-xl">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">Saving questions…</span>
          </div>
        </div>
      )}

      <QuestionContributionModal
        isOpen={isContributionModalOpen}
        onClose={() => { setIsContributionModalOpen(false); setEditingQuestion(null); }}
        subjects={subjects}
        onFinalize={handleContributionFinalize}
        initialData={editingQuestion}
      />

      <PageHeader
        title="Question bank"
        description="Questions shared across your college. Reuse them in any exam."
        actions={
          <Button onClick={() => { setEditingQuestion(null); setIsContributionModalOpen(true); }}>
            <Plus className="size-4" /> Add questions
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileQuestion} label="Total questions" value={questions.length} tone="primary" loading={loading} />
        <StatCard icon={CheckCircle2} label="Auto-graded (MCQ)" value={(facets.types.MCQ_SINGLE || 0) + (facets.types.MCQ_MULTIPLE || 0)} tone="success" loading={loading} />
        <StatCard icon={Pencil} label="Written answer" value={facets.types.SUBJECTIVE || 0} tone="warning" loading={loading} />
        <StatCard icon={Copy} label="Written by you" value={mine} tone="info" loading={loading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        {/* Filters */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-xl border bg-card p-4 shadow-xs">{filterPanel}</div>
        </aside>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{filtered.length}</span> of {questions.length} questions
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setShowFiltersMobile((v) => !v)}>
                <SlidersHorizontal className="size-4" /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
              </Button>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-8 rounded-lg border bg-card px-2.5 text-sm text-foreground outline-none focus:ring-3 focus:ring-ring"
                aria-label="Sort questions"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="marks">Highest marks</option>
              </select>
            </div>
          </div>

          {showFiltersMobile && <div className="rounded-xl border bg-card p-4 lg:hidden">{filterPanel}</div>}

          {loading ? (
            <LoadingState label="Loading questions…" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FileQuestion}
              title={questions.length === 0 ? "Your question bank is empty" : "No questions match"}
              description={questions.length === 0 ? "Write questions by hand or import them from a PDF or photo of a question paper." : "Try removing some filters."}
              action={
                questions.length === 0
                  ? <Button size="sm" onClick={() => setIsContributionModalOpen(true)}><Plus className="size-4" /> Add questions</Button>
                  : <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {filtered.map((q) => {
                const isOpen = expanded.has(q.id);
                const isMine = q.creatorId === user?.id;
                return (
                  <li key={q.id} className="rounded-xl border bg-card shadow-xs transition-colors hover:border-primary/30">
                    <div className="flex items-start gap-3 p-4">
                      <button onClick={() => toggleExpanded(q.id)} className="min-w-0 flex-1 text-left" aria-expanded={isOpen}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge tone={TYPE_TONE[q.type]}>{TYPE_LABEL[q.type]}</StatusBadge>
                          <StatusBadge tone="neutral">{q.subject?.name || "No subject"}</StatusBadge>
                          <span className="text-xs font-medium tabular-nums text-muted-foreground">
                            {q.defaultMarks} mark{q.defaultMarks !== 1 ? "s" : ""}
                          </span>
                          {q.exams?.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Link2 className="size-3" /> {q.exams.length} exam{q.exams.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <p className={cn("mt-2 text-[15px] leading-relaxed text-foreground", !isOpen && "line-clamp-2")}>{q.text}</p>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {isMine ? "You" : q.creator?.name || q.creatorName || "Unknown"} · {new Date(q.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={isMine ? "Edit" : "Copy & edit (creates your own version)"}
                          onClick={() => { setEditingQuestion(q); setIsContributionModalOpen(true); }}
                          className="text-muted-foreground hover:text-primary"
                        >
                          {isMine ? <Pencil className="size-4" /> : <Copy className="size-4" />}
                        </Button>
                        {isMine && (
                          <Button variant="ghost" size="icon-sm" title="Delete" onClick={() => handleDelete(q.id)} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-sm" onClick={() => toggleExpanded(q.id)} aria-label={isOpen ? "Collapse" : "Expand"} className="text-muted-foreground">
                          <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                        </Button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="space-y-4 border-t px-4 py-4 animate-in fade-in duration-200">
                        {q.options?.length > 0 && (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {[...q.options].sort((a, b) => a.order - b.order).map((opt) => (
                              <div
                                key={opt.id}
                                className={cn(
                                  "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                                  opt.isCorrect ? "border-success/40 bg-success/10 text-foreground" : "bg-background text-muted-foreground"
                                )}
                              >
                                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold", opt.isCorrect ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground")}>
                                  {opt.label}
                                </span>
                                <span className="flex-1">{opt.text}</span>
                                {opt.isCorrect && <CheckCircle2 className="size-4 text-success-foreground" aria-label="Correct answer" />}
                              </div>
                            ))}
                          </div>
                        )}
                        {q.type === "SUBJECTIVE" && (
                          <div className="rounded-lg border bg-muted/40 p-3">
                            <p className="text-xs font-medium text-muted-foreground">Model answer (teachers only)</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{q.modelAnswer || "No model answer added."}</p>
                          </div>
                        )}
                        {q.exams?.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="mr-1 text-xs text-muted-foreground">Used in</span>
                            {q.exams.map((eq, i) => <StatusBadge key={i} tone="neutral">{eq.exam?.title}</StatusBadge>)}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
