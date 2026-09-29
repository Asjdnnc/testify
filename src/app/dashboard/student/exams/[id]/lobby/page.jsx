"use client";

import { useEffect, useState } from "react";
import { useFaceProctor } from "@/lib/use-face-proctor";
import { CameraPreview } from "@/components/proctoring/camera-preview";
import { FACE_STRIKE_LIMIT } from "@/lib/proctoring-rules";
import { LoadingState, EmptyState } from "@/components/ui/saas";
import { useAuth } from "@/context/auth-context";
import { studentClient } from "@/lib/api-client/student.client";
import { orgClient } from "@/lib/api-client/org.client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldCheck, 
  Info, 
  Clock, 
  FileText, 
  AlertTriangle, 
  Play, 
  ChevronLeft, 
  ChevronRight, 
  Zap, 
  MonitorX, 
  MonitorCheck, 
  Lock,
  Maximize2,
  CheckCircle2,
  RotateCcw,
  ScanFace
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

function StepCard({ icon: Icon, tone = "primary", title, children, footer }) {
  return (
  <div className="mx-auto max-w-xl rounded-2xl border bg-card p-6 text-center shadow-xs sm:p-8">
    <span className={`mx-auto flex size-12 items-center justify-center rounded-full ${
      tone === "success" ? "bg-success/12 text-success-foreground" : tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
    }`}>
      <Icon className="size-6" />
    </span>
    <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground">{title}</h2>
    <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    {footer && <div className="mt-6 space-y-3">{footer}</div>}
  </div>
);
}

