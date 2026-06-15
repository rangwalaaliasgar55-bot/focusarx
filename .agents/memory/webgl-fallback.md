---
name: WebGL sandbox fallback
description: ThreeBackground must detect WebGL support before rendering the R3F Canvas, since Replit sandbox has no GPU.
---

## Rule
Never render `<Canvas>` from @react-three/fiber without first checking WebGL availability. The Replit dev/preview sandbox has no GPU, so `new WebGLRenderer()` throws synchronously inside Three.js before any React error boundary can catch it — crashing the whole app with a Vite runtime-error overlay.

## Pattern (ThreeBackground.tsx)
```ts
function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return !!ctx;
  } catch { return false; }
}

export default function ThreeBackground() {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  useEffect(() => { setWebglOk(canUseWebGL()); }, []);
  if (webglOk === null) return null;
  if (!webglOk) return <CssFallbackBackground />;
  return <div><Canvas ...>...</Canvas></div>;
}
```

**Why:** The error fires inside `new WebGLRenderer()` at Three.js init time — not inside a React render — so React error boundaries are powerless. Must guard at the component level before the Canvas is mounted.

**How to apply:** Any component that creates a Three.js / R3F Canvas must use this `canUseWebGL()` pattern. The CSS fallback is `CssFallbackBackground` — animated Framer Motion radial gradient orbs that provide the same visual atmosphere without GPU.
