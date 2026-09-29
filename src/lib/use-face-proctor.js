"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FACE_GRACE_MS, FACE_REPEAT_MS } from "./proctoring-rules";

// ---------------------------------------------------------------------------
// In-browser face proctoring (MediaPipe). Video frames are analysed locally
// and never leave the device — only event names are reported.
//
// Primary engine: FaceLandmarker (478 landmarks) →
//   • real 3-D head pose (yaw / pitch) from the facial transformation matrix
//   • eye-gaze from blendshapes (eyes looking down / sideways)
//   • up to 2 faces tracked (second person detection)
// Fallback engine (older / low-end devices): BlazeFace detector → face count
//   + a rough left/right head-turn estimate from keypoints.
//
// Accuracy aids:
//   • per-student calibration: the head pose while looking at the screen is
//     learned first, and only deviations from it count (camera height varies)
//   • temporal smoothing: majority vote over recent frames, so single-frame
//     glitches don't flip the status
//   • grace periods before a strike (see proctoring-rules.js)
//   • lighting check: too-dark video shows a hint instead of silently failing
// ---------------------------------------------------------------------------

const WASM_PATH = "/mediapipe/wasm";
const LANDMARKER_MODEL = "/mediapipe/models/face_landmarker.task";
const DETECTOR_MODEL = "/mediapipe/models/blaze_face_short_range.tflite";

// Head-pose limits, in degrees away from the student's calibrated baseline
export const POSE_LIMITS = { yaw: 30, pitchDown: 22, pitchUp: 28 };
// Eye-gaze blendshape limits (0–1). Reading the screen stays well below these.
const GAZE_LIMITS = { down: 0.65, side: 0.7 };
// Fallback (BlazeFace) head-turn ratio
const KEYPOINT_YAW_LIMIT = 0.6;

const CALIBRATION_SAMPLES = 8;
const MAX_BASELINE_DEG = 20; // never accept a baseline that is itself "looking away"
const SMOOTHING_WINDOW = 5;
const DARK_LUMA = 45; // 0–255 mean brightness
const BASELINE_KEY = "testify:face-baseline";

// ---------------------------------------------------------------------------
// Engine loading (cached; shared by lobby and exam page)
// ---------------------------------------------------------------------------
let enginePromise = null;

async function createEngine() {
  const { FaceLandmarker, FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

  const tryDelegates = async (factory) => {
    try {
      return await factory("GPU");
    } catch {
      return await factory("CPU");
    }
  };

  try {
    const landmarker = await tryDelegates((delegate) =>
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: LANDMARKER_MODEL, delegate },
        runningMode: "VIDEO",
        numFaces: 2,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      })
    );
    return { kind: "landmarker", analyse: (video, ts) => fromLandmarker(landmarker.detectForVideo(video, ts)) };
  } catch (err) {
    console.warn("[face-proctor] FaceLandmarker unavailable, falling back to BlazeFace", err);
    const detector = await tryDelegates((delegate) =>
      FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: DETECTOR_MODEL, delegate },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.5,
      })
    );
    return { kind: "detector", analyse: (video, ts) => fromDetector(detector.detectForVideo(video, ts)) };
  }
}

function loadEngine() {
  if (!enginePromise) {
    enginePromise = createEngine().catch((err) => {
      enginePromise = null; // allow a retry
      throw err;
    });
  }
  return enginePromise;
}

// ---------------------------------------------------------------------------
// Result normalisation → { faceCount, pose?: {yaw, pitch}, gaze?: {down, side}, keypointYaw? }
// ---------------------------------------------------------------------------
const toDeg = (r) => (r * 180) / Math.PI;

function poseFromMatrix(m) {
  // Column-major 4×4 → rotation terms → Euler angles
  const r20 = m[2], r21 = m[6], r22 = m[10];
  return {
    pitch: toDeg(Math.atan2(r21, r22)),
    yaw: toDeg(Math.asin(Math.max(-1, Math.min(1, -r20)))),
  };
}

function gazeFromBlendshapes(categories = []) {
  const s = Object.fromEntries(categories.map((c) => [c.categoryName, c.score]));
  const avg = (a, b) => ((s[a] ?? 0) + (s[b] ?? 0)) / 2;
  return {
    down: avg("eyeLookDownLeft", "eyeLookDownRight"),
    // looking to one side = one eye "out" and the other "in"
    side: Math.max(avg("eyeLookOutLeft", "eyeLookInRight"), avg("eyeLookInLeft", "eyeLookOutRight")),
  };
}

function fromLandmarker(result) {
  const faceCount = result.faceLandmarks?.length ?? 0;
  if (faceCount !== 1) return { faceCount };
  const matrix = result.facialTransformationMatrixes?.[0]?.data;
  return {
    faceCount,
    pose: matrix ? poseFromMatrix(matrix) : null,
    gaze: result.faceBlendshapes?.[0] ? gazeFromBlendshapes(result.faceBlendshapes[0].categories) : null,
  };
}

