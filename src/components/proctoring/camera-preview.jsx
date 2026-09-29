"use client";

import { Camera, CameraOff, Loader2, UserX, Users, ScanFace, Eye, SunDim } from "lucide-react";

const STATUS_UI = {
  idle:         { label: "Camera off",          tone: "bg-slate-500",   Icon: CameraOff },
  loading:      { label: "Starting camera…",    tone: "bg-slate-500",   Icon: Loader2 },
  ok:           { label: "Face detected",       tone: "bg-emerald-500", Icon: ScanFace },
  no_face:      { label: "Face not visible",    tone: "bg-rose-500",    Icon: UserX },
  multiple:     { label: "Multiple people",     tone: "bg-rose-500",    Icon: Users },
  looking_away: { label: "Look at the screen",  tone: "bg-amber-500",   Icon: Eye },
  camera_off:   { label: "Camera disconnected", tone: "bg-rose-500",    Icon: CameraOff },
  error:        { label: "Camera unavailable",  tone: "bg-rose-500",    Icon: CameraOff },
};

const REASON_LABELS = {
  head_turned: "Face the screen",
  head_tilted: "Keep your head up",
  eyes_down: "Don't look down",
  eyes_side: "Eyes on the screen",
};

/** Short instruction for the current problem (used in warnings/countdowns). */
export function faceInstruction(status, reason) {
  if (status === "multiple") return "Only you may be in view.";
  if (status === "no_face") return "Keep your face in view.";
  if (status === "looking_away") return `${REASON_LABELS[reason] || "Look at the screen"}.`;
  return "";
}

/**
 * Mirrored live preview with a status pill.
 * Pass the values returned by useFaceProctor.
 */
export function CameraPreview({ videoRef, status, reason, lighting, calibrated, metrics, debug = false, className = "", size = "md" }) {
  const ui = STATUS_UI[status] || STATUS_UI.idle;
  const Icon = ui.Icon;
  const bad = !["ok", "loading", "idle"].includes(status);
  const label = status === "looking_away" && REASON_LABELS[reason] ? REASON_LABELS[reason] : ui.label;
  const sizeCls = size === "sm" ? "w-44 aspect-[4/3]" : size === "xs" ? "w-36 aspect-[4/3]" : "w-full aspect-[4/3]";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-slate-900 ring-2 transition-colors ${
        bad ? "ring-rose-500" : status === "ok" ? "ring-emerald-500/70" : "ring-slate-700"
      } ${sizeCls} ${className}`}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        aria-label="Your camera preview"
        className="absolute inset-0 h-full w-full object-cover -scale-x-100"
      />
      {(status === "idle" || status === "loading" || status === "error" || status === "camera_off") && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          {status === "loading" ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
        </div>
      )}

      {lighting === "dark" && status !== "error" && (
        <div className="absolute top-2 left-2 right-2 flex items-center gap-1.5 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-semibold text-amber-300">
          <SunDim className="size-3 shrink-0" /> Too dark — add more light
        </div>
      )}

      {debug && metrics && (
        <div className="absolute top-2 right-2 rounded-md bg-black/70 px-1.5 py-1 font-mono text-[9px] leading-tight text-emerald-300 text-right">
          <div>faces {metrics.faces}{calibrated ? "" : " · calibrating"}</div>
          {metrics.yaw != null && <div>yaw {metrics.yaw}° pitch {metrics.pitch}°</div>}
          {metrics.gazeDown != null && <div>gaze ↓{metrics.gazeDown} ↔{metrics.gazeSide}</div>}
        </div>
      )}

      <div
        className={`absolute left-2 bottom-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white ${ui.tone}`}
        role="status"
        aria-live="polite"
      >
        <Icon className={`size-3 shrink-0 ${status === "loading" ? "animate-spin" : ""}`} />
        <span className="truncate">{label}</span>
      </div>
    </div>
  );
}
