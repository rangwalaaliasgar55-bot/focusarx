/**
 * Study Room scene (Phase 7.4).
 *
 * The room IS the session: the lamp brightens with progress, the window
 * drifts from dusk to night, books stack per weekly session, streak dots
 * line the shelf. Pausing makes the lamp flicker low; a hidden tab
 * desaturates the room; completion warms the whole scene briefly.
 * Primitives only, no postprocessing — safe for integrated GPUs.
 */

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { bookStack, lampIntensity, windowSky } from "@/lib/sceneMaps";

export interface StudyRoomProps {
  pct: number;
  paused: boolean;
  stale: boolean;
  burstKey: number;
  streak: number;
  weekCount: number;
  visible: boolean;
}

const BOOK_COLORS = ["#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1"];

function Lamp({ pct, paused, burstKey }: { pct: number; paused: boolean; burstKey: number }) {
  const light = useRef<THREE.PointLight>(null!);
  const shade = useRef<THREE.MeshStandardMaterial>(null!);
  const flash = useRef(0);
  const lastKey = useRef(burstKey);
  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    if (lastKey.current !== burstKey) {
      lastKey.current = burstKey;
      if (burstKey > 0) flash.current = 1;
    }
    flash.current = Math.max(0, flash.current - delta * 1.1);
    let v = lampIntensity(pct, paused) + flash.current * 2.2;
    // Paused: low flicker instead of steady glow (rings stop).
    if (paused) v *= 0.92 + 0.08 * Math.sin(t * 9);
    if (light.current) light.current.intensity = v;
    if (shade.current) shade.current.emissiveIntensity = 0.4 + v * 0.5;
  });
  return (
    <group position={[1.7, 0, 0.4]}>
      {/* desk */}
      <mesh position={[-0.9, -1.5, 0]}>
        <boxGeometry args={[3.4, 0.14, 1.4]} />
        <meshStandardMaterial color="#3f2d20" roughness={0.85} />
      </mesh>
      {/* lamp pole + shade */}
      <mesh position={[0, -0.7, 0]}>
        <cylinderGeometry args={[0.045, 0.07, 1.5, 10]} />
        <meshStandardMaterial color="#1f2937" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.15, 0]} rotation={[0.5, 0, 0]}>
        <coneGeometry args={[0.42, 0.5, 20, 1, true]} />
        <meshStandardMaterial
          ref={shade}
          color="#b45309"
          emissive="#fbbf24"
          emissiveIntensity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight ref={light} position={[0, -0.1, 0.35]} distance={7} color="#fcd34d" intensity={0.5} />
      {/* bulb */}
      <mesh position={[0, -0.05, 0.1]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshBasicMaterial color="#fef9c3" />
      </mesh>
    </group>
  );
}

function BookRow({ weekCount }: { weekCount: number }) {
  const n = bookStack(weekCount);
  return (
    <group position={[-1.9, -0.55, -1.2]}>
      {/* shelf */}
      <mesh position={[0.7, -0.35, 0]}>
        <boxGeometry args={[2.6, 0.1, 0.7]} />
        <meshStandardMaterial color="#3f2d20" roughness={0.85} />
      </mesh>
      {Array.from({ length: n }).map((_, i) => (
        <mesh key={i} position={-0.35 + i * 0.3} rotation={[0, 0, (i % 2 === 0 ? 0.03 : -0.03)]}>
          <boxGeometry args={[0.24, 0.62 + ((i * 13) % 3) * 0.09, 0.5]} />
          <meshStandardMaterial color={BOOK_COLORS[i % BOOK_COLORS.length]} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function StreakDots({ streak }: { streak: number }) {
  const n = Math.min(Math.max(0, Math.floor(streak || 0)), 12);
  return (
    <group position={[-1.15, 0.75, -1.55]}>
      {Array.from({ length: n }).map((_, i) => (
        <mesh key={i} position={[(i % 6) * 0.22, -Math.floor(i / 6) * 0.22, 0]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export default function StudyRoomScene({ pct, paused, stale, burstKey, streak, weekCount, visible }: StudyRoomProps) {
  const sky = windowSky(pct);
  const desat = stale || paused;
  const wall = useMemo(() => {
    const c = new THREE.Color("#1e1b3a");
    if (desat) c.lerp(new THREE.Color("#404040"), 0.45);
    return `#${c.getHexString()}`;
  }, [desat]);
  const floorC = useMemo(() => {
    const c = new THREE.Color("#171226");
    if (desat) c.lerp(new THREE.Color("#2a2a2a"), 0.45);
    return `#${c.getHexString()}`;
  }, [desat]);

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 1.5]}
        frameloop={visible ? "always" : "never"}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance", stencil: false, depth: true }}
        camera={{ position: [0, 0.4, 6.4], fov: 50 }}
      >
        <color attach="background" args={[wall]} />
        <ambientLight intensity={0.35} />
        {/* floor + back wall */}
        <mesh position={[0, -1.7, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[24, 24]} />
          <meshStandardMaterial color={floorC} roughness={1} />
        </mesh>
        {/* window: dusk → night with elapsed time */}
        <mesh position={[-1.6, 0.7, -1.6]}>
          <planeGeometry args={[1.7, 2.1]} />
          <meshBasicMaterial color={sky.top} />
        </mesh>
        <mesh position={[-1.6, -0.1, -1.59]}>
          <planeGeometry args={[1.7, 0.55]} />
          <meshBasicMaterial color={sky.bottom} />
        </mesh>
        <mesh position={[-1.6, 0.7, -1.62]}>
          <planeGeometry args={[1.9, 2.3]} />
          <meshBasicMaterial color="#0f0d24" side={THREE.BackSide} />
        </mesh>
        <Lamp pct={pct} paused={paused} burstKey={burstKey} />
        <BookRow weekCount={weekCount} />
        <StreakDots streak={streak} />
      </Canvas>
    </div>
  );
}
