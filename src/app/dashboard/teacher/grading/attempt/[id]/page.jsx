"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, AlertCircle, Save, ArrowLeft, User, Book, Clock, Sparkles, Loader2, ThumbsUp, TriangleAlert, Wand2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/saas";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { FACE_VIOLATIONS, BROWSER_VIOLATIONS, FACE_STRIKE_LIMIT, BROWSER_STRIKE_LIMIT, FACE_VIOLATION_LABELS } from "@/lib/proctoring-rules";

const EVENT_LABELS = {
  ...FACE_VIOLATION_LABELS,
  TAB_SWITCH: "Switched tab / window",
  FULLSCREEN_EXIT: "Left fullscreen",
  MULTIPLE_DISPLAY_DETECTED: "Extra display connected",
  WINDOW_BLUR: "Window lost focus",
};

const FLAG_TEXT = {
  BLANK_OR_IRRELEVANT: "Answer is blank or off-topic",
  POSSIBLE_MANIPULATION: "Answer may contain instructions aimed at the AI — review carefully",
  NEEDS_HUMAN_JUDGEMENT: "Needs your judgement — the AI wasn't sure",
  NO_RUBRIC: "No model answer — graded on general subject knowledge",
};
const CONF_TONE = { high: "success", medium: "warning", low: "danger" };