export default function ExamLobbyPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: Info, 2: Hardware, 3: Camera, 4: Fullscreen
  const TOTAL_STEPS = 4;

  // Camera check: the face must be steadily detected before continuing
  // Fresh calibration here; the exam page reuses the learned baseline
  const camera = useFaceProctor({ enabled: currentStep === 3, recalibrate: true });
  const proctorDebug = useSearchParams().has("proctorDebug");
  const [faceOkSince, setFaceOkSince] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (camera.status === "ok") setFaceOkSince((prev) => prev ?? Date.now());
    else setFaceOkSince(null);
  }, [camera.status]);
  useEffect(() => {
    if (currentStep !== 3) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [currentStep]);
  const cameraVerified = camera.calibrated && faceOkSince !== null && now - faceOkSince >= 1500;
  const [screenSecurity, setScreenSecurity] = useState({ verified: false, count: 0, error: null });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (user && id) loadExam();
    
    const handleFullscreenChange = () => {
       setIsFullscreen(!!document.fullscreenElement);
    };

    // Monitor hardware continuously if on step 2
    let interval;
    if (currentStep === 2) {
       checkScreenSecurity();
       interval = setInterval(checkScreenSecurity, 2000);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
       if (interval) clearInterval(interval);
       document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [user, id, currentStep]);

  async function checkScreenSecurity() {
    try {
       if (window.screen.isExtended) {
          setScreenSecurity({ verified: false, count: 2, error: "Multiple displays detected" });
          return;
       }

       if ('getScreenDetails' in window) {
          const details = await window.getScreenDetails();
          if (details.screens.length > 1) {
             setScreenSecurity({ verified: false, count: details.screens.length, error: "Hardware Violation: Secondary Monitor Active" });
          } else {
             setScreenSecurity({ verified: true, count: 1, error: null });
          }
       } else {
          setScreenSecurity({ verified: true, count: 1, error: null });
       }
    } catch (err) {
       if (err.name === 'NotAllowedError') {
          setScreenSecurity({ verified: false, count: 0, error: "Permission Denied: Screen Security Access Required" });
       } else {
          setScreenSecurity({ verified: true, count: 1, error: null });
       }
    }
  }

  async function loadExam() {
    setLoading(true);
    try {
      const res = await studentClient.exams.getById(id);
      if (res.success) setExam(res.exam);
    } catch (e) { console.error("Load failed", e); }
    setLoading(false);
  }

  async function handleFullscreenRequest() {
    try {
       await document.documentElement.requestFullscreen();
    } catch (err) {
       alert("Fullscreen engage failed. Please check permissions.");
    }
  }

  async function handleLaunch() {
    setStarting(true);
    try {
       const res = await studentClient.exams.start(id);
       if (res.success) {
          router.push(`/dashboard/student/exams/${id}/active`);
       } else {
          alert(res.message);
       }
    } catch (e) { alert("Initialization failed"); }
    setStarting(false);
  }

  if (loading) return <LoadingState label="Loading exam…" />;
  if (!exam) return (
    <EmptyState
      icon={AlertTriangle}
      title="This exam isn't available"
      description="It may not be assigned to your batch, or the window has closed."
      action={<Button asChild variant="outline"><Link href="/dashboard/student/exams">Back to my exams</Link></Button>}
    />
  );

  const STEPS = ["Rules", "Display", "Camera", "Start"];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
       <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
             <Link href="/dashboard/student/exams" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ChevronLeft className="size-4" /> My exams
             </Link>
             <h1 className="text-2xl font-semibold tracking-tight text-foreground">{exam.title}</h1>
             <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Clock className="size-4" /> {exam.duration} minutes</span>
                <span className="inline-flex items-center gap-1.5"><FileText className="size-4" /> {exam.questionCount ?? exam.questions?.length ?? 0} questions · {exam.totalMarks} marks</span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4" /> Proctored</span>
             </div>
          </div>
       </div>

       {/* Stepper */}
       <ol className="grid grid-cols-4 gap-2">
          {STEPS.map((label, i) => {
             const step = i + 1;
             const done = currentStep > step;
             const active = currentStep === step;
             return (
                <li key={label} className="flex flex-col gap-2">
                   <div className={`h-1.5 rounded-full ${done ? "bg-success" : active ? "bg-primary" : "bg-muted"}`} />
                   <span className={`flex items-center gap-1.5 text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                      {done ? <CheckCircle2 className="size-3.5 text-success-foreground" /> : <span className="tabular-nums">{step}.</span>}
                      {label}
                   </span>
                </li>
             );
          })}
       </ol>

       <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {currentStep === 1 && (
             <div className="grid gap-6 lg:grid-cols-5">
                <div className="rounded-2xl border bg-card p-6 shadow-xs lg:col-span-3 sm:p-8">
                   <h2 className="text-lg font-semibold text-foreground">Before you begin</h2>
                   <p className="mt-1 text-sm text-muted-foreground">This exam is proctored. Please read these rules carefully.</p>
                   <ul className="mt-6 space-y-5">
                      {[
                         { t: "Stay in fullscreen", d: "Leaving fullscreen or switching tabs is recorded. 4 violations end the exam.", i: Maximize2 },
                         { t: "Use a single screen", d: "Disconnect external monitors before you start.", i: MonitorX },
                         { t: "Keep your camera on", d: `Stay in view and look at the screen. ${FACE_STRIKE_LIMIT} camera warnings end the exam. Video never leaves your device.`, i: ScanFace },
                         { t: "Answers save automatically", d: "Every 30 seconds and when you submit. If you get disconnected, just reopen the exam.", i: RotateCcw },
                         { t: "Submitting is final", d: "You can't change answers once submitted. The exam also submits when time runs out.", i: CheckCircle2 },
                      ].map(({ t, d, i: Icon }) => (
                         <li key={t} className="flex gap-4">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
                            <div>
                               <p className="text-sm font-medium text-foreground">{t}</p>
                               <p className="mt-0.5 text-sm text-muted-foreground">{d}</p>
                            </div>
                         </li>
                      ))}
                   </ul>
                </div>
                <div className="flex flex-col justify-between rounded-2xl border bg-card p-6 shadow-xs lg:col-span-2 sm:p-8">
                   <div>
                      <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Info className="size-5" /></span>
                      <h3 className="mt-4 font-semibold text-foreground">Ready?</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                         Next we&apos;ll check your display and camera. The timer only starts when you begin the exam.
                      </p>
                   </div>
                   <Button onClick={() => setCurrentStep(2)} className="mt-6 w-full">
                      I understand, continue <ChevronRight className="size-4" />
                   </Button>
                </div>
             </div>
          )}

          {currentStep === 2 && (
             <StepCard
               icon={screenSecurity.verified ? MonitorCheck : MonitorX}
               tone={screenSecurity.verified ? "success" : "danger"}
               title={screenSecurity.verified ? "Single display confirmed" : "Extra display detected"}
               footer={
                  <>
                     <Button onClick={() => setCurrentStep(3)} disabled={!screenSecurity.verified} className="w-full">
                        Continue to camera check <ChevronRight className="size-4" />
                     </Button>
                     <p className="text-xs text-muted-foreground">Checking your displays every few seconds…</p>
                  </>
               }
             >
                {screenSecurity.verified
                  ? "Only one screen is connected. You're good to go."
                  : screenSecurity.error || "Disconnect any secondary monitors or turn off extended desktop, then wait a moment."}
             </StepCard>
          )}

          {currentStep === 3 && (
             <StepCard
               icon={ScanFace}
               tone={cameraVerified ? "success" : camera.status === "error" ? "danger" : "primary"}
               title={cameraVerified ? "Camera verified" : camera.status === "error" ? "Camera required" : "Position your face"}
               footer={
                  <>
                     <div className="mx-auto w-full max-w-sm">
                        <CameraPreview
                          videoRef={camera.videoRef}
                          status={camera.status}
                          reason={camera.reason}
                          lighting={camera.lighting}
                          calibrated={camera.calibrated}
                          metrics={camera.metrics}
                          debug={proctorDebug}
                        />
                     </div>
                     {camera.status === "error" ? (
                        <Button onClick={camera.retry} variant="outline" className="w-full">
                           <RotateCcw className="size-4" /> Try camera again
                        </Button>
                     ) : (
                        <Button onClick={() => setCurrentStep(4)} disabled={!cameraVerified} className="w-full">
                           Continue <ChevronRight className="size-4" />
                        </Button>
                     )}
                     <p className="text-xs text-muted-foreground">
                        {cameraVerified
                          ? "Camera ready."
                          : camera.status === "ok" && !camera.calibrated
                            ? "Calibrating — look at the centre of your screen…"
                            : camera.status === "multiple"
                              ? "Only you may be in view."
                              : camera.status === "looking_away"
                                ? "Look straight at your screen."
                                : "Hold still, facing the camera…"}
                     </p>
                  </>
               }
             >
                {camera.error
                  ? camera.error
                  : "Sit in good light, alone, facing the screen. The camera stays on during the exam and is analysed only on this device — nothing is recorded or uploaded."}
             </StepCard>
          )}

          {currentStep === 4 && (
             <StepCard
               icon={isFullscreen ? ShieldCheck : Maximize2}
               tone={isFullscreen ? "success" : "primary"}
               title={isFullscreen ? "All set" : "Enter fullscreen"}
               footer={
                  !isFullscreen ? (
                     <Button onClick={handleFullscreenRequest} className="w-full">
                        <Maximize2 className="size-4" /> Enter fullscreen
                     </Button>
                  ) : (
                     <Button onClick={handleLaunch} disabled={starting} variant="success" className="w-full">
                        <Play className="size-4 fill-current" /> {starting ? "Starting…" : `Start exam · ${exam.duration} min`}
                     </Button>
                  )
               }
             >
                {isFullscreen
                  ? "The timer starts as soon as you begin. Don't leave fullscreen or switch tabs until you submit."
                  : "The exam runs in fullscreen. Click below, then start when you're ready."}
             </StepCard>
          )}
       </div>
    </div>
  );
}
