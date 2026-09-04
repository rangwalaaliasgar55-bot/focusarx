/**
 * Deep Sea scene (Phase 7.4).
 *
 * The dive IS the session: surface at 0%, trench at 100%. Longer
 * uninterrupted work goes deeper and creatures appear at 25/50/75%.
 * A hidden tab pulls the diver back toward the surface (visible penalty);
 * completion releases a bubble burst; streak fish orbit (cap 12).
 * Primitives only, no postprocessing — safe for integrated GPUs.
 */

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { seaCameraY, seaCreatures, seaDepth, seaFogDensity } from "@/lib/sceneMaps";

export interface DeepSeaProps {
  pct: number;
  paused: boolean;
  stale: boolean;
  burstKey: number;
  streak: number;
  visible: boolean;
}

const CREATURE_COLORS = ["#5eead4", "#a78bfa", "#fbbf24"];

function Diver({ pct, stale }: { pct: number; stale: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const targetY = seaCameraY(pct, stale);
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    // Slow descent toward the target depth + gentle sway. Never jumps.
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, targetY, 0.02);
    group.current.position.x = Math.sin(t * 0.18) * 0.35;
  });
  return (
    <group ref={group} position={[0, 2, 0]}>
      {/* diver lamp */}
      <pointLight intensity={1.15} distance={9} color="#fef3c7" />
      <mesh>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial color="#fde68a" emissive="#f59e0b" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0, -0.55, 0]}>
        <coneGeometry args={[0.3, 0.9, 12]} />
        <meshStandardMaterial color="#164e63" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Creatures({ pct }: { pct: number }) {
  const group = useRef<THREE.Group>(null!);
  const count = seaCreatures(pct);
  const items = useMemo(
    () =>
      [
        { pos: [-2.6, -0.5, -2.5] as const, color: CREATURE_COLORS[0] },
        { pos: [2.4, -2.2, -3.5] as const, color: CREATURE_COLORS[1] },
        { pos: [0.2, -3.6, -2] as const, color: CREATURE_COLORS[2] },
      ].slice(0, count),
    [count],
  );
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    group.current.children.forEach((child, i) => {
      child.position.y += Math.sin(t * 0.9 + i * 2.1) * 0.0022;
    });
  });
  return (
    <group ref={group}>
      {items.map((c, i) => (
        <mesh key={i} position={[c.pos[0], c.pos[1], c.pos[2]]}>
          <octahedronGeometry args={[0.28]} />
          <meshStandardMaterial color={c.color} emissive={c.color} emissiveIntensity={0.9} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function FishSchool({ streak }: { streak: number }) {
  const group = useRef<THREE.Group>(null!);
  const n = Math.min(Math.max(0, Math.floor(streak || 0)), 12);
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime() * 0.35;
    group.current.children.forEach((child, i) => {
      const a = t + (i / Math.max(1, n)) * Math.PI * 2;
      const r = 2.2 + (i % 3) * 0.45;
      child.position.set(Math.cos(a) * r, -1.4 + Math.sin(a * 1.7) * 0.5, Math.sin(a) * r - 1);
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: n }).map((_, i) => (
        <mesh key={i}>
          <coneGeometry args={[0.09, 0.3, 6]} />
          <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Bubbles({ burstKey }: { burstKey: number }) {
  const group = useRef<THREE.Group>(null!);
  const flash = useRef(0);
  const lastKey = useRef(burstKey);
  useFrame((_, delta) => {
    if (!group.current) return;
    if (lastKey.current !== burstKey) {
      lastKey.current = burstKey;
      if (burstKey > 0) flash.current = 1;
    }
    flash.current = Math.max(0, flash.current - delta * 1.2);
    const s = 1 + flash.current * 1.6;
    group.current.scale.setScalar(s);
    group.current.children.forEach((child) => {
      const m = child as THREE.Mesh;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.25 + flash.current * 0.75;
    });
  });
  const dots = useMemo(
    () =>
      Array.from({ length: 26 }).map((_, i) => {
        const a = (i / 26) * Math.PI * 2;
        const r = 0.8 + ((i * 37) % 10) / 10;
        return [Math.cos(a) * r, Math.sin(a * 1.3) * r, -Math.abs(Math.sin(a)) * 0.6] as const;
      }),
    [],
  );
  return (
    <group ref={group}>
      {dots.map((p, i) => (
        <mesh key={i} position={[p[0], p[1], p[2]]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#bae6fd" transparent opacity={0.25} />
        </mesh>
      ))}
    </group>
  );
}

function Plankton() {
  const group = useRef<THREE.Group>(null!);
  const dots = useMemo(
    () =>
      Array.from({ length: 42 }).map((_, i) => [
        ((i * 53) % 100) / 100 * 10 - 5,
        -((i * 29) % 100) / 100 * 7,
        -((i * 71) % 100) / 100 * 6,
      ] as const),
    [],
  );
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    group.current.position.y = Math.sin(t * 0.12) * 0.25;
  });
  return (
    <group ref={group}>
      {dots.map((p, i) => (
        <mesh key={i} position={[p[0], p[1], p[2]]}>
          <sphereGeometry args={[0.03, 6, 6]} />
          <meshBasicMaterial color="#a5f3fc" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

export default function DeepSeaScene({ pct, paused, stale, burstKey, streak, visible }: DeepSeaProps) {
  const depth = seaDepth(pct);
  // Surface teal → trench navy. Paused/stale wash toward grey (penalty).
  const bg = useMemo(() => {
    const c = new THREE.Color().lerpColors(
      new THREE.Color("#0e3a4a"),
      new THREE.Color("#020617"),
      depth,
    );
    if (paused || stale) c.lerp(new THREE.Color("#334155"), 0.35);
    return `#${c.getHexString()}`;
  }, [depth, paused, stale]);
  const fog = seaFogDensity(pct);

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 1.5]}
        frameloop={visible ? "always" : "never"}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance", stencil: false, depth: true }}
        camera={{ position: [0, 2, 7], fov: 55 }}
      >
        <color attach="background" args={[bg]} />
        <fog attach="fog" args={[bg, 4, 4 + (1 - fog) * 60]} />
        <ambientLight intensity={0.55 - depth * 0.25} />
        <directionalLight position={[0, 6, 2]} intensity={0.9 - depth * 0.6} color="#bae6fd" />
        {/* light rays fade with depth */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-2 + i * 2, 3.4, -3]} rotation={[0.2, 0, 0.35 * (i - 1)]}>
            <planeGeometry args={[0.9, 7]} />
            <meshBasicMaterial color="#7dd3fc" transparent opacity={0.10 * (1 - depth)} depthWrite={false} />
          </mesh>
        ))}
        {/* seabed */}
        <mesh position={[0, -4.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#0c2531" roughness={1} />
        </mesh>
        <Diver pct={pct} stale={stale} />
        <Creatures pct={pct} />
        <FishSchool streak={streak} />
        <Bubbles burstKey={burstKey} />
        <Plankton />
      </Canvas>
    </div>
  );
}
