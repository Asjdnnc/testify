// ---------------------------------------------------------------------------
// Proctoring rules shared by the browser (exam UI) and the server (strike
// counting). Keep this file free of server-only imports.
// ---------------------------------------------------------------------------

// Browser-integrity violations (tab switch, fullscreen exit, extra display)
export const BROWSER_VIOLATIONS = ["FULLSCREEN_EXIT", "TAB_SWITCH", "MULTIPLE_DISPLAY_DETECTED"];
export const BROWSER_STRIKE_LIMIT = 4;

// Camera / face violations — counted separately from browser violations
export const FACE_VIOLATIONS = ["FACE_NOT_DETECTED", "MULTIPLE_FACES", "FACE_LOOKING_AWAY", "CAMERA_OFF"];
export const FACE_STRIKE_LIMIT = 4;

export const FACE_VIOLATION_LABELS = {
  FACE_NOT_DETECTED: "Face not visible",
  MULTIPLE_FACES: "More than one person detected",
  FACE_LOOKING_AWAY: "Looking away from the screen",
  CAMERA_OFF: "Camera turned off or blocked",
};

// How long a problem must persist before it becomes a strike (ms), so a
// brief glance or a detection glitch doesn't penalise the student.
export const FACE_GRACE_MS = {
  FACE_NOT_DETECTED: 3000,
  FACE_LOOKING_AWAY: 3000,
  MULTIPLE_FACES: 1500,
};

// If the problem continues after a strike, another strike is issued after this long.
export const FACE_REPEAT_MS = 8000;
