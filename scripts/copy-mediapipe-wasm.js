// Copies the MediaPipe WASM runtime into /public so face proctoring loads
// from our own origin (college networks often block third-party CDNs).
// Runs automatically on `npm install` and before `npm run build`.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = path.join(__dirname, "..", "public", "mediapipe", "wasm");
const FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

if (!fs.existsSync(src)) {
  console.warn("[copy-mediapipe-wasm] @mediapipe/tasks-vision not installed; skipping");
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });
for (const file of FILES) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}
console.log(`[copy-mediapipe-wasm] copied ${FILES.length} files to public/mediapipe/wasm`);
