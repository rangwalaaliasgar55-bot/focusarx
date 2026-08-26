import { resolveColorToken } from "@/lib/color-tokens";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo, Suspense, useEffect, useState, lazy } from "react";
import * as THREE from "three";
import { OrbitControls, PerspectiveCamera, Text, Float, Environment, ContactShadows } from "@react-three/drei";
import { use3DQuality } from "@/hooks/use3DQuality";

const BUILDINGS_CONFIG = [
  { id: "hut", name: "Study Hut", xp: 0, color: resolveColorToken("--brand-400"), emoji: "🏠", height: 1 },
  { id: "library", name: "Library", xp: 500, color: resolveColorToken("--info"), emoji: "📚", height: 2 },
  { id: "cafe", name: "Focus Cafe", xp: 2000, color: resolveColorToken("--palette-fcd34d"), emoji: "☕", height: 1.5 },
  { id: "gym", name: "Mind Gym", xp: 5000, color: resolveColorToken("--success"), emoji: "⚡", height: 2.5 },
  { id: "academy", name: "Academy", xp: 10000, color: resolveColorToken("--brand-pink"), emoji: "🏛️", height: 3 },
  { id: "tower", name: "Clock Tower", xp: 25000, color: resolveColorToken("--palette-fb923c"), emoji: "🕰️", height: 4 },
  { id: "observatory", name: "Observatory", xp: 100000, color: resolveColorToken("--palette-818cf8"), emoji: "🔭", height: 3.5 },
];

function Building({ config, position, unlocked, quality }: { config: any, position: [number, number, number], unlocked: boolean, quality: ReturnType<typeof use3DQuality> }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const lowDetail = quality.effectiveQuality === "battery" || quality.effectiveQuality === "off";

  return (
    <group position={position}>
      <Float speed={unlocked && quality.config.cameraMovement ? 1.5 : 0} rotationIntensity={lowDetail ? 0 : 0.2} floatIntensity={lowDetail ? 0 : 0.5}>
        <mesh ref={meshRef}>
          <boxGeometry args={[1, config.height, 1]} />
          <meshStandardMaterial
            color={unlocked ? config.color : resolveColorToken("--palette-2a2a3a")}
            metalness={quality.config.reflections ? 0.6 : 0.2}
            roughness={quality.config.reflections ? 0.2 : 0.6}
            transparent
            opacity={unlocked ? 0.9 : 0.4}
            emissive={unlocked ? config.color : resolveColorToken("--neutral-950")}
            emissiveIntensity={unlocked ? (quality.isHigh ? 0.25 : 0.15) : 0}
          />
        </mesh>
        {unlocked && (
           <Text
             position={[0, config.height / 2 + 0.5, 0]}
             fontSize={0.4}
             color={resolveColorToken("--palette-white")}
             anchorX="center"
             anchorY="middle"
           >
             {config.emoji}
           </Text>
        )}
      </Float>
      {!unlocked && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.1, config.height + 0.1, 1.1]} />
          <meshStandardMaterial color={resolveColorToken("--neutral-950")} wireframe transparent opacity={0.1} />
        </mesh>
      )}
    </group>
  );
}

function CityScene({ totalXp, quality }: { totalXp: number, quality: ReturnType<typeof use3DQuality> }) {
  const lowDetail = quality.effectiveQuality === "battery";
  return (
    <>
      <PerspectiveCamera makeDefault position={[8, 8, 8]} fov={40} />
      <OrbitControls enableZoom={false} autoRotate={quality.config.autoRotate} autoRotateSpeed={0.5} enableDamping={false} />
      <ambientLight intensity={lowDetail ? 0.9 : 0.7} />
      {quality.config.lights > 1 && <pointLight position={[10, 10, 10]} intensity={1} />}
      {quality.config.environment && <Environment preset="night" />}

      <group position={[0, -1, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color={resolveColorToken("--palette-0a0f1e")} roughness={0.8} />
        </mesh>

        {quality.config.backgroundEffects && <gridHelper args={[20, 20, resolveColorToken("--palette-1a2e1a"), resolveColorToken("--palette-111")]} position={[0, 0.01, 0]} />}

        {BUILDINGS_CONFIG.map((b, i) => {
          const angle = (i / BUILDINGS_CONFIG.length) * Math.PI * 2;
          const radius = 5;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const unlocked = totalXp >= b.xp;
          // Reduce animated objects on battery saver
          if (quality.effectiveQuality === "battery" && i >= quality.config.animatedObjects) {
            return null;
          }
          return (
            <Building
              key={b.id}
              config={b}
              position={[x, b.height / 2, z]}
              unlocked={unlocked}
              quality={quality}
            />
          );
        })}
      </group>

      {quality.config.contactShadows && <ContactShadows opacity={0.4} scale={20} blur={2.4} far={4.5} />}
    </>
  );
}

function useWebGLSupport() {
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) setSupported(false);
    } catch {
      setSupported(false);
    }
  }, []);
  return supported;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
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

