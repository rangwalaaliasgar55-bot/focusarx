/**
 * Pet3D — procedural 3D pet companion (Workstream I).
 *
 * Six species (owl, fox, dragon, robot, cat, phoenix) built entirely from
 * low-poly primitives — no external models, textures, or network assets.
 * Evolution stage scales the pet and adds a stage gem (stage ≥ 3) / aura ring
 * (stage 4). Mood drives the idle animation (bob, head tilt, blink rate).
 *
 * 2D fallback: the parent decides — check is3DCapable() (WebGL + reduced
 * motion) and keep the emoji render for devices without it. An internal
 * error boundary falls back (onCrash) if the GPU context fails at runtime.
 */
import { Component, Suspense, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ── capability + error boundary ─────────────────────────────────────────────

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

class Pet3DErrorBoundary extends Component<{ onCrash?: () => void; children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch() {
    this.props.onCrash?.();
  }
  render() {
    if (this.state.crashed) return null;
    return this.props.children;
  }
}

// ── rig: shared animation targets ───────────────────────────────────────────

type Rig = {
  eyes: THREE.Group | null;
  head: THREE.Group | null;
  wingsL: THREE.Group | null;
  wingsR: THREE.Group | null;
  tail: THREE.Group | null;
};

type MoodName = "happy" | "excited" | "sleepy" | "focused";

const MOODS: Record<MoodName, { amp: number; speed: number; headTilt: number; headNod: number; eyeScale: number; flap: number; flapSpeed: number }> = {
  happy:    { amp: 0.05,  speed: 2.2, headTilt: 0.0,  headNod: 0.0,  eyeScale: 1.0,  flap: 0.12, flapSpeed: 2.0 },
  excited:  { amp: 0.1,   speed: 3.8, headTilt: 0.04, headNod: 0.04, eyeScale: 1.08, flap: 0.3,  flapSpeed: 5.0 },
  sleepy:   { amp: 0.02,  speed: 0.9, headTilt: 0.16, headNod: 0.22, eyeScale: 0.45, flap: 0.04, flapSpeed: 1.0 },
  focused:  { amp: 0.035, speed: 1.7, headTilt: 0.05, headNod: 0.0,  eyeScale: 0.9,  flap: 0.1,  flapSpeed: 2.2 },
};

const STAGE_SCALE = [0.85, 1.0, 1.12, 1.22];

// ── shared bits ─────────────────────────────────────────────────────────────

function Eyes({ y, z, spacing, size = 0.15, dark = "#0f172a", rig }: {
  y: number; z: number; spacing: number; size?: number; dark?: string; rig: MutableRefObject<Rig>;
}) {
  return (
    <group position={[0, y, z]} ref={(g) => { rig.current.eyes = g; }}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * spacing, 0, 0]}>
          <mesh>
            <sphereGeometry args={[size, 20, 20]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.25} />
          </mesh>
          <mesh position={[0, 0, size * 0.72]}>
            <sphereGeometry args={[size * 0.45, 16, 16]} />
            <meshStandardMaterial color={dark} roughness={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BlobShadow({ scale = 1 }: { scale?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]} scale={[scale, scale, 1]}>
      <circleGeometry args={[1.05, 32]} />
      <meshBasicMaterial color="#020617" transparent opacity={0.35} />
    </mesh>
  );
}

type ModelProps = { rig: MutableRefObject<Rig>; stage: number };

// ── species ─────────────────────────────────────────────────────────────────

