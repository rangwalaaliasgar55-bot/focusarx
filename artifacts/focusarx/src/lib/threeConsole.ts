/**
 * Quiet the two known-benign three.js console lines that showed up red/yellow
 * on every /focus, /forge-room and pet page load in production:
 *
 *   THREE.WebGLRenderer: Context Lost.
 *     @react-three/fiber calls `gl.forceContextLoss()` when a <Canvas>
 *     unmounts (route change, preset switch) to free GPU memory. That is the
 *     intended teardown path, not a crash — but three logs it every time.
 *
 *   THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.
 *     Emitted from *inside* @react-three/fiber (it still constructs a Clock for
 *     its render loop). Upgrading fiber does not remove it; only three itself
 *     can, and pinning an older three is a worse trade than filtering one line.
 *
 * three r18x routes every internal log/warn/error through `setConsoleFunction`,
 * so we install one sink that drops exactly these messages and forwards
 * everything else untouched (with the same console level). Real context
 * losses (GPU reset, tab backgrounded on Android) are still handled per canvas
 * via `onWebGLContextLost` below — they just no longer spam the console.
 */
import { setConsoleFunction } from "three";
import { logger } from "@/lib/logger";

const SILENCED: ReadonlyArray<RegExp> = [
  /^THREE\.WebGLRenderer: Context (Lost|Restored)\.?$/,
  /^THREE\.Clock: This module has been deprecated/,
];

let installed = false;

export function installThreeConsoleFilter(): void {
  if (installed) return;
  installed = true;
  setConsoleFunction((level, message, ...rest) => {
    if (typeof message === "string" && SILENCED.some((re) => re.test(message))) return;
    // three only ever emits log/warn/error here. Errors are real failures and
    // always print; warnings and info lines are routine renderer diagnostics
    // and go through the project logger (visible with focusarx:debug=1).
    if (level === "error") logger.error(message, ...rest);
    else if (level === "warn") logger.warn(message, ...rest);
    else logger.info(message, ...rest);
  });
}

/**
 * Canvas `onCreated` helper: mark a real context loss so callers can fall back
 * to CSS, and let the browser attempt a restore. Pass a setter for the
 * component's "webgl ok" state; `preventDefault()` is what allows
 * `webglcontextrestored` to fire afterwards.
 */
export function onWebGLContextLost(canvas: HTMLCanvasElement, onLost?: () => void, onRestored?: () => void): () => void {
  const lost = (e: Event) => {
    e.preventDefault();
    onLost?.();
  };
  const restored = () => onRestored?.();
  canvas.addEventListener("webglcontextlost", lost, false);
  canvas.addEventListener("webglcontextrestored", restored, false);
  return () => {
    canvas.removeEventListener("webglcontextlost", lost, false);
    canvas.removeEventListener("webglcontextrestored", restored, false);
  };
}
