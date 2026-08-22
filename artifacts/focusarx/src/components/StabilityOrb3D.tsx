import { resolveColorToken } from "@/lib/color-tokens";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo, Suspense } from "react";
import * as THREE from "three";
import { MeshDistortMaterial, Sphere, Float } from "@react-three/drei";

function StabilityOrb({ stability }: { stability: number }) {
  const meshRef = useRef<THREE.Mesh>(null!);

  // Stability ranges from 0 to 100
  // Higher stability = less distortion, more calm color
  const color = useMemo(() => {
    if (stability > 80) return resolveColorToken("--palette-10b981"); // Stable - Green
    if (stability > 50) return resolveColorToken("--brand-600"); // Moderate - Purple
    return resolveColorToken("--color-error"); // Unstable - Red
  }, [stability]);

  const distort = useMemo(() => (100 - stability) / 150, [stability]);
  const speed = useMemo(() => (100 - stability) / 20 + 2, [stability]);

  return (
    <Float speed={speed} rotationIntensity={0.5} floatIntensity={0.5}>
      <Sphere args={[1, 64, 64]} scale={2}>
        <MeshDistortMaterial
          color={color}
          speed={speed}
          distort={distort}
          radius={1}
          metalness={0.8}
          roughness={0.2}
          emissive={color}
          emissiveIntensity={0.5}
        />
      </Sphere>
    </Float>
  );
}

export default function StabilityOrb3D({ stability }: { stability: number }) {
  return (
    <div className="h-40 w-40">
      <Canvas>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <Suspense fallback={null}>
          <StabilityOrb stability={stability} />
        </Suspense>
      </Canvas>
    </div>
  );
}