function OwlPet({ rig }: ModelProps) {
  return (
    <group>
      {/* body */}
      <mesh position={[0, 0.62, 0]} scale={[1, 1.18, 0.95]}>
        <sphereGeometry args={[0.62, 24, 24]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.55, 0.36]} scale={[0.85, 1.05, 0.55]}>
        <sphereGeometry args={[0.42, 20, 20]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
      </mesh>
      {/* wings */}
      <group ref={(g) => { rig.current.wingsL = g; }} position={[-0.6, 0.68, 0]}>
        <mesh scale={[0.35, 0.9, 0.55]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#64748b" roughness={0.85} />
        </mesh>
      </group>
      <group ref={(g) => { rig.current.wingsR = g; }} position={[0.6, 0.68, 0]}>
        <mesh scale={[0.35, 0.9, 0.55]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#64748b" roughness={0.85} />
        </mesh>
      </group>
      {/* feet */}
      {[-0.18, 0.18].map((x) => (
        <mesh key={x} position={[x, 0.07, 0.14]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.6} />
        </mesh>
      ))}
      {/* head */}
      <group ref={(g) => { rig.current.head = g; }} position={[0, 1.42, 0]}>
        <mesh>
          <sphereGeometry args={[0.52, 24, 24]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.8} />
        </mesh>
        {/* ear tufts */}
        <mesh position={[-0.3, 0.42, 0]} rotation-z={0.3}>
          <coneGeometry args={[0.12, 0.24, 10]} />
          <meshStandardMaterial color="#64748b" roughness={0.85} />
        </mesh>
        <mesh position={[0.3, 0.42, 0]} rotation-z={-0.3}>
          <coneGeometry args={[0.12, 0.24, 10]} />
          <meshStandardMaterial color="#64748b" roughness={0.85} />
        </mesh>
        <Eyes y={0.03} z={0.42} spacing={0.2} rig={rig} />
        <mesh position={[0, -0.14, 0.5]} rotation-x={Math.PI / 2}>
          <coneGeometry args={[0.07, 0.16, 10]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

function FoxPet({ rig }: ModelProps) {
  return (
    <group>
      {/* tail (behind, sways) */}
      <group ref={(g) => { rig.current.tail = g; }} position={[0, 0.55, -0.5]}>
        <mesh rotation-x={-0.7} scale={[0.55, 0.42, 1.7]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial color="#fb923c" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.16, 0.85]} rotation-x={-0.7}>
          <sphereGeometry args={[0.15, 14, 14]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.85} />
        </mesh>
      </group>
      {/* body */}
      <mesh position={[0, 0.55, 0]} scale={[0.95, 1.05, 0.9]}>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshStandardMaterial color="#fb923c" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.48, 0.3]} scale={[0.8, 1, 0.6]}>
        <sphereGeometry args={[0.36, 18, 18]} />
        <meshStandardMaterial color="#fff7ed" roughness={0.9} />
      </mesh>
      {/* paws */}
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.08, 0.12]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color="#431407" roughness={0.8} />
        </mesh>
      ))}
      {/* head */}
      <group ref={(g) => { rig.current.head = g; }} position={[0, 1.28, 0]}>
        <mesh>
          <sphereGeometry args={[0.42, 24, 24]} />
          <meshStandardMaterial color="#fb923c" roughness={0.8} />
        </mesh>
        {/* ears */}
        <mesh position={[-0.24, 0.38, 0]} rotation-z={0.15}>
          <coneGeometry args={[0.16, 0.36, 12]} />
          <meshStandardMaterial color="#ea580c" roughness={0.8} />
        </mesh>
        <mesh position={[0.24, 0.38, 0]} rotation-z={-0.15}>
          <coneGeometry args={[0.16, 0.36, 12]} />
          <meshStandardMaterial color="#ea580c" roughness={0.8} />
        </mesh>
        {/* muzzle + nose */}
        <mesh position={[0, -0.1, 0.34]} scale={[1, 0.85, 1]}>
          <sphereGeometry args={[0.17, 16, 16]} />
          <meshStandardMaterial color="#fff7ed" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.06, 0.49]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshStandardMaterial color="#1c1917" roughness={0.4} />
        </mesh>
        <Eyes y={0.08} z={0.36} spacing={0.17} size={0.11} dark="#431407" rig={rig} />
      </group>
    </group>
  );
}

