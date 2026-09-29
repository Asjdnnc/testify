"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { orgClient } from "@/lib/api-client/org.client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, X, Send, Users, CalendarClock, BarChart3, AlertTriangle, Circle, FileQuestion } from "lucide-react";
import { 
  ChevronLeft, 
  Search, 
  Trash2, 
  Plus, 
  Play, 
  BookOpen, 
  Clock, 
  FileText,
  HelpCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Settings2,
  Save,
  Zap,
  Trash,
  GripVertical,
  RotateCcw,
  StopCircle,
  ScanSearch,
  Loader2
} from "lucide-react";
import { OCRImporterModal } from "@/components/dashboard/ocr-importer";
import { StatusBadge, EmptyState, LoadingState, SearchInput, Modal, Field, inputClass, selectClass } from "@/components/ui/saas";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  rectIntersection,
  useDroppable,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable } from '@dnd-kit/core';

const TYPE_LABEL = { MCQ_SINGLE: "Single choice", MCQ_MULTIPLE: "Multiple choice", SUBJECTIVE: "Written" };
const TYPE_TONE = { MCQ_SINGLE: "primary", MCQ_MULTIPLE: "info", SUBJECTIVE: "warning" };
const BLANK_OPTIONS = () => [
  { text: "", label: "A", isCorrect: true, order: 0 },
  { text: "", label: "B", isCorrect: false, order: 1 },
];

