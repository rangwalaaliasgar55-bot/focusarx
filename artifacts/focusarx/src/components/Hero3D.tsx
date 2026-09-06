import { resolveColorToken } from "@/lib/color-tokens";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, Suspense, useState, useEffect } from "react";
import * as THREE from "three";
import { Environment, Lightformer, PerspectiveCamera } from "@react-three/drei";
import { getDeviceTier } from "@/lib/deviceTier";

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return reduced;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

/**
 * The hero object — a single physical thing, lit like a product shot.
 *
 * It is the timer ring made solid: a brushed-metal torus around a frosted
 * glass disc, on a studio rig of soft area lights. It rotates very slowly
 * and tilts a few degrees toward the pointer; nothing orbits, nothing
 * distorts, nothing twinkles. The restraint is the point — it should read as
 * an object you could pick up, not a particle effect.
 */
function FocusRing({ lowDetail }: { lowDetail: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);
  const tilt = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    // Pointer tilt is damped so it settles like a physical object, and is
    // capped at ~9° so the ring never shows its back face.
    const targetX = lowDetail ? 0 : THREE.MathUtils.clamp(-state.pointer.y * 0.16, -0.16, 0.16);
    const targetY = lowDetail ? 0 : THREE.MathUtils.clamp(state.pointer.x * 0.16, -0.16, 0.16);
    const k = 1 - Math.exp(-delta * 4);
    tilt.current.x += (targetX - tilt.current.x) * k;
    tilt.current.y += (targetY - tilt.current.y) * k;
    groupRef.current.rotation.x = 0.42 + tilt.current.x;
    groupRef.current.rotation.y = t * (lowDetail ? 0.05 : 0.09) + tilt.current.y;
    groupRef.current.position.y = lowDetail ? 0 : Math.sin(t * 0.6) * 0.06;
  });

  const segments = lowDetail ? 48 : 200;

  return (
    <group ref={groupRef}>
      {/* Metal ring */}
      <mesh>
        <torusGeometry args={[2.1, 0.26, lowDetail ? 16 : 48, segments]} />
        <meshStandardMaterial
          color={resolveColorToken("--brand-500")}
          metalness={0.92}
          roughness={0.28}
          envMapIntensity={1.4}
        />
      </mesh>

      {/* Frosted glass disc */}
      <mesh>
        <cylinderGeometry args={[1.86, 1.86, 0.12, segments]} />
        <meshPhysicalMaterial
          color={resolveColorToken("--neutral-0")}
          transmission={lowDetail ? 0 : 0.92}
          thickness={0.8}
          roughness={0.55}
          ior={1.4}
          transparent
          opacity={lowDetail ? 0.14 : 1}
          envMapIntensity={0.8}
        />
      </mesh>

      {/* Hairline highlight on the inner edge of the ring */}
      {!lowDetail && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.86, 0.008, 8, segments]} />
          <meshBasicMaterial color={resolveColorToken("--neutral-0")} transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

/** Studio rig: three soft area lights, no HDR download. */
function Studio() {
  return (
    <Environment resolution={128} frames={1}>
      <Lightformer intensity={3} position={[0, 5, -6]} scale={[10, 4, 1]} form="rect" color={resolveColorToken("--neutral-0")} />
      <Lightformer intensity={1.6} position={[-6, 2, 4]} rotation={[0, Math.PI / 2, 0]} scale={[6, 3, 1]} form="rect" color={resolveColorToken("--brand-300")} />
      <Lightformer intensity={1.2} position={[6, -1, 3]} rotation={[0, -Math.PI / 2, 0]} scale={[5, 3, 1]} form="rect" color={resolveColorToken("--brand-teal")} />
    </Environment>
  );
}

export default function Hero3D() {
  const [webglOk, setWebglOk] = useState<boolean>(() => {
    try {
      return canUseWebGL();
    } catch {
      return false;
    }
  });
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  // Tier C (Essential) never mounts a GL context: old phones, save-data
  // users and legacy in-app WebViews get a static glow instead.
  const [tier] = useState(() => {
    try {
      return getDeviceTier();
    } catch {
      return "full" as const;
    }
  });
  const lowDetail = isMobile || reducedMotion || tier !== "full";
  const staticOnly = reducedMotion || tier === "essential";

  // Release GPU caches on unmount. Capability itself is computed once in
  // the state initializer above (no mount-effect setState).
  useEffect(() => {
    return () => {
      try { THREE.Cache.clear(); } catch {}
    };
  }, []);

  // Pause the render loop while the tab is hidden — the hero is decorative,
  // so hidden-tab frames are pure battery drain.
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );
  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (webglOk === false) {
    return (
      <div className="absolute inset-0 z-[var(--z-base)] flex items-center justify-center opacity-20">
        <div className="h-[300px] w-[300px] rounded-full bg-gradient-to-r from-[var(--palette-purple-500)] to-[var(--palette-blue-500)] blur-3xl animate-pulse motion-reduce:animate-none" />
      </div>
    );
  }

  // Respect prefers-reduced-motion and Tier C: static glow, zero GPU cost.
  if (staticOnly) {
    return (
      <div className="absolute inset-0 z-[var(--z-base)] flex items-center justify-center opacity-30">
        <div className="h-[280px] w-[280px] rounded-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)] blur-2xl" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[var(--z-base)]">
      <Canvas
        dpr={[1, 1.5]}
        frameloop={pageVisible ? "always" : "never"}
        gl={{
          antialias: !isMobile,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        shadows={false}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setWebglOk(false);
          });
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={38} />
        <ambientLight intensity={lowDetail ? 1.2 : 0.35} />
        <directionalLight position={[4, 6, 6]} intensity={lowDetail ? 1.5 : 0.9} />
        <Suspense fallback={null}>
          {!lowDetail && <Studio />}
          <FocusRing lowDetail={lowDetail} />
        </Suspense>
      </Canvas>
    </div>
  );
}