function AiSuggestionCard({ state, maxMarks, onApply, applied }) {
  if (!state) return null;
  if (state.loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" /> Reading the answer and comparing it with the model answer…
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
      </div>
    );
  }
  const s = state.data;
  return (
    <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">AI recommendation</span>
          <StatusBadge tone={CONF_TONE[s.confidence]}>{s.confidence} confidence</StatusBadge>
        </div>
        <span className="text-lg font-semibold tabular-nums text-foreground">
          {s.suggestedMarks}<span className="text-sm font-normal text-muted-foreground"> / {maxMarks}</span>
        </span>
      </div>

      {s.flags?.length > 0 && (
        <ul className="space-y-1">
          {s.flags.map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs text-warning-foreground">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {FLAG_TEXT[f] || f}
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-foreground">{s.rationale}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {s.strengths?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Covered well</p>
            <ul className="mt-1 space-y-1 text-sm">
              {s.strengths.map((x, i) => <li key={i} className="flex gap-1.5"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success-foreground" /><span>{x}</span></li>)}
            </ul>
          </div>
        )}
        {s.gaps?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Missing or incorrect</p>
            <ul className="mt-1 space-y-1 text-sm">
              {s.gaps.map((x, i) => <li key={i} className="flex gap-1.5"><XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" /><span>{x}</span></li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary/15 pt-3">
        <p className="text-xs text-muted-foreground">AI can be wrong. It never saves a grade — you decide the final mark.</p>
        <Button size="sm" variant={applied ? "outline" : "default"} onClick={onApply}>
          <Wand2 className="size-3.5" /> {applied ? "Applied — edit below" : "Use as starting point"}
        </Button>
      </div>
    </div>
  );
}

function ProctoringSummary({ attempt }) {
  const logs = attempt.logs || [];
  const face = logs.filter((l) => FACE_VIOLATIONS.includes(l.event));
  const browser = logs.filter((l) => BROWSER_VIOLATIONS.includes(l.event));
  const terminated = attempt.status === "CHEATED";

  return (
    <div className={`rounded-lg border p-5 space-y-4 ${terminated ? "border-destructive/40 bg-rose-500/5" : "bg-card"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldAlert className={`w-4 h-4 ${terminated ? "text-destructive" : "text-muted-foreground"}`} />
          Proctoring
          {terminated && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-destructive dark:text-destructive">Terminated for violations</span>}
        </h2>
        <div className="flex gap-4 text-sm">
          <span>Face warnings: <strong className={face.length ? "text-destructive dark:text-destructive" : ""}>{face.length} / {FACE_STRIKE_LIMIT}</strong></span>
          <span>Browser strikes: <strong className={browser.length ? "text-destructive dark:text-destructive" : ""}>{browser.length} / {BROWSER_STRIKE_LIMIT}</strong></span>
        </div>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No proctoring events were recorded.</p>
      ) : (
        <ol className="max-h-56 overflow-y-auto divide-y text-sm">
          {logs.map((l, i) => (
            <li key={i} className="flex justify-between gap-4 py-1.5">
              <span className={FACE_VIOLATIONS.includes(l.event) || BROWSER_VIOLATIONS.includes(l.event) ? "text-foreground" : "text-muted-foreground"}>
                {EVENT_LABELS[l.event] || l.event}
              </span>
              <span className="tabular-nums text-muted-foreground">{new Date(l.createdAt).toLocaleTimeString()}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-muted-foreground">Signals are indicators, not proof — review them alongside the answers before deciding on misconduct.</p>
    </div>
  );
}

export default function AttemptGrader() {
  const { id } = useParams();
  const router = useRouter();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState({}); // { answerId: { marks, feedback } }
  const [saving, setSaving] = useState(false);
  // AI assistance: { [answerId]: { loading, data, error } }
  const [suggestions, setSuggestions] = useState({});
  const [applied, setApplied] = useState({});   // answerId -> true once the teacher used the suggestion
  const [reviewed, setReviewed] = useState({}); // answerId -> teacher confirmed they checked the AI's work
  const [bulkLoading, setBulkLoading] = useState(false);

  async function requestSuggestion(answerId) {
    setSuggestions((prev) => ({ ...prev, [answerId]: { loading: true } }));
    setReviewed((prev) => ({ ...prev, [answerId]: false }));
    try {
      const res = await fetch("/api/grading/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId }),
      });
      const data = await res.json();
      setSuggestions((prev) => ({
        ...prev,
        [answerId]: data.success ? { data: data.suggestion } : { error: data.message || "Couldn't get a suggestion." },
      }));
    } catch {
      setSuggestions((prev) => ({ ...prev, [answerId]: { error: "Couldn't reach the AI service." } }));
    }
  }

  async function requestAllSuggestions(answerIds) {
    setBulkLoading(true);
    for (const id of answerIds) await requestSuggestion(id); // sequential: gentle on the AI quota
    setBulkLoading(false);
  }

  function applySuggestion(answerId) {
    const s = suggestions[answerId]?.data;
    if (!s) return;
    setGrades((prev) => ({
      ...prev,
      [answerId]: {
        marks: s.suggestedMarks,
        feedback: prev[answerId]?.feedback?.trim() ? prev[answerId].feedback : s.suggestedFeedback,
      },
    }));
    setApplied((prev) => ({ ...prev, [answerId]: true }));
    setReviewed((prev) => ({ ...prev, [answerId]: false }));
  }

  useEffect(() => {
    fetch(`/api/grading/pending?attemptId=${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAttempt(data.attempt);
          // Pre-populate grades with existing data if any
          const initialGrades = {};
          data.attempt.answers.forEach(ans => {
            if (ans.question.type === "SUBJECTIVE") {
               initialGrades[ans.id] = { marks: ans.marksObtained || 0, feedback: ans.teacherFeedback || "" };
            }
          });
          setGrades(initialGrades);
        }
        setLoading(false);
      });
  }, [id]);

  const handleGradeChange = (answerId, field, value) => {
    setGrades(prev => ({
      ...prev,
      [answerId]: { ...prev[answerId], [field]: value }
    }));
  };

  const submitGrade = async (answerId) => {
    if (suggestions[answerId]?.data && !reviewed[answerId]) {
      toast.error("Confirm you've reviewed the AI recommendation before saving.");
      return;
    }
    setSaving(true);
    const { marks, feedback } = grades[answerId];
    try {
      const res = await fetch("/api/grading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId, marksObtained: marks, feedback })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.gradingStatus === "FULLY_GRADED" ? "Saved — this submission is fully graded" : "Grade saved");
        // Reflect the new total without a reload
        setAttempt(prev => prev ? { ...prev, result: { ...(prev.result || {}), totalMarksObtained: data.newTotal, percentage: data.percentage, gradingStatus: data.gradingStatus } } : prev);
      } else {
        toast.error("Error: " + data.message);
      }
    } catch (e) {
      toast.error("Error saving grade");
    }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading submission…</div>;
  if (!attempt) return <div className="p-12 text-center text-destructive">Attempt not found</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" onClick={() => router.back()} className="hover:bg-secondary">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="flex gap-4">
           <div className="flex flex-col items-end">
              <span className="text-sm font-semibold">{attempt.user.name}</span>
              <span className="text-xs text-muted-foreground">{attempt.user.email}</span>
           </div>
           <div className="p-2 bg-primary/10 rounded-full">
              <User className="w-5 h-5 text-primary" />
           </div>
        </div>
      </div>

      <header className="bg-secondary/30 p-6 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h1 className="text-2xl font-bold">{attempt.exam.title}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center"><Book className="w-4 h-4 mr-1"/> Semester {attempt.exam.semester}</span>
                <span className="flex items-center"><Clock className="w-4 h-4 mr-1"/> Duration: {attempt.exam.duration} mins</span>
                <span className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-1"/> Total Marks: {attempt.exam.totalMarks}</span>
            </div>
         </div>
         {attempt.result && (
            <div className="text-right">
               <div className="text-3xl font-semibold text-primary">{attempt.result.totalMarksObtained} <span className="text-sm text-muted-foreground font-normal">/ {attempt.exam.totalMarks}</span></div>
               <div className="text-xs font-bold tracking-wide opacity-40">Final Score</div>
            </div>
         )}
      </header>

      <ProctoringSummary attempt={attempt} />

      {(() => {
        const written = attempt.answers.filter((a) => a.question?.type === "SUBJECTIVE" && (a.subjectiveText || "").trim());
        if (written.length === 0) return null;
        const ungraded = written.filter((a) => a.marksObtained === null);
        return (
          <div className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">AI grading assistant</p>
                <p className="text-sm text-muted-foreground">
                  Get a recommended score and reasoning for each written answer. You review and confirm every mark before it's saved.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => requestAllSuggestions((ungraded.length ? ungraded : written).map((a) => a.id))}
              disabled={bulkLoading}
              className="shrink-0"
            >
              {bulkLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {ungraded.length ? `Suggest for ${ungraded.length} ungraded` : "Suggest for all written"}
            </Button>
          </div>
        );
      })()}

      <div className="space-y-6">
        {attempt.exam.questions.map((eq, index) => {
          const answer = attempt.answers.find(a => a.questionId === eq.questionId);
          const isMcq = eq.question.type !== "SUBJECTIVE";
          
          return (
            <Card key={eq.questionId} className={isMcq ? "border-l-4 border-l-primary/60" : "border-l-4 border-l-warning"}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                   <CardTitle className="text-md font-semibold">
                     Question {index + 1} 
                     <span className="ml-2 text-xs font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                       {{ MCQ_SINGLE: "Single choice", MCQ_MULTIPLE: "Multiple choice", SUBJECTIVE: "Written answer" }[eq.question.type]} · {eq.marks} mark{eq.marks !== 1 ? "s" : ""}
                     </span>
                   </CardTitle>
                </div>
                <p className="mt-2 text-sm">{eq.questionTextSnapshot}</p>
              </CardHeader>

              <CardContent className="pt-4 border-t bg-secondary/10">
                <Label className="text-xs text-muted-foreground">Student's Response</Label>
                
                {isMcq ? (
                  <div className="mt-2 space-y-2">
                      {(() => {
                        const originalOptions = eq.optionsSnapshot ? JSON.parse(eq.optionsSnapshot) : (eq.question?.options || []);
                        const getDisplay = (val) => {
                          const opt = originalOptions.find(o => o.id === val || o.label === val);
                          return opt ? `[${opt.label}] ${opt.text}` : val;
                        };

                        return (
                          <>
                            <div className="flex items-center gap-2 text-sm">
                              {answer?.isCorrect ? (
                                <CheckCircle2 className="w-4 h-4 text-success-foreground" />
                              ) : (
                                <XCircle className="w-4 h-4 text-destructive" />
                              )}
                              <span>Selected Options: <strong>{
                                answer?.selectedOptions?.map(getDisplay).join(", ") || "No response"
                              }</strong></span>
                            </div>
                            {!answer?.isCorrect && (
                              <p className="text-xs text-muted-foreground ml-6 ">
                                Correct Answers: {
                                  eq.correctAnswersSnapshot?.map(getDisplay).join(", ") || "None"
                                }
                              </p>
                            )}
                          </>
                        );
                      })()}
                  </div>
                ) : (
                  <div className="mt-2 p-4 bg-muted/40 text-foreground border rounded text-sm whitespace-pre-wrap">
                    {answer?.subjectiveText || "No response provided."}
                  </div>
                )}
              </CardContent>

              {!isMcq && answer && (() => {
                const sug = suggestions[answer.id];
                const needsReview = !!sug?.data;
                const hasText = !!(answer.subjectiveText || "").trim();
                return (
                <CardFooter className="flex flex-col items-stretch gap-4 border-t pt-6">
                  {!sug && hasText && (
                    <Button variant="outline" size="sm" className="self-start" onClick={() => requestSuggestion(answer.id)}>
                      <Sparkles className="size-3.5 text-primary" /> Get AI recommendation
                    </Button>
                  )}
                  <AiSuggestionCard
                    state={sug}
                    maxMarks={eq.marks}
                    applied={!!applied[answer.id]}
                    onApply={() => applySuggestion(answer.id)}
                  />
                  {sug && !sug.loading && (
                    <button onClick={() => requestSuggestion(answer.id)} className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                      Ask again
                    </button>
                  )}

                  <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor={`marks-${answer.id}`}>Your mark</Label>
                      <Input
                        id={`marks-${answer.id}`}
                        type="number"
                        min={0}
                        step={0.5}
                        max={eq.marks}
                        value={grades[answer.id]?.marks ?? 0}
                        onChange={(e) => handleGradeChange(answer.id, "marks", parseFloat(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">Out of {eq.marks}</p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`feedback-${answer.id}`}>Feedback to student</Label>
                      <Input
                        id={`feedback-${answer.id}`}
                        placeholder="What was good, and what to improve"
                        value={grades[answer.id]?.feedback || ""}
                        onChange={(e) => handleGradeChange(answer.id, "feedback", e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        className="w-full"
                        onClick={() => submitGrade(answer.id)}
                        disabled={saving || (needsReview && !reviewed[answer.id])}
                        title={needsReview && !reviewed[answer.id] ? "Confirm your review of the AI recommendation first" : undefined}
                      >
                        <Save className="size-4" /> Save grade
                      </Button>
                    </div>
                  </div>

                  {needsReview && (
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-[var(--primary)]"
                        checked={!!reviewed[answer.id]}
                        onChange={(e) => setReviewed((prev) => ({ ...prev, [answer.id]: e.target.checked }))}
                      />
                      <span className="text-foreground">
                        I&apos;ve read the student&apos;s answer and checked the AI&apos;s recommendation.
                        <span className="text-muted-foreground"> The mark above ({grades[answer.id]?.marks ?? 0} / {eq.marks}) is my own judgement.</span>
                      </span>
                    </label>
                  )}
                </CardFooter>
                );
              })()}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