// --- Sub-Component: Question Composer Modal ---
function QuestionComposer({ isOpen, onClose, onSave, initialData = null, processing = false }) {
  const [form, setForm] = useState({ text: "", type: "MCQ_SINGLE", defaultMarks: 2, modelAnswer: "", options: BLANK_OPTIONS() });

  useEffect(() => {
    if (initialData) {
      setForm({ ...initialData, options: initialData.options?.length > 0 ? initialData.options : BLANK_OPTIONS() });
    } else {
      setForm({ text: "", type: "MCQ_SINGLE", defaultMarks: 2, modelAnswer: "", options: BLANK_OPTIONS() });
    }
  }, [initialData, isOpen]);

  const addOption = () => {
    const nextLabel = String.fromCharCode(65 + form.options.length);
    setForm({ ...form, options: [...form.options, { text: "", label: nextLabel, isCorrect: false, order: form.options.length }] });
  };
  const removeOption = (idx) => {
    setForm({ ...form, options: form.options.filter((_, i) => i !== idx).map((o, i) => ({ ...o, label: String.fromCharCode(65 + i), order: i })) });
  };
  const toggleCorrect = (idx) => {
    if (form.type === "MCQ_SINGLE") setForm({ ...form, options: form.options.map((o, i) => ({ ...o, isCorrect: i === idx })) });
    else setForm({ ...form, options: form.options.map((o, i) => (i === idx ? { ...o, isCorrect: !o.isCorrect } : o)) });
  };

  const isMcq = form.type.startsWith("MCQ");
  const hasCorrect = !isMcq || form.options.some((o) => o.isCorrect);
  const valid = form.text.trim() && hasCorrect && (!isMcq || form.options.every((o) => o.text.trim()));

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={initialData ? "Edit question" : "New question"}
      description={initialData ? "Changes apply to the question bank. Questions in live exams are copied instead." : "It will be saved to the bank and added to this exam."}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={processing || !valid} onClick={() => onSave(form)}>
            {processing ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {initialData ? "Save changes" : "Create & add to exam"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Question type">
            <select className={selectClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="MCQ_SINGLE">Single choice (one correct answer)</option>
              <option value="MCQ_MULTIPLE">Multiple choice (several correct)</option>
              <option value="SUBJECTIVE">Written answer (graded by you)</option>
            </select>
          </Field>
          <Field label="Marks">
            <input type="number" min="0" className={inputClass} value={form.defaultMarks} onChange={(e) => setForm({ ...form, defaultMarks: e.target.value })} />
          </Field>
        </div>
        <Field label="Question">
          <textarea className={`${inputClass} h-28 py-2`} placeholder="Type the question students will see…" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
        </Field>
        {isMcq && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Answer options</span>
              <span className="text-xs text-muted-foreground">{form.type === "MCQ_SINGLE" ? "Click a letter to mark the correct answer" : "Click letters to mark all correct answers"}</span>
            </div>
            {form.options.map((opt, i) => (
              <div key={i} className="group flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleCorrect(i)}
                  aria-pressed={opt.isCorrect}
                  title={opt.isCorrect ? "Correct answer" : "Mark as correct"}
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                    opt.isCorrect ? "border-success bg-emerald-600 text-white" : "bg-background text-muted-foreground hover:border-success/60"
                  }`}
                >
                  {opt.isCorrect ? <Check className="size-4" /> : opt.label}
                </button>
                <input
                  className={inputClass}
                  placeholder={`Option ${opt.label}`}
                  value={opt.text}
                  onChange={(e) => { const next = [...form.options]; next[i] = { ...next[i], text: e.target.value }; setForm({ ...form, options: next }); }}
                />
                {form.options.length > 2 && (
                  <Button variant="ghost" size="icon-sm" onClick={() => removeOption(i)} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove option ${opt.label}`}>
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            {form.options.length < 8 && (
              <Button variant="ghost" size="sm" onClick={addOption} className="text-primary"><Plus className="size-4" /> Add option</Button>
            )}
            {!hasCorrect && <p className="text-xs text-destructive">Mark at least one correct answer.</p>}
          </div>
        )}
        {form.type === "SUBJECTIVE" && (
          <Field label="Model answer" hint="Only teachers see this — it guides grading.">
            <textarea className={`${inputClass} h-24 py-2`} placeholder="Key points a full-marks answer should cover…" value={form.modelAnswer || ""} onChange={(e) => setForm({ ...form, modelAnswer: e.target.value })} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

// --- Sub-Component: Draggable question-bank row ---
function DraggableBankQuestion({ question, onEdit, onDelete, onAdd, disabled, processing }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `bank-${question.id}`,
    data: { type: "bank", question },
  });
  const style = transform ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 50 : undefined, opacity: isDragging ? 0.5 : undefined } : undefined;
  const isLocked = question.exams?.some((u) => u.exam.status === "ACTIVE" || u.exam.status === "COMPLETED");

  return (
    <div ref={setNodeRef} style={style} className="group flex items-start gap-2 rounded-lg border bg-card p-3 transition-colors hover:border-primary/40">
      <button {...attributes} {...listeners} className="mt-0.5 cursor-grab rounded p-0.5 text-muted-foreground/60 hover:text-foreground active:cursor-grabbing" aria-label="Drag to exam">
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <StatusBadge tone={TYPE_TONE[question.type]}>{TYPE_LABEL[question.type]}</StatusBadge>
            <span className="text-xs tabular-nums text-muted-foreground">{question.defaultMarks} mark{question.defaultMarks !== 1 ? "s" : ""}</span>
            {question.exams?.length > 0 && <span className="text-xs text-muted-foreground">· in {question.exams.length} exam{question.exams.length !== 1 ? "s" : ""}</span>}
          </div>
          <div className="-mr-1 -mt-1 flex shrink-0 items-center gap-0.5">
            {!disabled && (
              <Button size="icon-sm" variant="ghost" onClick={() => onEdit(question)} title="Edit" className="text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"><Pencil className="size-3.5" /></Button>
            )}
            {!isLocked && !disabled && (
              <Button size="icon-sm" variant="ghost" onClick={() => onDelete(question.id)} title="Delete from bank" className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"><Trash2 className="size-3.5" /></Button>
            )}
            {!disabled && (
              <Button size="sm" variant="outline" onClick={() => onAdd(question)} disabled={processing} className="h-7 px-2 text-xs"><Plus className="size-3.5" /> Add</Button>
            )}
          </div>
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm text-foreground">{question.text}</p>
      </div>
    </div>
  );
}

// --- Sub-Component: Drag Preview for Overlay ---
function QuestionPreview({ question, type, index }) {
  return (
    <div className="pointer-events-none w-[360px] rotate-1 rounded-lg border-2 border-primary bg-card p-3 shadow-2xl">
      <div className="flex items-center gap-2">
        {type === "exam" && <span className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</span>}
        <StatusBadge tone={TYPE_TONE[question.type]}>{TYPE_LABEL[question.type]}</StatusBadge>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-foreground">{question.text || question.questionTextSnapshot}</p>
      {type === "bank" && <p className="mt-2 text-xs font-medium text-primary">Drop on the exam paper to add</p>}
    </div>
  );
}

// --- Sub-Component: Sortable question on the exam paper ---
function SortableExamQuestion({ index, eq, examStatus, onEdit, onDeleteManual, processing }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: eq.questionId });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined, opacity: isDragging ? 0.3 : undefined };

  const isFrozen = examStatus === "ACTIVE" || examStatus === "COMPLETED";
  const text = isFrozen ? eq.questionTextSnapshot : eq.question.text;
  const options = isFrozen ? (eq.optionsSnapshot ? JSON.parse(eq.optionsSnapshot) : []) : (eq.question.options || []);

  return (
    <div ref={setNodeRef} style={style} className="group rounded-lg border bg-card p-4 shadow-xs">
      <div className="flex items-start gap-3">
        {!isFrozen ? (
          <button {...attributes} {...listeners} className="mt-0.5 flex cursor-grab items-center gap-1 rounded p-0.5 text-muted-foreground/60 hover:text-foreground active:cursor-grabbing" aria-label={`Reorder question ${index + 1}`}>
            <GripVertical className="size-4" />
          </button>
        ) : null}
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={TYPE_TONE[eq.question.type]}>{TYPE_LABEL[eq.question.type]}</StatusBadge>
            <span className="text-xs font-medium tabular-nums text-foreground">{eq.marks} mark{eq.marks !== 1 ? "s" : ""}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{text}</p>
          {options.length > 0 && (
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {options.map((opt, i) => (
                <li key={opt.id || opt.label || i} className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${opt.isCorrect ? "bg-success/10 text-foreground" : "text-muted-foreground"}`}>
                  <span className={`flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold ${opt.isCorrect ? "bg-emerald-600 text-white" : "bg-muted"}`}>{opt.label}</span>
                  <span className="truncate">{opt.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!isFrozen && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button size="icon-sm" variant="ghost" onClick={() => onEdit(eq.question)} title="Edit question" className="text-muted-foreground"><Pencil className="size-3.5" /></Button>
            <Button size="icon-sm" variant="ghost" onClick={() => onDeleteManual(eq.questionId)} disabled={processing} title="Remove from exam" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="size-4" /></Button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Sub-Component: Droppable exam paper ---
function AssessmentDropZone({ children, id }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`min-h-[40vh] space-y-3 rounded-xl p-1 transition-colors ${isOver ? "bg-primary/5 outline-2 outline-dashed outline-primary/50" : ""}`}>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, title, description }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40"
    >
      <span>
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

// --- Main Builder Page ---
export default function ExamBuilderPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [exam, setExam] = useState(null);
  const [bankQuestions, setBankQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Discovery / Access Targeting
  const [branches, setBranches] = useState([]);
  const [availableBatches, setAvailableBatches] = useState([]);
  
  const toDateTimeLocal = (date) => {
    if (!date) return "";
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const [bankSearch, setBankSearch] = useState("");
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({ 
    title: "", 
    duration: 60, 
    totalMarks: 100, 
    description: "",
    branchId: "",
    batchId: "",
    startTime: "",
    endTime: "",
    shuffleQuestions: false,
    shuffleOptions: false
  });

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  
  const [isOcrOpen, setIsOcrOpen] = useState(false);
  const [globalProcessing, setGlobalProcessing] = useState(false);

  useEffect(() => {
    if (user?.collegeId && id) loadData(false, true);
  }, [user, id]);

  async function loadData(isSilent = false, resetForm = false) {
    if (!isSilent) setLoading(true);
    try {
        const exRes = await orgClient.exams.getById(id, user.id);
        if (exRes.success) {
            setExam(exRes.exam);
            
            // Extract current access targeting
            const currentAccess = exRes.exam.access?.[0] || {};
            
            if (resetForm) {
                setMetaForm({ 
                  title: exRes.exam.title, 
                  duration: exRes.exam.duration, 
                  totalMarks: exRes.exam.totalMarks, 
                  description: exRes.exam.description || "",
                  branchId: currentAccess.branchId || "",
                  batchId: currentAccess.batchId || "",
                  startTime: exRes.exam.startTime ? toDateTimeLocal(exRes.exam.startTime) : "",
                  endTime: exRes.exam.endTime ? toDateTimeLocal(exRes.exam.endTime) : "",
                  shuffleQuestions: exRes.exam.shuffleQuestions || false,
                  shuffleOptions: exRes.exam.shuffleOptions || false
                });
            }

            // Fetch metadata for targeting
            const branchRes = await orgClient.branches.list(user.collegeId);
            if (branchRes.success) setBranches(branchRes.branches || []);

            if (currentAccess.branchId) {
                const batchRes = await orgClient.batches.list(currentAccess.branchId);
                if (batchRes.success) setAvailableBatches(batchRes.batches || []);
            }

            const qRes = await orgClient.questions.list({ subjectId: exRes.exam.subjectId });
            if (qRes.success) {
                const linkedIds = new Set(exRes.exam.questions.map(eq => eq.questionId));
                setBankQuestions(qRes.questions.filter(q => !linkedIds.has(q.id)));
            }
        }
    } catch (e) { console.error("Load failed", e); }
    if (!isSilent) setLoading(false);
  }

  async function handleBranchChange(branchId) {
    setMetaForm(prev => ({ ...prev, branchId, batchId: "" }));
    setAvailableBatches([]);
    if (branchId) {
       const res = await orgClient.batches.list(branchId);
       if (res.success) setAvailableBatches(res.batches || []);
    }
  }

  const currentTotalMarks = useMemo(() => (exam?.questions || []).reduce((sum, q) => sum + (q.marks || 0), 0), [exam]);

  async function handleAdd(question) {
    if (exam.status !== 'DRAFT' && exam.status !== 'PUBLISHED') return;
    setProcessing(true);
    try {
        const res = await orgClient.exams.addQuestion(id, { questionId: question.id, order: exam.questions.length, marks: question.defaultMarks });
        if (res.success) { toast.success("Added to exam"); loadData(true); }
    } catch (e) { toast.error("Failed to add question"); }
    setProcessing(false);
  }

  async function handleRemove(questionId) {
    if (exam.status !== 'DRAFT' && exam.status !== 'PUBLISHED') return;
    setProcessing(true);
    try {
        const res = await orgClient.exams.removeQuestion(id, questionId);
        if (res.success) { toast.success("Question removed"); loadData(true); }
    } catch (e) { toast.error("Failed to remove question"); }
    setProcessing(false);
  }

  async function handleDeleteBankQuestion(questionId) {
    if (!confirm("Delete this question from the bank? It will be removed for all teachers in your college.")) return;
    setProcessing(true);
    try {
        const res = await orgClient.questions.delete(questionId);
        if (res.success) loadData(true);
        else toast.error(res.message);
    } catch (e) { toast.error("Deletion failed"); }
    setProcessing(false);
  }

  async function handleSaveMeta() {
    setProcessing(true);
    try {
        const res = await orgClient.exams.update(id, metaForm);
        if (res.success) { 
            toast.success("Settings saved");
            setIsEditingMeta(false); 
            loadData(true, true); 
        } else {
            toast.error(res.message);
        }
    } catch (e) { toast.error("Update failed"); }
    setProcessing(false);
  }

  async function handleSaveQuestion(formData) {
    setProcessing(true);
    try {
      if (editingQuestion) {
        const res = await orgClient.questions.update(editingQuestion.id, { ...formData, examId: id });
        if (res.success) { toast.success("Question saved"); setIsComposerOpen(false); loadData(true); }
      } else {
        const res = await orgClient.questions.create({ ...formData, subjectId: exam.subjectId, collegeId: user.collegeId, creatorId: user.id });
        if (res.success) {
          await orgClient.exams.addQuestion(id, { questionId: res.question.id, order: exam.questions.length, marks: res.question.defaultMarks });
          setIsComposerOpen(false);
          loadData(true);
        }
      }
    } catch (e) { toast.error(e.message); }
    setProcessing(false);
  }

  async function handlePublish() {
    if (!confirm("Publish this exam? Students in the selected branch/batch will see it (at the scheduled time, if one is set).")) return;
    setProcessing(true);
    try {
        const res = await orgClient.exams.publish(id, {});
        if (res.success) { toast.success("Exam published"); loadData(true); }
        else toast.error(res.message);
    } catch (e) { toast.error("Publish failed"); }
    setProcessing(false);
  }

  async function handleOcrImportFinalize(parsedQuestions) {
    setGlobalProcessing(true);
    let successCount = 0;

    for (const q of parsedQuestions) {
       const payload = {
          text: q.text,
          type: q.type || 'SUBJECTIVE',
          defaultMarks: q.defaultMarks || 2,
          modelAnswer: q.modelAnswer || '',
          options: q.options || [],
          subjectId: exam.subjectId,
          collegeId: user.collegeId,
          creatorId: user.id
       };

       try {
          const res = await orgClient.questions.create(payload);
          if (res.success) {
             const addRes = await orgClient.exams.addQuestion(id, { 
                questionId: res.question.id, 
                order: exam.questions.length + successCount, 
                marks: res.question.defaultMarks 
             });
             if (addRes.success) successCount++;
          }
       } catch (e) {
          console.error("Failed to inject & link", e);
       }
    }

    toast.success(`Added ${successCount} imported question${successCount !== 1 ? "s" : ""}`);
    setIsOcrOpen(false);
    setGlobalProcessing(false);
    loadData(true);
  }

  async function handleStart() {
    if (!confirm("Open this exam to students right now?")) return;
    setProcessing(true);
    try {
        const res = await orgClient.exams.start(id);
        if (res.success) { toast.success("Exam is live"); loadData(true); }
        else toast.error(res.message);
    } catch (e) { toast.error("Couldn't open the exam"); }
    setProcessing(false);
  }

  async function handleComplete() {
    if (!confirm("End this exam now? Students still writing will be submitted automatically. This can't be undone.")) return;
    setProcessing(true);
    try {
        const res = await orgClient.exams.complete(id);
        if (res.success) { 
           toast.success("Exam ended — attempts submitted and graded"); 
           loadData(true); 
        } else {
           toast.error(res.message);
        }
    } catch (e) { toast.error("Couldn't end the exam"); }
    setProcessing(false);
  }

  if (loading) return <LoadingState label="Loading exam…" />;
  if (!exam) return (
    <EmptyState icon={FileText} title="Exam not found" description="It may have been deleted, or it belongs to another teacher."
      action={<Button asChild variant="outline"><Link href="/dashboard/teacher/exams">Back to exams</Link></Button>} />
  );

  const filteredBank = bankQuestions.filter(q => q.text.toLowerCase().includes(bankSearch.toLowerCase()));
  const isFrozen = exam.status === 'ACTIVE' || exam.status === 'COMPLETED';
  const canEdit = exam.status === 'DRAFT' || exam.status === 'PUBLISHED';
  const access = exam.access?.[0];
  const audience = access?.batch ? `${access.branch?.name || "Branch"} · Batch ${access.batch.name}` : access?.branch ? `${access.branch.name} (all batches)` : "Whole college";
  const fmt = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
  const schedule = exam.startTime || exam.endTime ? `${fmt(exam.startTime) || "Any time"} → ${fmt(exam.endTime) || "no end"}` : "No time window";
  const marksOk = currentTotalMarks === exam.totalMarks;
  const marksOver = currentTotalMarks > exam.totalMarks;
  const statusUi = {
    DRAFT: { label: "Draft", tone: "neutral" },
    PUBLISHED: { label: exam.startTime && new Date(exam.startTime) > new Date() ? "Scheduled" : "Published", tone: "info" },
    ACTIVE: { label: "Live", tone: "success" },
    COMPLETED: { label: "Completed", tone: "primary" },
  }[exam.status];

  const checklist = [
    { done: exam.questions.length > 0, label: `${exam.questions.length} question${exam.questions.length !== 1 ? "s" : ""} added` },
    { done: marksOk, warn: marksOver, label: `Marks add up to ${currentTotalMarks} of ${exam.totalMarks}` },
    { done: true, label: `Audience: ${audience}` },
    { done: !!(exam.startTime || exam.endTime), optional: true, label: exam.startTime || exam.endTime ? `Schedule: ${schedule}` : "No schedule — opens as soon as it's published" },
  ];

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const isOverStructure = over.id === 'exam-structure-droppable' || exam.questions.some(eq => eq.questionId === over.id);

    if (active.data.current?.type === 'bank' && isOverStructure) {
      handleAdd(active.data.current.question);
      return;
    }

    if (active.id !== over.id && active.data.current?.type !== 'bank') {
      const oldIndex = exam.questions.findIndex(eq => eq.questionId === active.id);
      const newIndex = exam.questions.findIndex(eq => eq.questionId === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newItems = arrayMove(exam.questions, oldIndex, newIndex);
        setExam({ ...exam, questions: newItems });
        try {
          await orgClient.exams.reorderQuestions(id, newItems.map(eq => eq.questionId));
        } catch (e) {
          toast.error("Couldn't save the new order");
          loadData(true);
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      {globalProcessing && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 shadow-xl">
            <Loader2 className="size-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Adding imported questions…</p>
              <p className="text-xs text-muted-foreground">Please keep this window open.</p>
            </div>
          </div>
        </div>
      )}

      <OCRImporterModal isOpen={isOcrOpen} onClose={() => setIsOcrOpen(false)} onImportFinalize={handleOcrImportFinalize} />
      <QuestionComposer isOpen={isComposerOpen} onClose={() => setIsComposerOpen(false)} onSave={handleSaveQuestion} initialData={editingQuestion} processing={processing} />

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link href="/dashboard/teacher/exams" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> Exams
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{exam.title}</h1>
            <StatusBadge tone={statusUi.tone} dot>{statusUi.label}</StatusBadge>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><BookOpen className="size-4" /> {exam.subject?.name}</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="size-4" /> {exam.duration} min</span>
            <span className="inline-flex items-center gap-1.5"><Users className="size-4" /> {audience}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" /> {schedule}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {exam._count?.attempts > 0 || isFrozen ? (
            <Button asChild variant="outline"><Link href={`/dashboard/teacher/grading/${exam.id}`}><BarChart3 className="size-4" /> Results</Link></Button>
          ) : null}
          {canEdit && (
            <Button variant="outline" onClick={() => setIsEditingMeta(true)}><Settings2 className="size-4" /> Settings</Button>
          )}
          {exam.status === 'DRAFT' && (
            <Button onClick={handlePublish} disabled={processing || exam.questions.length === 0 || marksOver}>
              <Send className="size-4" /> Publish
            </Button>
          )}
          {exam.status === 'PUBLISHED' && (
            <Button onClick={handleStart} disabled={processing} variant="success"><Play className="size-4" /> Go live now</Button>
          )}
          {exam.status === 'ACTIVE' && (!exam.endTime || new Date(exam.endTime) > new Date()) && (
            <Button onClick={handleComplete} disabled={processing} variant="destructive"><StopCircle className="size-4" /> End exam</Button>
          )}
        </div>
      </div>

      {/* Readiness */}
      {exam.status === 'DRAFT' && (
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-sm font-medium text-foreground">Ready to publish?</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-start gap-2 text-sm">
                {c.warn ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  : c.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-foreground" />
                  : <Circle className={`mt-0.5 size-4 shrink-0 ${c.optional ? "text-muted-foreground/50" : "text-warning-foreground"}`} />}
                <span className={c.warn ? "text-destructive" : c.done ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
              </li>
            ))}
          </ul>
          {marksOver && <p className="mt-3 text-xs text-destructive">Questions add up to more than the exam total — remove a question or raise the total in Settings.</p>}
          {!marksOk && !marksOver && exam.questions.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Tip: the exam total is {exam.totalMarks}; scores are calculated out of that number.</p>}
        </div>
      )}

      {isFrozen && (
        <div className="flex items-start gap-3 rounded-xl border border-info/30 bg-info/10 p-4 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-info-foreground" />
          <p className="text-foreground">
            {exam.status === 'ACTIVE' ? "This exam is live, so its questions are locked." : "This exam has finished — questions are shown exactly as students saw them."}
            <span className="text-muted-foreground"> Edits to bank questions create a new copy for future exams.</span>
          </p>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className={`grid items-start gap-6 ${isFrozen ? "mx-auto max-w-3xl" : "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"}`}>
          {/* Question bank */}
          {!isFrozen && (
            <section className="rounded-xl border bg-card shadow-xs lg:sticky lg:top-24">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Question bank</h2>
                  <p className="text-xs text-muted-foreground">{exam.subject?.name} · {bankQuestions.length} available</p>
                </div>
                {canEdit && (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setIsOcrOpen(true)} title="Import questions from a PDF or photo"><ScanSearch className="size-4" /> AI import</Button>
                    <Button size="sm" onClick={() => { setEditingQuestion(null); setIsComposerOpen(true); }}><Plus className="size-4" /> New</Button>
                  </div>
                )}
              </div>
              <div className="border-b p-3">
                <SearchInput value={bankSearch} onChange={setBankSearch} placeholder="Search questions…" />
              </div>
              <div className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
                {filteredBank.length === 0 ? (
                  <EmptyState
                    icon={FileQuestion}
                    title={bankQuestions.length === 0 ? "No more questions for this subject" : "No matches"}
                    description={bankQuestions.length === 0 ? "Write a new question or import a question paper." : "Try another search."}
                    className="border-0 py-8"
                  />
                ) : (
                  filteredBank.map(q => (
                    <DraggableBankQuestion key={q.id} question={q} onEdit={(q) => { setEditingQuestion(q); setIsComposerOpen(true); }} onDelete={handleDeleteBankQuestion} onAdd={handleAdd} disabled={!canEdit} processing={processing} />
                  ))
                )}
              </div>
              {canEdit && filteredBank.length > 0 && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Drag a question onto the paper, or click Add.</p>}
            </section>
          )}

          {/* Exam paper */}
          <section className="rounded-xl border bg-muted/30 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3 rounded-t-xl">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Exam paper</h2>
                <p className="text-xs text-muted-foreground">{exam.questions.length} question{exam.questions.length !== 1 ? "s" : ""}{!isFrozen && exam.questions.length > 1 ? " · drag to reorder" : ""}</p>
              </div>
              <div className="w-44">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Marks</span>
                  <span className={`font-semibold tabular-nums ${marksOver ? "text-destructive" : marksOk ? "text-success-foreground" : "text-foreground"}`}>{currentTotalMarks} / {exam.totalMarks}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${marksOver ? "bg-destructive" : marksOk ? "bg-success" : "bg-primary"}`} style={{ width: `${Math.min(100, (currentTotalMarks / Math.max(exam.totalMarks, 1)) * 100)}%` }} />
                </div>
              </div>
            </div>
            <div className="p-3">
              <SortableContext id="exam-structure-sortable" items={exam.questions.map(eq => eq.questionId)} strategy={verticalListSortingStrategy}>
                <AssessmentDropZone id="exam-structure-droppable">
                  {exam.questions.length === 0 ? (
                    <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card/60 p-8 text-center">
                      <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"><ArrowRight className="size-5" /></span>
                      <p className="mt-3 font-medium text-foreground">No questions yet</p>
                      <p className="mt-1 max-w-xs text-sm text-muted-foreground">Drag questions from the bank, click Add, or create a new one.</p>
                    </div>
                  ) : (
                    exam.questions.map((eq, idx) => (
                      <SortableExamQuestion key={eq.questionId} index={idx} eq={eq} examStatus={exam.status} onEdit={(q) => { setEditingQuestion(q); setIsComposerOpen(true); }} onDeleteManual={handleRemove} processing={processing} />
                    ))
                  )}
                </AssessmentDropZone>
              </SortableContext>
            </div>
          </section>
        </div>

        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
          {activeId && (() => {
            const bankQ = bankQuestions.find(q => `bank-${q.id}` === activeId);
            const examQ = exam.questions.find(eq => eq.questionId === activeId);
            if (bankQ) return <QuestionPreview question={bankQ} type="bank" />;
            if (examQ) return <QuestionPreview question={examQ.question} type="exam" index={exam.questions.findIndex(q => q.questionId === activeId)} />;
            return null;
          })()}
        </DragOverlay>
      </DndContext>

      {/* Settings */}
      <Modal
        open={isEditingMeta}
        onClose={() => setIsEditingMeta(false)}
        title="Exam settings"
        description={exam.status === 'PUBLISHED' ? "This exam is published — students see changes immediately." : "These settings can be changed until the exam goes live."}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsEditingMeta(false)}>Cancel</Button>
            <Button onClick={handleSaveMeta} disabled={processing}><Save className="size-4" /> Save settings</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2">
            <input className={inputClass} value={metaForm.title} onChange={e => setMetaForm({ ...metaForm, title: e.target.value })} />
          </Field>
          <Field label="Duration (minutes)">
            <input type="number" min="1" className={inputClass} value={metaForm.duration} onChange={e => setMetaForm({ ...metaForm, duration: e.target.value })} />
          </Field>
          <Field label="Total marks">
            <input type="number" min="1" className={inputClass} value={metaForm.totalMarks} onChange={e => setMetaForm({ ...metaForm, totalMarks: e.target.value })} />
          </Field>
          <Field label="Branch">
            <select className={selectClass} value={metaForm.branchId} onChange={(e) => handleBranchChange(e.target.value)}>
              <option value="">Whole college</option>
              {branches?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Batch">
            <select className={selectClass} value={metaForm.batchId} onChange={(e) => setMetaForm({ ...metaForm, batchId: e.target.value })} disabled={!metaForm.branchId}>
              <option value="">All batches in branch</option>
              {availableBatches?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Opens at" hint="Leave empty to open when published.">
            <input type="datetime-local" className={inputClass} value={metaForm.startTime} onChange={e => setMetaForm({ ...metaForm, startTime: e.target.value })} />
          </Field>
          <Field label="Closes at" hint="Attempts end automatically at this time.">
            <input type="datetime-local" className={inputClass} value={metaForm.endTime} onChange={e => setMetaForm({ ...metaForm, endTime: e.target.value })} />
          </Field>
          <div className="space-y-2 sm:col-span-2">
            <Toggle checked={metaForm.shuffleQuestions} onChange={(v) => setMetaForm({ ...metaForm, shuffleQuestions: v })} title="Shuffle questions" description="Each student gets the questions in a different order." />
            <Toggle checked={metaForm.shuffleOptions} onChange={(v) => setMetaForm({ ...metaForm, shuffleOptions: v })} title="Shuffle answer options" description="MCQ options (A, B, C…) appear in a different order per student." />
          </div>
          <Field label="Instructions" hint="Shown to students before they start." className="sm:col-span-2">
            <textarea className={`${inputClass} h-20 py-2`} value={metaForm.description} onChange={e => setMetaForm({ ...metaForm, description: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
