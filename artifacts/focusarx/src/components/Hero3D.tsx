import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo, Suspense, useState, useEffect } from "react";
import * as THREE from "three";
import { Float, MeshDistortMaterial, Sphere, PerspectiveCamera } from "@react-three/drei";

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

function GeometricHero() {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.1;
    groupRef.current.rotation.z = t * 0.05;
  });

  return (
    <group ref={groupRef}>
      <Float speed={2} rotationIntensity={1.5} floatIntensity={2}>
        <Sphere args={[1, 64, 64]} scale={1.8}>
          <MeshDistortMaterial
            color="#7C3AED"
            speed={3}
            distort={0.4}
            radius={1}
            emissive="#4F46E5"
            emissiveIntensity={0.5}
            metalness={0.8}
            roughness={0.2}
          />
        </Sphere>
      </Float>

      {[...Array(3)].map((_, i) => (
        <Float key={i} speed={1} rotationIntensity={2} floatIntensity={1} >
          <mesh position={[Math.sin(i) * 3, Math.cos(i) * 3, i - 1]}>
            <octahedronGeometry args={[0.5]} />
            <meshStandardMaterial color={i === 0 ? "#A78BFA" : i === 1 ? "#06D6A0" : "#EC4899"} wireframe />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

export default function Hero3D() {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglOk(canUseWebGL());
  }, []);

  if (webglOk === false) return (
    <div className="absolute inset-0 z-0 flex items-center justify-center opacity-20">
      <div className="h-[300px] w-[300px] rounded-full bg-gradient-to-r from-purple-500 to-blue-500 blur-3xl animate-pulse" />
    </div>
  );
  if (webglOk === null) return null;

  return (
    <div className="absolute inset-0 z-0 opacity-60">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 0, 8]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
        <Suspense fallback={null}>
          <GeometricHero />
        </Suspense>
      </Canvas>
    </div>
  );
}