function DragonPet({ rig }: ModelProps) {
  return (
    <group>
      {/* tail chain */}
      <group ref={(g) => { rig.current.tail = g; }} position={[0, 0.5, -0.6]}>
        {[0, 0.3, 0.55].map((d, i) => (
          <mesh key={d} position={[0, -0.12 * i, -d]}>
            <sphereGeometry args={[0.16 - i * 0.04, 14, 14]} />
            <meshStandardMaterial color="#7c3aed" roughness={0.7} />
          </mesh>
        ))}
      </group>
      {/* wings */}
      <group ref={(g) => { rig.current.wingsL = g; }} position={[-0.7, 1.0, -0.2]}>
        <mesh scale={[1, 0.6, 0.12]} rotation-y={0.3}>
          <sphereGeometry args={[0.55, 16, 16]} />
          <meshStandardMaterial color="#a78bfa" roughness={0.6} transparent opacity={0.92} />
        </mesh>
      </group>
      <group ref={(g) => { rig.current.wingsR = g; }} position={[0.7, 1.0, -0.2]}>
        <mesh scale={[1, 0.6, 0.12]} rotation-y={-0.3}>
          <sphereGeometry args={[0.55, 16, 16]} />
          <meshStandardMaterial color="#a78bfa" roughness={0.6} transparent opacity={0.92} />
        </mesh>
      </group>
      {/* body */}
      <mesh position={[0, 0.6, 0]} scale={[1, 1.05, 1.1]}>
        <sphereGeometry args={[0.6, 24, 24]} />
        <meshStandardMaterial color="#8b5cf6" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.55, 0.4]} scale={[0.85, 1, 0.7]}>
        <sphereGeometry args={[0.4, 18, 18]} />
        <meshStandardMaterial color="#6ee7b7" roughness={0.7} />
      </mesh>
      {/* legs */}
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, 0.1, 0.18]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial color="#6d28d9" roughness={0.7} />
        </mesh>
      ))}
      {/* head */}
      <group ref={(g) => { rig.current.head = g; }} position={[0, 1.38, 0.05]}>
        <mesh scale={[1, 0.95, 1.15]}>
          <sphereGeometry args={[0.4, 24, 24]} />
          <meshStandardMaterial color="#8b5cf6" roughness={0.6} />
        </mesh>
        {/* horns */}
        <mesh position={[-0.16, 0.36, -0.05]} rotation-z={0.2}>
          <coneGeometry args={[0.06, 0.22, 10]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} />
        </mesh>
        <mesh position={[0.16, 0.36, -0.05]} rotation-z={-0.2}>
          <coneGeometry args={[0.06, 0.22, 10]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} />
        </mesh>
        {/* snout */}
        <mesh position={[0, -0.1, 0.4]} scale={[1.1, 0.75, 0.8]}>
          <sphereGeometry args={[0.14, 14, 14]} />
          <meshStandardMaterial color="#7c3aed" roughness={0.6} />
        </mesh>
        <Eyes y={0.06} z={0.38} spacing={0.16} size={0.1} dark="#1e1b4b" rig={rig} />
      </group>
    </group>
  );
}

