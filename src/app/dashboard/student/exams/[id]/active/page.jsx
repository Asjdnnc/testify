"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { studentClient } from "@/lib/api-client/student.client";
import { orgClient } from "@/lib/api-client/org.client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Zap, 
  Flag, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Save,
  Menu,
  Monitor,
  Maximize2,
  ShieldAlert,
  AlertTriangle,
  Lock,
  RotateCcw,
  MonitorX
} from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useFaceProctor } from "@/lib/use-face-proctor";
import { CameraPreview, faceInstruction } from "@/components/proctoring/camera-preview";
import { StatusBadge } from "@/components/ui/saas";
import { FACE_STRIKE_LIMIT, BROWSER_STRIKE_LIMIT, FACE_VIOLATION_LABELS } from "@/lib/proctoring-rules";

const TYPE_LABEL = {
  MCQ_SINGLE: "Single choice",
  MCQ_MULTIPLE: "Multiple choice · select all that apply",
  SUBJECTIVE: "Written answer",
};

function StrikeDots({ count, limit }) {
  return (
  <div className="flex gap-1.5">
    {Array.from({ length: limit }, (_, i) => (
      <span key={i} className={`size-2.5 rounded-full ${count > i ? "bg-destructive" : "bg-muted-foreground/25"}`} />
    ))}
  </div>
);
}