export function FocusCityFallback({ totalXp }: { totalXp: number }) {
  const unlockedCount = BUILDINGS_CONFIG.filter(b => totalXp >= b.xp).length;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-8 text-center">
      <div className="text-4xl">🏙️</div>
      <div>
        <p className="font-semibold">Focus City (2D Mode)</p>
        <p className="text-sm text-muted-foreground mt-1">
          {unlockedCount} of {BUILDINGS_CONFIG.length} buildings unlocked
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-2">
        {BUILDINGS_CONFIG.map(b => {
          const unlocked = totalXp >= b.xp;
          return (
            <div key={b.id} className={`rounded-lg border p-2 text-center ${unlocked ? "bg-primary/10 border-primary/30" : "opacity-40"}`}>
              <div className="text-xl">{b.emoji}</div>
              <div className="text-[10px] mt-1">{b.name}</div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-2">3D unavailable — showing lightweight fallback</p>
    </div>
  );
}

export function CitySkeleton() {
  return (
    <div className="h-full w-full animate-pulse rounded-xl bg-muted/50 flex items-center justify-center">
      <div className="text-sm text-muted-foreground">Loading city...</div>
    </div>
  );
}

export default function FocusCity3D({ totalXp, className }: { totalXp: number, className?: string }) {
  const webglSupported = useWebGLSupport();
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const quality = use3DQuality();
  const lowDetail = isMobile || reducedMotion || quality.effectiveQuality === "battery";

  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Load 3D scene only after main interface is usable - don't block timer/dashboard
    const id = requestAnimationFrame(() => {
      // Defer 3D loading by 1 frame + 300ms to prioritize main thread
      const timeout = setTimeout(() => setIsVisible(true), 300);
      return () => clearTimeout(timeout);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    return () => {
      try {
        THREE.Cache.clear();
      } catch {}
    };
  }, []);

  // Manual setting: Off -> always fallback
  if (quality.isOff || !webglSupported || hasError) {
    return <FocusCityFallback totalXp={totalXp} />;
  }

  // Don't block main interface - show skeleton until visible
  if (!isVisible) {
    return <CitySkeleton />;
  }

  return (
    <div className={`h-full w-full ${className}`}>
      {/* Quality selector for mobile */}
      <div className="absolute right-2 top-2 z-10 flex gap-1 md:hidden">
        {(["battery", "balanced", "high"] as const).map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => quality.setQuality(q)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              quality.quality === q
                ? "bg-[var(--brand-600)] text-white"
                : "bg-[var(--surface-1)] text-[var(--foreground-subtle)]"
            }`}
          >
            {q === "battery" ? "Saver" : q}
          </button>
        ))}
      </div>
      <Canvas
        dpr={quality.config.dpr}
        frameloop={reducedMotion ? "demand" : quality.effectiveQuality === "battery" ? "demand" : "always"}
        gl={{
          antialias: quality.config.antialias,
          powerPreference: "high-performance",
          alpha: true,
          stencil: false,
          depth: true,
        }}
        shadows={quality.config.shadows}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setHasError(true);
          });
        }}
      >
        <Suspense fallback={null}>
          <CityScene totalXp={totalXp} quality={quality} />
        </Suspense>
      </Canvas>
      {/* Manual setting hint */}
      <div className="absolute bottom-2 left-2 right-2 flex justify-center md:hidden">
        <p className="rounded-full bg-black/40 px-3 py-1 text-[10px] text-white/60 backdrop-blur">
          Settings → Appearance → 3D effects: {quality.appearance}
        </p>
      </div>
    </div>
  );
}
