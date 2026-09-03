/**
 * Side-effect-free WebGL capability check.
 *
 * Lives outside the 3D components so pages can probe capability without
 * importing three.js into their static chunk graph (see Pet3D / pets.tsx).
 */

let _webglChecked = false;
let _webglOk = false;

/** True when a WebGL context can be created AND the user hasn't asked for reduced motion. */
export function is3DCapable(): boolean {
  if (_webglChecked) return _webglOk;
  _webglChecked = true;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ?? canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    _webglOk = Boolean(gl);
    if (_webglOk && typeof window !== "undefined") {
      _webglOk = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
  } catch {
    _webglOk = false;
  }
  return _webglOk;
}
