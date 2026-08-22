import { resolveColorToken } from "@/lib/color-tokens";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo, Suspense, useState, useEffect } from "react";
import * as THREE from "three";
import { Float, MeshDistortMaterial, Sphere, PerspectiveCamera, Stars } from "@react-three/drei";

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

const ORBITER_COLORS = [resolveColorToken("--brand-400"), resolveColorToken("--brand-teal"), resolveColorToken("--palette-ec4899"), resolveColorToken("--color-warning"), resolveColorToken("--palette-38bdf8")];

/**
 * A "planet" focal object — a distorted, glowing core wrapped in an orbital
 * ring with a small system of satellites. Mouse movement parallaxes the whole
 * assembly for an immersive, game-like feel.
 */
function GeometricHero() {
  const groupRef = useRef<THREE.Group>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const orbiters = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const { pointer } = state;

    // Slow, continuous rotation.
    groupRef.current.rotation.y = t * 0.12;
    // Mouse-driven tilt (parallax) with smooth interpolation.
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, pointer.y * 0.35, 0.05);
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, pointer.x * 0.15, 0.05);

    // Breathing ring wobble.
    if (ringRef.current) {
      ringRef.current.rotation.z = Math.sin(t * 0.22) * 0.16;
      ringRef.current.rotation.y = t * 0.06;
    }

    // Orbiting satellites.
    orbiters.current.forEach((m, i) => {
      if (!m) return;
      const a = t * (0.45 + i * 0.11) + i * 2.09;
      const radius = 2.9 + (i % 2) * 0.6;
      m.position.set(Math.cos(a) * radius, Math.sin(a * 0.85) * 1.35, Math.sin(a) * radius);
      m.rotation.x = t * 0.6;
      m.rotation.y = t * 0.9;
    });
  });

  return (
    <group ref={groupRef}>
      <Float speed={2} rotationIntensity={1.5} floatIntensity={2}>
        <Sphere args={[1, 96, 96]} scale={1.65}>
          <MeshDistortMaterial
            color={resolveColorToken("--brand-600")}
            speed={2.4}
            distort={0.42}
            radius={1}
            emissive={resolveColorToken("--palette-4f46e5")}
            emissiveIntensity={0.55}
            metalness={0.85}
            roughness={0.18}
          />
        </Sphere>
      </Float>

      {/* Orbital ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2.15, 0, 0]}>
        <torusGeometry args={[2.55, 0.05, 16, 160]} />
        <meshStandardMaterial
          color={resolveColorToken("--brand-400")}
          emissive={resolveColorToken("--brand-600")}
          emissiveIntensity={0.9}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>

      {/* Secondary halo ring */}
      <mesh rotation={[Math.PI / 1.9, 0.4, 0]}>
        <torusGeometry args={[3.05, 0.015, 12, 160]} />
        <meshBasicMaterial color={resolveColorToken("--palette-e879f9")} transparent opacity={0.55} />
      </mesh>

      {/* Orbiting satellites */}
      {[...Array(5)].map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            orbiters.current[i] = el;
          }}
        >
          <octahedronGeometry args={[0.2]} />
          <meshStandardMaterial
            color={ORBITER_COLORS[i % ORBITER_COLORS.length]}
            emissive={ORBITER_COLORS[i % ORBITER_COLORS.length]}
            emissiveIntensity={0.5}
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function Hero3D() {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglOk(canUseWebGL());
  }, []);

  if (webglOk === false) {
    return (
      <div className="absolute inset-0 z-[var(--z-base)] flex items-center justify-center opacity-20">
        <div className="h-[300px] w-[300px] rounded-full bg-gradient-to-r from-[var(--palette-purple-500)] to-[var(--palette-blue-500)] blur-3xl animate-pulse" />
      </div>
    );
  }
  if (webglOk === null) return null;

  return (
    <div className="absolute inset-0 z-[var(--z-base)] opacity-70">
      <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}>
        <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={50} />
        <ambientLight intensity={0.45} />
        <pointLight position={[10, 10, 10]} intensity={1.2} color={resolveColorToken("--brand-600")} />
        <spotLight position={[-10, 8, 10]} angle={0.2} penumbra={1} intensity={1.4} color={resolveColorToken("--palette-e879f9")} />
        <pointLight position={[0, -8, -6]} intensity={0.6} color={resolveColorToken("--brand-teal")} />
        <Suspense fallback={null}>
          <Stars radius={80} depth={40} count={1800} factor={3.5} saturation={0.2} fade speed={0.6} />
          <GeometricHero />
        </Suspense>
      </Canvas>
    </div>
  );
}