export default function ActiveExamPage() {
  const { id } = useParams();
  const router = useRouter();
  // Append ?proctorDebug=1 to see live head-pose / gaze numbers (for tuning)
  const proctorDebug = useSearchParams().has("proctorDebug");
  const { user } = useAuth();
  
  const [exam, setExam] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localAnswers, setLocalAnswers] = useState({}); // questionId -> { selectedOptions, subjectiveText }
  const answersRef = useRef({});
  const [flags, setFlags] = useState(new Set());
  
  const [timeLeft, setTimeLeft] = useState(null);
  const [isFullscreenViolation, setIsFullscreenViolation] = useState(false);
  const [isDualScreenViolation, setIsDualScreenViolation] = useState(false);
  const [flagCount, setFlagCount] = useState(0);
  const [isCheated, setIsCheated] = useState(false);
  const syncInterval = useRef(null);
  const timerInterval = useRef(null);
  const attemptRef = useRef(null); 
  const lastViolationRef = useRef(null); // To prevent multiple rapid flags for the same event
  const isExtendedRef = useRef(false); // To track hardware transition
  const submittingRef = useRef(false); // To prevent proctoring flags during navigation/submit

  // --- Camera / face proctoring ---
  const [faceStrikes, setFaceStrikes] = useState(0);
  const [faceWarning, setFaceWarning] = useState(null); // { label, strike }
  const [terminationReason, setTerminationReason] = useState(null);
  const cameraErrorReportedRef = useRef(false);

  async function handleFaceViolation(event, metadata = {}) {
    const attemptId = attemptRef.current?.id;
    if (!attemptId || submittingRef.current) return;
    try {
      const res = await studentClient.attempts.logProctorEvent(attemptId, event, metadata);
      if (!res.success) return;
      setFaceStrikes(res.faceStrikes ?? 0);
      setFaceWarning({ label: FACE_VIOLATION_LABELS[event] || "Face check failed", strike: res.faceStrikes });
      // metadata.reason (e.g. eyes_down) is also stored server-side for the teacher
      if (res.wasTerminated) {
        setTerminationReason(res.terminationReason);
        setIsCheated(true);
      }
    } catch (e) { console.error("Face proctoring log failed", e); }
  }

  const camera = useFaceProctor({
    enabled: !loading && !!exam && !!attempt && !isCheated,
    onViolation: handleFaceViolation,
  });

  // Denying / losing the camera mid-exam counts as one face strike per incident
  useEffect(() => {
    if (camera.status === "error" && !cameraErrorReportedRef.current) {
      cameraErrorReportedRef.current = true;
      handleFaceViolation("CAMERA_OFF", { reason: camera.error });
    }
    if (camera.status === "ok") cameraErrorReportedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.status]);

  // Auto-hide the warning banner
  useEffect(() => {
    if (!faceWarning) return;
    const t = setTimeout(() => setFaceWarning(null), 6000);
    return () => clearTimeout(t);
  }, [faceWarning]);

  useEffect(() => {
    if (user && id) loadSession();
    
    // Proctoring Monitors
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !isCheated && attemptRef.current && !submittingRef.current) {
         setIsFullscreenViolation(true);
         handleViolation("FULLSCREEN_EXIT");
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !isCheated && attemptRef.current && !submittingRef.current) {
         handleViolation("TAB_SWITCH");
      }
    };

    const handleBlur = () => {
      if (!isCheated && attemptRef.current && !submittingRef.current) {
         handleViolation("WINDOW_BLUR");
      }
    };

    const handleHardwareChange = async () => {
      if (isCheated) return;
      
      let isViolation = !!window.screen.isExtended;
      
      try {
        if ('getScreenDetails' in window) {
          const details = await window.getScreenDetails();
          isViolation = details.screens.length > 1;
        }
      } catch (err) {
        // Ignore permission errors, fallback to basic isExtended
      }

      if (isViolation && !isCheated && attemptRef.current && !submittingRef.current) {
         setIsDualScreenViolation(true);
         // Strike only on the transition from Single to Dual
         if (!isExtendedRef.current) {
            handleViolation("MULTIPLE_DISPLAY_DETECTED");
         }
      } else {
         setIsDualScreenViolation(false);
      }
      isExtendedRef.current = isViolation;
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    
    // Listen for screen changes if API is available
    let screenDetails;
    const setupScreenListeners = async () => {
      try {
        if ('getScreenDetails' in window) {
          screenDetails = await window.getScreenDetails();
          screenDetails.addEventListener('screenschange', handleHardwareChange);
        }
      } catch (e) {}
    };
    setupScreenListeners();
    
    // Poller as backup for browsers without listeners
    const poller = setInterval(handleHardwareChange, 2500);

    return () => { 
      if (syncInterval.current) clearInterval(syncInterval.current); 
      if (timerInterval.current) clearInterval(timerInterval.current);
      clearInterval(poller);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      if (screenDetails) {
        screenDetails.removeEventListener('screenschange', handleHardwareChange);
      }
    };
  }, [user, id, isCheated]);

  async function handleViolation(type) {
    const activeAttemptId = attemptRef.current?.id;
    if (!activeAttemptId || isCheated || submittingRef.current) return;

    // Simple debounce: Don't log the same violation within 3 seconds
    const now = Date.now();
    if (lastViolationRef.current?.type === type && (now - lastViolationRef.current.time) < 3000) {
       return;
    }
    lastViolationRef.current = { type, time: now };

    try {
       const res = await studentClient.attempts.logProctorEvent(activeAttemptId, type);
       if (res.success) {
          console.log(`[Security Monitor] Flag Logged: ${type} | New Count: ${res.flagCount}`);
          setFlagCount(res.flagCount);
          if (res.wasTerminated) {
             setTerminationReason(res.terminationReason);
             setIsCheated(true);
          }
       }
    } catch (e) { console.error("Proctoring log failed", e); }
  }

  async function reEnterFullscreen() {
    try {
       if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
       }
       setIsFullscreenViolation(false);
    } catch (e) { alert("Fullscreen engage failed. Please try again."); }
  }

  async function loadSession() {
    setLoading(true);
    try {
        // Start/resume the attempt FIRST — the server only reveals the
        // question paper to students with a live attempt.
        const atRes = await studentClient.exams.start(id);
        if (!atRes.success) {
            setLoading(false);
            // A terminated attempt keeps showing the "Assessment Terminated" screen
            if (!isCheated) {
                alert(atRes.message || "Unable to start this assessment");
                router.push(`/dashboard/student/exams`);
            }
            return;
        }
        const exRes = await studentClient.exams.getById(id);
        
        if (exRes.success && atRes.success) {
            setExam(exRes.exam);
            setAttempt(atRes.attempt);
            
            // Re-inflate answers from attempt & local storage
            let initial = {};
            const localCache = localStorage.getItem(`testify_answers_${id}`);
            if (localCache) {
               try { initial = JSON.parse(localCache); } catch(e) {}
            }

            // Make the attempt available to handlers before timers start
            attemptRef.current = atRes.attempt;

            // Sync from Database if exists
            atRes.attempt.answers?.forEach(ans => {
                // Keep local cache if more recent, else db
                if (!initial[ans.questionId]) {
                    initial[ans.questionId] = {
                        selectedOptions: ans.selectedOptions || [],
                        subjectiveText: ans.subjectiveText || ""
                    };
                }
            });
            setLocalAnswers(initial);
            answersRef.current = initial;
            
            // Start Hearbeat
            startSyncLoop(atRes.attempt.id);
            
            // Calculate Time
            const expiry = new Date(atRes.attempt.expiresAt).getTime();
            updateTimer(expiry);

            // Re-inflate proctoring state
            setAttempt(atRes.attempt);
            attemptRef.current = atRes.attempt;
            setFlagCount(atRes.attempt.flagCount || 0);
            setFaceStrikes(atRes.attempt.faceStrikes || 0);
            if (atRes.attempt.status === 'CHEATED') setIsCheated(true);
        }
    } catch (e) {
        console.error("Session sync failed", e);
    }
    setLoading(false);
  }

  function updateTimer(expiry) {
    if (timerInterval.current) clearInterval(timerInterval.current);
    timerInterval.current = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, expiry - now);
        setTimeLeft(diff);
        if (diff === 0) {
            clearInterval(timerInterval.current);
            timerInterval.current = null;
            handleFinalSubmit(true); // Auto-submit
        }
    }, 1000);
  }

  function startSyncLoop(attemptId) {
    if (syncInterval.current) clearInterval(syncInterval.current);
    syncInterval.current = setInterval(async () => {
        await handleSync(attemptId);
    }, 30000); // 30s Heartbeat
  }

  async function handleSync(attemptId) {
      setSyncing(true);
      try {
          const answersToSync = Object.entries(answersRef.current).map(([qId, data]) => ({
              questionId: qId,
              ...data
          }));
          const targetId = attemptId || attemptRef.current?.id;
          const res = targetId
            ? await studentClient.attempts.sync(targetId, answersToSync)
            : { success: true };
          if (!res.success && res.message?.includes("already finalized")) {
              router.push(`/dashboard/student/exams`);
          }
      } catch (e) { 
          if (e.message?.includes("already finalized")) {
              router.push(`/dashboard/student/exams`);
          }
          console.error("Sync Pulse Error", e); 
      }
      setSyncing(false);
  }

  // NOTE: this is also invoked from the timer interval, whose closure was
  // created before `attempt` state was set — so always read from refs.
  async function handleFinalSubmit(isAuto = false) {
    if (submittingRef.current) return;
    if (!isAuto && !confirm("Irreversible: Finalize and submit assessment?")) return;
    const attemptId = attemptRef.current?.id;
    if (!attemptId) return;
    setSubmitting(true);
    submittingRef.current = true;
    if (syncInterval.current) clearInterval(syncInterval.current);
    try {
        // Final Sync (saves the last answers; the server accepts it within the grace window)
        await handleSync(attemptId);
        const res = await studentClient.attempts.submit(attemptId);
        if (res.success || res.message?.includes("already finalized")) {
            localStorage.removeItem(`testify_answers_${id}`);
            router.push(`/dashboard/student/exams`);
        } else {
            alert(res.message || "Submission failed");
            submittingRef.current = false;
            startSyncLoop(attemptId);
        }
    } catch (e) { 
        // If it's already finalized, just exit
        if (e.message?.includes("already finalized")) {
            router.push(`/dashboard/student/exams`);
        } else {
            alert("Submission failed. Please check your connection and try again."); 
            submittingRef.current = false;
            startSyncLoop(attemptId);
        }
    }
    setSubmitting(false);
  }

  function updateAnswer(questionId, data) {
    const nextState = {
        ...localAnswers,
        [questionId]: { ...localAnswers[questionId], ...data }
    };
    setLocalAnswers(nextState);
    answersRef.current = nextState;
    localStorage.setItem(`testify_answers_${id}`, JSON.stringify(nextState));
  }

  function toggleFlag(questionId) {
    setFlags(prev => {
        const next = new Set(prev);
        if (next.has(questionId)) next.delete(questionId);
        else next.add(questionId);
        return next;
    });
  }

  const formatTime = (ms) => {
    if (ms === null) return "00:00:00";
    const totalSec = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs > 0 ? `${hrs}:` : ""}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isCheated) return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
       <div className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-xl animate-in fade-in zoom-in-95 duration-300 sm:p-10">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
             <ShieldAlert className="size-7" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">Your exam has ended</h1>
          <p className="mt-2 text-sm text-muted-foreground">
             {terminationReason === "FACE_VIOLATIONS"
               ? `The camera recorded ${FACE_STRIKE_LIMIT} proctoring warnings, so the exam was submitted automatically.`
               : `The browser recorded ${BROWSER_STRIKE_LIMIT} proctoring violations, so the exam was submitted automatically.`}
             {" "}Answers saved before this point have been kept and will be graded.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-left">
             <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Browser violations</p>
                <p className="mt-1 font-semibold tabular-nums text-foreground">{flagCount} / {BROWSER_STRIKE_LIMIT}</p>
             </div>
             <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Camera warnings</p>
                <p className="mt-1 font-semibold tabular-nums text-foreground">{faceStrikes} / {FACE_STRIKE_LIMIT}</p>
             </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Reference: {attempt?.id?.slice(0, 8)} — your teacher can review what was recorded.</p>
          <Button onClick={() => router.push('/dashboard/student/exams')} className="mt-6 w-full">
             Back to my exams
          </Button>
       </div>
    </div>
  );

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
       <RotateCcw className="size-4 animate-spin" /> Preparing your exam…
    </div>
  );
  if (!exam || !attempt) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
       <AlertCircle className="size-8 text-destructive" />
       <p className="font-medium text-foreground">This exam isn't available right now.</p>
       <Button variant="outline" onClick={() => router.push('/dashboard/student/exams')}>Back to my exams</Button>
    </div>
  );

  const currentQuestion = exam.questions[currentIndex];
  const qData = localAnswers[currentQuestion.questionId] || { selectedOptions: [], subjectiveText: "" };
  const answeredCount = exam.questions.filter(q =>
    localAnswers[q.questionId]?.selectedOptions?.length || localAnswers[q.questionId]?.subjectiveText?.trim()
  ).length;
  const lowTime = timeLeft !== null && timeLeft < 300000;
  const isLast = currentIndex === exam.questions.length - 1;

  return (
    <div className="flex min-h-screen flex-col bg-background">
       {/* Exam header */}
       <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-card/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
             <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-primary font-serif text-lg font-bold italic text-primary-foreground sm:flex">T</span>
             <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">{exam.title}</h1>
                <p className="truncate text-xs text-muted-foreground">
                   {exam.subject?.name} · Question {currentIndex + 1} of {exam.questions.length}
                </p>
             </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
             <div
               className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${lowTime ? "border-destructive/40 bg-destructive/10 text-destructive" : "bg-muted/50 text-foreground"}`}
               aria-live="polite"
               title="Time remaining"
             >
                <Clock className={`size-4 ${lowTime ? "animate-pulse" : "text-muted-foreground"}`} />
                <span className="text-base font-semibold tabular-nums">{formatTime(timeLeft)}</span>
             </div>

             <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex" title={syncing ? "Saving answers" : "All answers saved"}>
                {syncing ? <Save className="size-3.5 animate-pulse" /> : <CheckCircle2 className="size-3.5 text-success-foreground" />}
                {syncing ? "Saving…" : "Saved"}
             </span>

             <Button onClick={() => handleFinalSubmit()} disabled={submitting} variant="success" className="shrink-0">
                {submitting ? "Submitting…" : "Submit exam"}
             </Button>
          </div>
       </header>

       <div className="flex flex-1 overflow-hidden">
          {/* Question navigator */}
          <aside className="hidden w-72 shrink-0 flex-col gap-6 border-r bg-card p-5 lg:flex">
             <div>
                <h2 className="text-sm font-semibold text-foreground">Questions</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Jump to any question. Answers save automatically.</p>
             </div>

             <div className="grid grid-cols-5 gap-2">
                {exam.questions.map((q, i) => {
                   const isAnswered = !!localAnswers[q.questionId]?.selectedOptions?.length || !!localAnswers[q.questionId]?.subjectiveText?.trim();
                   const isFlagged = flags.has(q.questionId);
                   const isCurrent = currentIndex === i;
                   return (
                      <button
                        key={i}
                        onClick={() => setCurrentIndex(i)}
                        aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ""}${isFlagged ? ", marked for review" : ""}`}
                        aria-current={isCurrent ? "step" : undefined}
                        className={`relative flex size-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                           isCurrent ? "border-primary bg-primary text-primary-foreground" :
                           isFlagged ? "border-warning/50 bg-warning/15 text-warning-foreground" :
                           isAnswered ? "border-success/40 bg-success/12 text-success-foreground" :
                           "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                         {i + 1}
                         {isFlagged && !isCurrent && <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-card bg-warning" />}
                      </button>
                   );
                })}
             </div>

             <div className="space-y-1.5 text-xs text-muted-foreground">
                <p className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-success/60" /> Answered</p>
                <p className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-warning/70" /> Marked for review</p>
                <p className="flex items-center gap-2"><span className="size-2.5 rounded-sm border bg-background" /> Not answered</p>
             </div>

             <div className="mt-auto space-y-2 border-t pt-4">
                <div className="flex items-center justify-between text-xs">
                   <span className="text-muted-foreground">Progress</span>
                   <span className="font-medium tabular-nums text-foreground">{answeredCount} / {exam.questions.length} answered</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                   <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${(answeredCount / exam.questions.length) * 100}%` }} />
                </div>
             </div>
          </aside>

          {/* Question workspace */}
          <main className="relative flex-1 overflow-y-auto px-4 pb-56 pt-8 sm:px-8 md:pb-8 md:pr-60">
             <div className="mx-auto max-w-3xl">
                <div className="rounded-2xl border bg-card p-6 shadow-xs sm:p-8">
                   <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                      <div className="flex flex-wrap items-center gap-2">
                         <span className="text-sm font-semibold text-foreground">Question {currentIndex + 1}</span>
                         <StatusBadge tone="neutral">{TYPE_LABEL[currentQuestion.question?.type] || "Question"}</StatusBadge>
                         <StatusBadge tone="primary">{currentQuestion.marks} {currentQuestion.marks === 1 ? "mark" : "marks"}</StatusBadge>
                      </div>
                      <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => toggleFlag(currentQuestion.questionId)}
                         className={flags.has(currentQuestion.questionId) ? "bg-warning/15 text-warning-foreground hover:bg-warning/25" : "text-muted-foreground"}
                      >
                         <Flag className={`size-3.5 ${flags.has(currentQuestion.questionId) ? "fill-current" : ""}`} />
                         {flags.has(currentQuestion.questionId) ? "Marked for review" : "Mark for review"}
                      </Button>
                   </div>

                   <h2 className="mt-6 whitespace-pre-wrap text-lg font-medium leading-relaxed text-foreground sm:text-xl">
                      {currentQuestion.questionTextSnapshot || currentQuestion.question?.text}
                   </h2>

                   <div className="mt-6">
                      {currentQuestion.question?.type.startsWith('MCQ') ? (
                         <div className="grid gap-2.5" role={currentQuestion.question.type === 'MCQ_MULTIPLE' ? "group" : "radiogroup"}>
                            {(currentQuestion.optionsSnapshot ? JSON.parse(currentQuestion.optionsSnapshot) : currentQuestion.question.options)?.map((opt, displayIndex) => {
                               const isSelected = qData.selectedOptions.includes(opt.id || opt.label);
                               const multiple = currentQuestion.question.type === 'MCQ_MULTIPLE';
                               const select = () => {
                                  let next = [...qData.selectedOptions];
                                  if (multiple) {
                                     if (isSelected) next = next.filter(i => i !== (opt.id || opt.label));
                                     else next.push(opt.id || opt.label);
                                  } else {
                                     next = [opt.id || opt.label];
                                  }
                                  updateAnswer(currentQuestion.questionId, { selectedOptions: next });
                               };
                               return (
                                 <button
                                   type="button"
                                   key={opt.id || opt.label}
                                   role={multiple ? "checkbox" : "radio"}
                                   aria-checked={isSelected}
                                   onClick={select}
                                   className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
                                      isSelected ? "border-primary bg-primary/8 ring-1 ring-primary" : "bg-background hover:border-primary/40 hover:bg-muted/40"
                                   }`}
                                 >
                                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
                                       isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                    }`}>
                                       {String.fromCharCode(65 + displayIndex)}
                                    </span>
                                    <span className="flex-1 text-sm font-medium text-foreground sm:text-base">{opt.text}</span>
                                    {isSelected && <CheckCircle2 className="size-5 shrink-0 text-primary" />}
                                 </button>
                               );
                            })}
                         </div>
                      ) : (
                         <div>
                            <textarea
                              className="h-72 w-full resize-y rounded-xl border bg-background p-4 text-base leading-relaxed text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary/50 focus:ring-3 focus:ring-ring"
                              placeholder="Type your answer here…"
                              value={qData.subjectiveText}
                              onChange={e => updateAnswer(currentQuestion.questionId, { subjectiveText: e.target.value })}
                            />
                            <p className="mt-1.5 text-right text-xs text-muted-foreground tabular-nums">
                               {(qData.subjectiveText || "").trim().split(/\s+/).filter(Boolean).length} words
                            </p>
                         </div>
                      )}
                   </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                   <Button
                      variant="outline"
                      onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                   >
                      <ChevronLeft className="size-4" /> Previous
                   </Button>
                   <Button
                      onClick={() => {
                         if (!isLast) setCurrentIndex(prev => prev + 1);
                         else handleFinalSubmit();
                      }}
                      variant={isLast ? "success" : "default"}
                   >
                      {isLast ? "Review & submit" : "Next question"} <ChevronRight className="size-4" />
                   </Button>
                </div>
             </div>

             {/* Extra display detected */}
             {isDualScreenViolation && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
                   <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                         <MonitorX className="size-7" />
                      </span>
                      <h2 className="mt-5 text-xl font-semibold text-foreground">Second display detected</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                         Only one screen is allowed. This has been recorded as a violation. Disconnect the extra display to continue.
                      </p>
                      <div className="mt-6 flex items-center justify-center gap-3">
                         <span className="text-xs text-muted-foreground">Violations</span>
                         <StrikeDots count={flagCount} limit={BROWSER_STRIKE_LIMIT} />
                      </div>
                   </div>
                </div>
             )}

             {/* Fullscreen exited */}
             {isFullscreenViolation && !isDualScreenViolation && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
                   <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-warning/15 text-warning-foreground">
                         <AlertTriangle className="size-7" />
                      </span>
                      <h2 className="mt-5 text-xl font-semibold text-foreground">You left fullscreen</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                         The exam must stay in fullscreen. This has been recorded as a violation — the exam ends automatically after {BROWSER_STRIKE_LIMIT}.
                      </p>
                      <div className="mt-6 flex items-center justify-center gap-3">
                         <span className="text-xs text-muted-foreground">Violations</span>
                         <StrikeDots count={flagCount} limit={BROWSER_STRIKE_LIMIT} />
                      </div>
                      <Button onClick={reEnterFullscreen} className="mt-6 w-full">
                         <Maximize2 className="size-4" /> Return to fullscreen
                      </Button>
                   </div>
                </div>
             )}

             {/* Live camera — pinned top-right under the header */}
             <div className="fixed bottom-4 right-4 z-40 flex w-36 flex-col gap-1.5 md:bottom-auto md:right-6 md:top-20 md:w-48 md:gap-2">
                <div className="flex items-center justify-between rounded-lg border bg-card/95 px-2.5 py-1 text-[11px] shadow-sm backdrop-blur md:px-3 md:py-1.5 md:text-xs">
                   <span className="font-medium text-muted-foreground">Camera</span>
                   <span className={`font-semibold tabular-nums ${faceStrikes > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {faceStrikes} / {FACE_STRIKE_LIMIT}<span className="hidden md:inline"> warnings</span>
                   </span>
                </div>
                <CameraPreview
                  videoRef={camera.videoRef}
                  status={camera.status}
                  reason={camera.reason}
                  lighting={camera.lighting}
                  calibrated={camera.calibrated}
                  metrics={camera.metrics}
                  debug={proctorDebug}
                  className="!w-36 shadow-lg md:!w-48"
                  size="sm"
                />
                {camera.pendingMs !== null && !["ok", "error", "camera_off"].includes(camera.status) && (
                   <div className="rounded-lg bg-warning px-3 py-2 text-xs font-medium text-black shadow-lg" role="alert">
                      {faceInstruction(camera.status, camera.reason)} Warning in {Math.ceil(camera.pendingMs / 1000)}s
                   </div>
                )}
                {(camera.status === "error" || camera.status === "camera_off") && (
                   <button
                     onClick={camera.retry}
                     className="rounded-lg bg-destructive px-3 py-2 text-xs font-medium text-white shadow-lg hover:bg-destructive/90"
                   >
                      Camera required — tap to re-enable
                   </button>
                )}
             </div>

             {faceWarning && (
                <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-xl bg-destructive px-5 py-3 text-sm font-medium text-white shadow-2xl animate-in fade-in slide-in-from-top-4" role="alert">
                   Camera warning {faceWarning.strike} of {FACE_STRIKE_LIMIT}: {faceWarning.label}.
                   {faceWarning.strike >= FACE_STRIKE_LIMIT - 1 && " One more will end your exam."}
                </div>
             )}
          </main>
       </div>
    </div>
  );
}