function fromDetector(result) {
  const score = (d) => d.categories?.[0]?.score ?? 0;
  const strong = (result.detections || []).filter((d) => score(d) >= 0.6);
  const any = (result.detections || []).filter((d) => score(d) >= 0.5);
  if (strong.length === 0) return { faceCount: 0 };
  if (any.length > 1) return { faceCount: any.length };
  const [rightEye, leftEye, nose] = strong[0].keypoints || [];
  let keypointYaw = null;
  if (rightEye && leftEye && nose) {
    const eyeDist = Math.abs(rightEye.x - leftEye.x);
    if (eyeDist > 0.01) keypointYaw = Math.abs(nose.x - (rightEye.x + leftEye.x) / 2) / eyeDist;
  }
  return { faceCount: 1, keypointYaw };
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------
const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function classify(frame, baseline) {
  if (frame.faceCount === 0) return { status: "no_face" };
  if (frame.faceCount > 1) return { status: "multiple" };

  if (frame.pose && baseline) {
    const dYaw = frame.pose.yaw - baseline.yaw;
    const dPitch = frame.pose.pitch - baseline.pitch;
    if (Math.abs(dYaw) > POSE_LIMITS.yaw) return { status: "looking_away", reason: "head_turned" };
    // Sign of pitch depends on camera placement, so use magnitude with the
    // stricter "down" limit — looking down at a phone/notes is the main risk.
    if (Math.abs(dPitch) > POSE_LIMITS.pitchDown) return { status: "looking_away", reason: "head_tilted" };
  }
  if (frame.gaze) {
    if (frame.gaze.down > GAZE_LIMITS.down) return { status: "looking_away", reason: "eyes_down" };
    if (frame.gaze.side > GAZE_LIMITS.side) return { status: "looking_away", reason: "eyes_side" };
  }
  if (frame.keypointYaw != null && frame.keypointYaw > KEYPOINT_YAW_LIMIT) {
    return { status: "looking_away", reason: "head_turned" };
  }
  return { status: "ok" };
}

function smooth(history, raw, previous) {
  history.push(raw);
  if (history.length > SMOOTHING_WINDOW) history.shift();
  const counts = {};
  for (const h of history) counts[h.status] = (counts[h.status] || 0) + 1;
  const [top, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (n > history.length / 2) {
    // keep the most recent reason for that status
    return [...history].reverse().find((h) => h.status === top);
  }
  return previous;
}

const STATUS_TO_EVENT = {
  no_face: "FACE_NOT_DETECTED",
  multiple: "MULTIPLE_FACES",
  looking_away: "FACE_LOOKING_AWAY",
};

function readStoredBaseline() {
  try {
    const b = JSON.parse(sessionStorage.getItem(BASELINE_KEY) || "null");
    if (b && Number.isFinite(b.yaw) && Number.isFinite(b.pitch)) return b;
  } catch {}
  return null;
}
function storeBaseline(b) {
  try { sessionStorage.setItem(BASELINE_KEY, JSON.stringify(b)); } catch {}
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
/**
 * @param {object}   opts
 * @param {boolean}  opts.enabled        start/stop the camera
 * @param {function} [opts.onViolation]  (event, metadata) => void — fired once a
 *                                        problem persists past its grace period
 * @param {boolean}  [opts.recalibrate]  ignore any stored baseline and learn a new one
 * @param {number}   [opts.intervalMs]   analysis frequency
 */
export function useFaceProctor({ enabled, onViolation, recalibrate = false, intervalMs = 300 }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const onViolationRef = useRef(onViolation);
  const episodeRef = useRef({ status: "ok", since: 0, lastStrikeAt: 0 });
  const historyRef = useRef([]);
  const smoothedRef = useRef({ status: "ok" });
  const baselineRef = useRef(null);
  const calibrationRef = useRef([]);
  const lumaCanvasRef = useRef(null);
  const lastLumaAtRef = useRef(0);

  const [status, setStatus] = useState("idle"); // idle | loading | ok | no_face | multiple | looking_away | camera_off | error
  const [reason, setReason] = useState(null);   // for looking_away: head_turned | head_tilted | eyes_down | eyes_side
  const [error, setError] = useState(null);
  const [pendingMs, setPendingMs] = useState(null);
  const [calibrated, setCalibrated] = useState(false);
  const [lighting, setLighting] = useState("ok"); // ok | dark
  const [engine, setEngine] = useState(null);     // landmarker | detector
  const [metrics, setMetrics] = useState(null);   // live numbers for debugging / tuning

  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const report = useCallback((event, metadata = {}) => {
    try {
      onViolationRef.current?.(event, metadata);
    } catch (e) {
      console.error("[face-proctor] onViolation failed", e);
    }
  }, []);

  const checkLighting = useCallback((video, now) => {
    if (now - lastLumaAtRef.current < 2000) return;
    lastLumaAtRef.current = now;
    try {
      const c = (lumaCanvasRef.current ||= document.createElement("canvas"));
      c.width = 32; c.height = 24;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, 32, 24);
      const px = ctx.getImageData(0, 0, 32, 24).data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      setLighting(sum / (px.length / 4) < DARK_LUMA ? "dark" : "ok");
    } catch {}
  }, []);

  const start = useCallback(async () => {
    stop();
    setError(null);
    setStatus("loading");
    historyRef.current = [];
    smoothedRef.current = { status: "ok" };
    calibrationRef.current = [];
    baselineRef.current = recalibrate ? null : readStoredBaseline();
    setCalibrated(!!baselineRef.current);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error("This browser does not support camera access."), { name: "NotSupportedError" });
      }
      const [stream, eng] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        }),
        loadEngine(),
      ]);
      streamRef.current = stream;
      setEngine(eng.kind);

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play().catch(() => {});
      }

      // Camera unplugged / permission revoked / another app grabbed it
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          setPendingMs(null);
          setStatus("camera_off");
          report("CAMERA_OFF", { reason: "track_ended" });
        };
      });

      episodeRef.current = { status: "ok", since: performance.now(), lastStrikeAt: 0 };
      let lastTs = 0;

      timerRef.current = setInterval(() => {
        const v = videoRef.current;
        if (!v || v.readyState < 2 || document.hidden) return;

        const now = performance.now();
        const ts = Math.max(now, lastTs + 1); // VIDEO mode needs strictly increasing timestamps
        lastTs = ts;

        let frame;
        try {
          frame = eng.analyse(v, ts);
        } catch {
          return; // transient frame error
        }
        checkLighting(v, now);

        // --- calibration: learn this student's "looking at the screen" pose ---
        if (!baselineRef.current && frame.faceCount === 1 && frame.pose) {
          const gazeOk = !frame.gaze || (frame.gaze.down < GAZE_LIMITS.down && frame.gaze.side < GAZE_LIMITS.side);
          const plausible = Math.abs(frame.pose.yaw) < MAX_BASELINE_DEG + 10 && Math.abs(frame.pose.pitch) < MAX_BASELINE_DEG + 10;
          if (gazeOk && plausible) calibrationRef.current.push(frame.pose);
          if (calibrationRef.current.length >= CALIBRATION_SAMPLES) {
            const clamp = (x) => Math.max(-MAX_BASELINE_DEG, Math.min(MAX_BASELINE_DEG, x));
            baselineRef.current = {
              yaw: clamp(median(calibrationRef.current.map((p) => p.yaw))),
              pitch: clamp(median(calibrationRef.current.map((p) => p.pitch))),
            };
            storeBaseline(baselineRef.current);
            setCalibrated(true);
          }
        }
        if (eng.kind === "detector" && frame.faceCount === 1 && !baselineRef.current) {
          baselineRef.current = { yaw: 0, pitch: 0 }; // detector has no pose to calibrate
          setCalibrated(true);
        }

        const raw = classify(frame, baselineRef.current);
        const result = smooth(historyRef.current, raw, smoothedRef.current);
        smoothedRef.current = result;

        setStatus(result.status);
        setReason(result.reason || null);
        setMetrics({
          faces: frame.faceCount,
          yaw: frame.pose ? +(frame.pose.yaw - (baselineRef.current?.yaw ?? 0)).toFixed(1) : null,
          pitch: frame.pose ? +(frame.pose.pitch - (baselineRef.current?.pitch ?? 0)).toFixed(1) : null,
          gazeDown: frame.gaze ? +frame.gaze.down.toFixed(2) : null,
          gazeSide: frame.gaze ? +frame.gaze.side.toFixed(2) : null,
        });

        const ep = episodeRef.current;
        if (result.status !== ep.status) {
          episodeRef.current = { status: result.status, since: now, lastStrikeAt: 0 };
          setPendingMs(result.status === "ok" ? null : FACE_GRACE_MS[STATUS_TO_EVENT[result.status]] ?? null);
          return;
        }
        if (result.status === "ok") return;

        const event = STATUS_TO_EVENT[result.status];
        const grace = FACE_GRACE_MS[event] ?? 3000;
        const dueAt = ep.lastStrikeAt ? ep.lastStrikeAt + FACE_REPEAT_MS : ep.since + grace;
        setPendingMs(Math.max(0, dueAt - now));

        if (now >= dueAt) {
          ep.lastStrikeAt = now;
          report(event, {
            reason: result.reason,
            engine: eng.kind,
            faceCount: frame.faceCount,
            persistedMs: Math.round(now - ep.since),
          });
        }
      }, intervalMs);
    } catch (err) {
      stop();
      const message =
        err?.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser's address bar and try again."
          : err?.name === "NotFoundError"
            ? "No camera was found. Connect a webcam and try again."
            : err?.name === "NotReadableError"
              ? "Your camera is being used by another application. Close it and try again."
              : err?.message || "Could not start the camera.";
      setError(message);
      setStatus("error");
    }
  }, [intervalMs, recalibrate, report, stop, checkLighting]);

  useEffect(() => {
    if (enabled) start();
    else {
      stop();
      setStatus("idle");
    }
    return stop;
  }, [enabled, start, stop]);

  return { videoRef, status, reason, error, pendingMs, calibrated, lighting, engine, metrics, retry: start, stop };
}