function RobotPet({ rig }: ModelProps) {
  return (
    <group>
      {/* body */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.8, 0.9, 0.6]} />
        <meshStandardMaterial color="#06b6d4" roughness={0.35} metalness={0.45} />
      </mesh>
      {/* chest screen */}
      <mesh position={[0, 0.62, 0.31]}>
        <boxGeometry args={[0.48, 0.28, 0.04]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} emissive="#164e63" emissiveIntensity={0.9} />
      </mesh>
      {/* arms */}
      <group ref={(g) => { rig.current.wingsL = g; }} position={[-0.5, 0.62, 0]}>
        <mesh rotation-z={0.18}>
          <cylinderGeometry args={[0.055, 0.055, 0.46, 12]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh position={[0.09, -0.26, 0]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#0e7490" roughness={0.4} metalness={0.4} />
        </mesh>
      </group>
      <group ref={(g) => { rig.current.wingsR = g; }} position={[0.5, 0.62, 0]}>
        <mesh rotation-z={-0.18}>
          <cylinderGeometry args={[0.055, 0.055, 0.46, 12]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh position={[-0.09, -0.26, 0]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#0e7490" roughness={0.4} metalness={0.4} />
        </mesh>
      </group>
      {/* feet */}
      {[-0.18, 0.18].map((x) => (
        <mesh key={x} position={[x, 0.08, 0.06]}>
          <boxGeometry args={[0.22, 0.16, 0.3]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
      {/* head */}
      <group ref={(g) => { rig.current.head = g; }} position={[0, 1.32, 0]}>
        <mesh>
          <boxGeometry args={[0.62, 0.5, 0.55]} />
          <meshStandardMaterial color="#0891b2" roughness={0.35} metalness={0.45} />
        </mesh>
        {/* ear blocks */}
        <mesh position={[-0.35, 0, 0]}>
          <boxGeometry args={[0.08, 0.18, 0.2]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} />
        </mesh>
        <mesh position={[0.35, 0, 0]}>
          <boxGeometry args={[0.08, 0.18, 0.2]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} />
        </mesh>
        {/* antenna */}
        <mesh position={[0, 0.36, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.22, 8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#f0abfc" emissive="#f0abfc" emissiveIntensity={1.4} roughness={0.3} />
        </mesh>
        {/* eyes */}
        <group ref={(g) => { rig.current.eyes = g; }} position={[0, 0.02, 0.29]}>
          {[-0.14, 0.14].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <boxGeometry args={[0.13, 0.06, 0.02]} />
              <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={1.6} roughness={0.2} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

function CatPet({ rig }: ModelProps) {
  return (
    <group>
      {/* tail curl */}
      <group ref={(g) => { rig.current.tail = g; }} position={[0.42, 0.32, -0.42]}>
        <mesh position={[0.12, 0.18, -0.1]}>
          <sphereGeometry args={[0.11, 14, 14]} />
          <meshStandardMaterial color="#ec4899" roughness={0.8} />
        </mesh>
        <mesh position={[0.2, 0.42, -0.16]}>
          <sphereGeometry args={[0.1, 14, 14]} />
          <meshStandardMaterial color="#ec4899" roughness={0.8} />
        </mesh>
        <mesh position={[0.24, 0.64, -0.2]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#fbcfe8" roughness={0.85} />
        </mesh>
      </group>
      {/* body */}
      <mesh position={[0, 0.55, 0]} scale={[1, 1.08, 0.95]}>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshStandardMaterial color="#ec4899" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.5, 0.32]} scale={[0.8, 0.9, 0.6]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#fdf2f8" roughness={0.9} />
      </mesh>
      {/* paws */}
      {[-0.2, 0.2].map((x) => (
        <mesh key={x} position={[x, 0.08, 0.14]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color="#db2777" roughness={0.8} />
        </mesh>
      ))}
      {/* head */}
      <group ref={(g) => { rig.current.head = g; }} position={[0, 1.32, 0]}>
        <mesh>
          <sphereGeometry args={[0.44, 24, 24]} />
          <meshStandardMaterial color="#ec4899" roughness={0.8} />
        </mesh>
        {/* ears */}
        <mesh position={[-0.26, 0.36, 0]} rotation-z={0.2}>
          <coneGeometry args={[0.15, 0.3, 12]} />
          <meshStandardMaterial color="#ec4899" roughness={0.8} />
        </mesh>
        <mesh position={[-0.26, 0.34, 0.05]} rotation-z={0.2}>
          <coneGeometry args={[0.07, 0.16, 10]} />
          <meshStandardMaterial color="#fbcfe8" roughness={0.85} />
        </mesh>
        <mesh position={[0.26, 0.36, 0]} rotation-z={-0.2}>
          <coneGeometry args={[0.15, 0.3, 12]} />
          <meshStandardMaterial color="#ec4899" roughness={0.8} />
        </mesh>
        <mesh position={[0.26, 0.34, 0.05]} rotation-z={-0.2}>
          <coneGeometry args={[0.07, 0.16, 10]} />
          <meshStandardMaterial color="#fbcfe8" roughness={0.85} />
        </mesh>
        {/* nose */}
        <mesh position={[0, -0.1, 0.42]} rotation-x={Math.PI / 2}>
          <coneGeometry args={[0.045, 0.08, 8]} />
          <meshStandardMaterial color="#f472b6" roughness={0.5} />
        </mesh>
        {/* whiskers */}
        {[-1, 1].map((s) =>
          [0.06, 0, -0.06].map((y) => (
            <mesh key={`${s}-${y}`} position={[s * 0.3, y, 0.32]} rotation-z={s * 0.15}>
              <boxGeometry args={[0.24, 0.012, 0.012]} />
              <meshStandardMaterial color="#fdf2f8" roughness={0.6} />
            </mesh>
          ))
        )}
        <Eyes y={0.06} z={0.38} spacing={0.18} size={0.11} dark="#500724" rig={rig} />
      </group>
    </group>
  );
}

function PhoenixPet({ rig }: ModelProps) {
  return (
    <group>
      {/* tail plume */}
      <group ref={(g) => { rig.current.tail = g; }} position={[0, 0.7, -0.55]}>
        <mesh rotation-z={0.5} position={[-0.16, -0.28, -0.1]}>
          <coneGeometry args={[0.1, 0.6, 10]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.6} emissive="#f97316" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, -0.34, -0.05]}>
          <coneGeometry args={[0.12, 0.72, 10]} />
          <meshStandardMaterial color="#f97316" roughness={0.6} emissive="#f97316" emissiveIntensity={0.35} />
        </mesh>
        <mesh rotation-z={-0.5} position={[0.16, -0.28, -0.1]}>
          <coneGeometry args={[0.1, 0.6, 10]} />
          <meshStandardMaterial color="#ef4444" roughness={0.6} emissive="#ef4444" emissiveIntensity={0.3} />
        </mesh>
      </group>
      {/* wings */}
      <group ref={(g) => { rig.current.wingsL = g; }} position={[-0.78, 1.05, -0.12]}>
        <mesh scale={[1.2, 0.55, 0.1]} rotation-y={0.25}>
          <sphereGeometry args={[0.55, 16, 16]} />
          <meshStandardMaterial color="#ef4444" roughness={0.5} emissive="#f97316" emissiveIntensity={0.3} />
        </mesh>
      </group>
      <group ref={(g) => { rig.current.wingsR = g; }} position={[0.78, 1.05, -0.12]}>
        <mesh scale={[1.2, 0.55, 0.1]} rotation-y={-0.25}>
          <sphereGeometry args={[0.55, 16, 16]} />
          <meshStandardMaterial color="#ef4444" roughness={0.5} emissive="#f97316" emissiveIntensity={0.3} />
        </mesh>
      </group>
      {/* body */}
      <mesh position={[0, 0.6, 0]} scale={[0.92, 1.05, 0.95]}>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshStandardMaterial color="#f97316" roughness={0.55} emissive="#c2410c" emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0, 0.52, 0.32]} scale={[0.85, 1, 0.6]}>
        <sphereGeometry args={[0.34, 16, 16]} />
        <meshStandardMaterial color="#fde68a" roughness={0.7} />
      </mesh>
      {/* glow */}
      <pointLight position={[0, 0.9, 0.4]} intensity={1.1} distance={3.5} color="#fb923c" />
      {/* head */}
      <group ref={(g) => { rig.current.head = g; }} position={[0, 1.34, 0]}>
        <mesh>
          <sphereGeometry args={[0.36, 24, 24]} />
          <meshStandardMaterial color="#f97316" roughness={0.55} emissive="#c2410c" emissiveIntensity={0.18} />
        </mesh>
        {/* crest */}
        {[-0.12, 0, 0.12].map((x, i) => (
          <mesh key={x} position={[x, 0.36, -0.04 - i * 0.02]} rotation-z={-x * 1.4}>
            <coneGeometry args={[0.05, 0.24, 8]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.5} emissive="#f59e0b" emissiveIntensity={0.4} />
          </mesh>
        ))}
        <mesh position={[0, -0.12, 0.34]} rotation-x={Math.PI / 2}>
          <coneGeometry args={[0.06, 0.16, 10]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.4} />
        </mesh>
        <Eyes y={0.04} z={0.32} spacing={0.15} size={0.1} dark="#431407" rig={rig} />
      </group>
    </group>
  );
}

const MODELS: Record<string, (p: ModelProps) => ReactNode> = {
  owl: (p) => <OwlPet {...p} />,
  fox: (p) => <FoxPet {...p} />,
  dragon: (p) => <DragonPet {...p} />,
  robot: (p) => <RobotPet {...p} />,
  cat: (p) => <CatPet {...p} />,
  phoenix: (p) => <PhoenixPet {...p} />,
};

// ── accessories ─────────────────────────────────────────────────────────────

const HAT_TOP: Record<string, number> = { owl: 1.92, fox: 1.66, dragon: 1.78, robot: 1.62, cat: 1.7, phoenix: 1.68 };
const EYE_Y: Record<string, number> = { owl: 1.45, fox: 1.36, dragon: 1.44, robot: 1.34, cat: 1.38, phoenix: 1.38 };
const EYE_Z: Record<string, number> = { owl: 0.44, fox: 0.4, dragon: 0.42, robot: 0.31, cat: 0.4, phoenix: 0.36 };

function Hat({ itemId, topY }: { itemId: string; topY: number }) {
  const id = itemId.toLowerCase();
  if (id.includes("halo")) {
    return (
      <mesh position={[0, topY + 0.22, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.24, 0.035, 10, 32]} />
        <meshStandardMaterial color="#facc15" emissive="#eab308" emissiveIntensity={0.8} roughness={0.3} metalness={0.6} />
      </mesh>
    );
  }
  if (id.includes("crown")) {
    return (
      <mesh position={[0, topY + 0.1, 0]}>
        <cylinderGeometry args={[0.02, 0.26, 0.24, 6]} />
        <meshStandardMaterial color="#facc15" roughness={0.3} metalness={0.7} emissive="#ca8a04" emissiveIntensity={0.4} />
      </mesh>
    );
  }
  if (id.includes("santa")) {
    return (
      <group position={[0, topY, 0]}>
        <mesh position={[0, 0.14, 0]}>
          <coneGeometry args={[0.24, 0.4, 14]} />
          <meshStandardMaterial color="#dc2626" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.36, 0]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.8} />
        </mesh>
      </group>
    );
  }
  if (id.includes("witch")) {
    return (
      <mesh position={[0, topY + 0.2, 0]}>
        <coneGeometry args={[0.22, 0.5, 14]} />
        <meshStandardMaterial color="#4c1d95" roughness={0.6} />
      </mesh>
    );
  }
  if (id.includes("party")) {
    return (
      <group position={[0, topY, 0]} rotation-z={0.15}>
        <mesh position={[0, 0.14, 0]}>
          <coneGeometry args={[0.18, 0.36, 12]} />
          <meshStandardMaterial color="#ec4899" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.34, 0]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshStandardMaterial color="#facc15" roughness={0.4} />
        </mesh>
      </group>
    );
  }
  if (id.includes("grad")) {
    return (
      <group position={[0, topY + 0.08, 0]}>
        <mesh>
          <boxGeometry args={[0.5, 0.05, 0.5]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[0.2, 0.1, 0.2]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>
        <mesh position={[0.2, -0.06, 0.18]}>
          <cylinderGeometry args={[0.008, 0.008, 0.16, 6]} />
          <meshStandardMaterial color="#facc15" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    );
  }
  // default: top hat
  return (
    <group position={[0, topY, 0]}>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.14, 0.16, 0.3, 14]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.03, 16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>
    </group>
  );
}

function Accessories({ petType, accessories }: { petType: string; accessories: Array<{ itemId: string; slot: string }> }) {
  const hats = accessories.filter((a) => a.slot === "hat");
  const glasses = accessories.filter((a) => a.slot === "glasses");
  const backs = accessories.filter((a) => a.slot === "back");
  const wings = accessories.filter((a) => a.slot === "wings");
  const frames = accessories.filter((a) => a.slot === "frame");
  const bgs = accessories.filter((a) => a.slot === "bg");

  const topY = HAT_TOP[petType] ?? 1.6;
  const eyeY = EYE_Y[petType] ?? 1.4;
  const eyeZ = EYE_Z[petType] ?? 0.4;

  return (
    <group>
      {hats.map((a) => (
        <Hat key={a.itemId} itemId={a.itemId} topY={topY} />
      ))}
      {glasses.length > 0 && (
        <group position={[0, eyeY, eyeZ]}>
          {[-0.19, 0.19].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <torusGeometry args={[0.15, 0.025, 8, 24]} />
              <meshStandardMaterial color="#1e293b" roughness={0.35} metalness={0.5} />
            </mesh>
          ))}
          <mesh>
            <boxGeometry args={[0.1, 0.03, 0.02]} />
            <meshStandardMaterial color="#1e293b" roughness={0.35} metalness={0.5} />
          </mesh>
        </group>
      )}
      {backs.map((a) => {
        const id = a.itemId.toLowerCase();
        if (id.includes("scarf")) {
          return (
            <mesh key={a.itemId} position={[0, 1.0, 0]} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.34, 0.09, 10, 24]} />
              <meshStandardMaterial color="#ef4444" roughness={0.85} />
            </mesh>
          );
        }
        if (id.includes("hoodie")) {
          return (
            <mesh key={a.itemId} position={[0, 1.18, -0.3]} rotation-x={0.5}>
              <torusGeometry args={[0.3, 0.14, 10, 20]} />
              <meshStandardMaterial color="#64748b" roughness={0.9} />
            </mesh>
          );
        }
        // cape
        return (
          <mesh key={a.itemId} position={[0, 0.75, -0.42]} rotation-x={0.18}>
            <planeGeometry args={[1.15, 1.35]} />
            <meshStandardMaterial color="#7c3aed" roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
      {wings.length > 0 && (
        <group position={[0, 1.05, -0.35]}>
          <mesh position={[-0.8, 0, 0]} scale={[1.15, 0.55, 0.1]}>
            <sphereGeometry args={[0.55, 16, 16]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.35} emissive="#94a3b8" emissiveIntensity={0.25} transparent opacity={0.92} />
          </mesh>
          <mesh position={[0.8, 0, 0]} scale={[1.15, 0.55, 0.1]}>
            <sphereGeometry args={[0.55, 16, 16]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.35} emissive="#94a3b8" emissiveIntensity={0.25} transparent opacity={0.92} />
          </mesh>
        </group>
      )}
      {frames.map((a) => (
        <mesh key={a.itemId} position={[0, 0.78, 0]}>
          <torusGeometry args={[1.12, 0.028, 8, 48]} />
          <meshStandardMaterial color="#a78bfa" emissive="#8b5cf6" emissiveIntensity={0.9} roughness={0.3} />
        </mesh>
      ))}
      {bgs.map((a) => (
        <mesh key={a.itemId} position={[0, 0.9, -1.7]}>
          <circleGeometry args={[2.1, 40]} />
          <meshBasicMaterial color={a.itemId.includes("lightning") ? "#facc15" : a.itemId.includes("aurora") ? "#06d6a0" : "#8b5cf6"} transparent opacity={0.14} />
        </mesh>
      ))}
    </group>
  );
}

// ── stage flourishes ────────────────────────────────────────────────────────

function StageFlourishes({ stage }: { stage: number }) {
  const gem = useRef<THREE.Mesh>(null);
  const aura = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (gem.current) {
      gem.current.position.y = 1.35 + Math.sin(t * 1.6) * 0.08;
      gem.current.rotation.y = t * 1.2;
    }
    if (aura.current) {
      aura.current.rotation.z = t * 0.5;
    }
  });
  if (stage < 2) return null;
  return (
    <group>
      {stage >= 2 && (
        <mesh ref={gem} position={[1.15, 1.35, 0.2]}>
          <octahedronGeometry args={[0.14, 0]} />
          <meshStandardMaterial color="#a78bfa" emissive="#8b5cf6" emissiveIntensity={1.2} roughness={0.2} />
        </mesh>
      )}
      {stage >= 3 && (
        <mesh ref={aura} position={[0, 0.75, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[1.45, 0.025, 8, 64]} />
          <meshStandardMaterial color="#c4b5fd" emissive="#8b5cf6" emissiveIntensity={1.6} roughness={0.2} transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
}

// ── scene ───────────────────────────────────────────────────────────────────

function PetScene({ petType, mood, stage, accessories }: {
  petType: string;
  mood: string;
  stage: number;
  accessories: Array<{ itemId: string; slot: string }>;
}) {
  const rig = useRef<Rig>({ eyes: null, head: null, wingsL: null, wingsR: null, tail: null });
  const pet = useRef<THREE.Group>(null);
  const blink = useRef({ next: 2.5, until: 0 });
  const { camera } = useThree();
  const stageClamped = Math.min(3, Math.max(0, Math.floor(stage)));
  const model = MODELS[petType] ?? MODELS.owl;

  // Gentle orbiting camera so the pet is never fully static.
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const m = MOODS[mood as MoodName] ?? MOODS.happy;

    if (pet.current) {
      pet.current.position.y = Math.sin(t * m.speed) * m.amp;
      pet.current.rotation.y = Math.sin(t * 0.4) * 0.07;
    }
    if (rig.current.head) {
      rig.current.head.rotation.z += (m.headTilt - rig.current.head.rotation.z) * 0.08;
      rig.current.head.rotation.x += (m.headNod - rig.current.head.rotation.x) * 0.08;
    }
    // blink
    const b = blink.current;
    if (t > b.next) {
      b.until = t + 0.14;
      b.next = t + 2.4 + Math.random() * 3;
    }
    if (rig.current.eyes) {
      const target = t < b.until ? 0.12 : m.eyeScale;
      rig.current.eyes.scale.y += (target - rig.current.eyes.scale.y) * 0.5;
    }
    // wings
    const flap = Math.sin(t * m.flapSpeed) * m.flap;
    if (rig.current.wingsL) rig.current.wingsL.rotation.z += (flap - rig.current.wingsL.rotation.z) * 0.3;
    if (rig.current.wingsR) rig.current.wingsR.rotation.z += (-flap - rig.current.wingsR.rotation.z) * 0.3;
    // tail
    if (rig.current.tail) rig.current.tail.rotation.x = Math.sin(t * 2.2) * 0.12;

    // slow camera drift
    camera.position.x = Math.sin(t * 0.12) * 0.35;
    camera.lookAt(0, 0.9, 0);
  });

  return (
    <group>
      <ambientLight intensity={0.65} />
      <directionalLight position={[3, 5, 2]} intensity={1.25} />
      <pointLight position={[-3, 2, -2]} intensity={0.6} color="#a78bfa" />
      <BlobShadow scale={STAGE_SCALE[stageClamped]} />
      <group ref={pet} scale={STAGE_SCALE[stageClamped]}>
        {model({ rig, stage: stageClamped })}
        <Accessories petType={petType} accessories={accessories} />
      </group>
      <group scale={STAGE_SCALE[stageClamped]}>
        <StageFlourishes stage={stageClamped} />
      </group>
    </group>
  );
}

// ── public component ────────────────────────────────────────────────────────

export type Pet3DProps = {
  petType: string;
  mood?: string;
  evolutionStage?: number;
  accessories?: Array<{ itemId: string; slot: string }>;
  /** Called once if the WebGL context crashes at runtime (parent should fall back to 2D). */
  onCrash?: () => void;
};

export function Pet3D({ petType, mood = "happy", evolutionStage = 0, accessories = [], onCrash }: Pet3DProps) {
  const scene = useMemo(
    () => (
      <PetScene
        petType={petType}
        mood={mood}
        stage={evolutionStage}
        accessories={accessories}
      />
    ),
    [petType, mood, evolutionStage, accessories]
  );

  return (
    <Pet3DErrorBoundary onCrash={onCrash}>
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 1.5, 4.4], fov: 38 }} gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>{scene}</Suspense>
      </Canvas>
    </Pet3DErrorBoundary>
  );
}

export default Pet3D;
