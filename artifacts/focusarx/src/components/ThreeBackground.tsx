import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useMemo, Suspense, useState, useEffect } from "react";
import { motion } from "framer-motion";
import * as THREE from "three";

/* ── WebGL availability check (runs once, synchronously) ── */
function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return !!ctx;
  } catch {
    return false;
  }
}

/* ── CSS-only fallback ── */
function CssFallbackBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} aria-hidden="true">
      <motion.div
        className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)", filter: "blur(60px)" }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 -right-40 h-[450px] w-[450px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(79,70,229,0.10) 0%, transparent 65%)", filter: "blur(70px)" }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />
      <motion.div
        className="absolute top-1/3 left-2/3 h-[300px] w-[300px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(6,214,160,0.07) 0%, transparent 65%)", filter: "blur(50px)" }}
        animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 6 }}
      />
      <motion.div
        className="absolute top-2/3 left-1/4 h-[200px] w-[200px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 65%)", filter: "blur(40px)" }}
        animate={{ scale: [1, 1.3, 1], rotate: [0, 180, 360] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

/* ── Three.js scene ── */
function ParticleField() {
  const meshRef = useRef<THREE.Points>(null!);
  const count = 280;

  const { positions, speeds, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 28;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
      speeds[i] = 0.002 + Math.random() * 0.004;
      sizes[i]  = Math.random() * 2.5 + 0.5;
    }
    return { positions, speeds, sizes };
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const pos = meshRef.current.geometry.attributes.position!.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += speeds[i]! * 0.18;
      pos[i * 3]     += Math.sin(t * speeds[i]! * 8 + i) * 0.003;
      if (pos[i * 3 + 1]! > 9) pos[i * 3 + 1] = -9;
    }
    meshRef.current.geometry.attributes.position!.needsUpdate = true;
    meshRef.current.rotation.y = t * 0.012;
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("size",     new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [positions, sizes]);

  return (
    <points ref={meshRef} geometry={geometry}>
      <pointsMaterial size={0.06} color="#7C3AED" transparent opacity={0.55} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function FloatingOrb({ position, color, scale }: { position: [number,number,number]; color: string; scale: number }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const offset  = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime() + offset;
    meshRef.current.position.y = position[1] + Math.sin(t * 0.35) * 0.6;
    meshRef.current.position.x = position[0] + Math.cos(t * 0.22) * 0.4;
    meshRef.current.rotation.z = t * 0.06;
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[scale, 16, 16]} />
      <meshStandardMaterial color={color} transparent opacity={0.09} roughness={0.2} metalness={0.7} emissive={color} emissiveIntensity={0.4} />
    </mesh>
  );
}

function NebulaMesh() {
  const orbs = useMemo(() => [
    { position: [-6, 2, -3]   as [number,number,number], color: "#7C3AED", scale: 2.8 },
    { position: [7, -1.5, -4] as [number,number,number], color: "#4F46E5", scale: 2.2 },
    { position: [0, 3, -5]    as [number,number,number], color: "#A78BFA", scale: 1.8 },
    { position: [-3, -3, -2]  as [number,number,number], color: "#06D6A0", scale: 1.4 },
    { position: [5, 3.5, -3]  as [number,number,number], color: "#7C3AED", scale: 1.6 },
  ], []);
  return <>{orbs.map((orb, i) => <FloatingOrb key={i} {...orb} />)}</>;
}

function CameraRig() {
  const { camera } = useThree();
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    camera.position.x += (Math.sin(t * 0.08) * 0.3 - camera.position.x) * 0.015;
    camera.position.y += (Math.cos(t * 0.06) * 0.15 - camera.position.y) * 0.015;
  });
  return null;
}

/* ── Main export: sniff WebGL support first ── */
export default function ThreeBackground() {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglOk(canUseWebGL());
  }, []);

  if (webglOk === null) return null; // still checking
  if (!webglOk) return <CssFallbackBackground />;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 55 }}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
        dpr={[1, 1.5]}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <pointLight position={[5, 5, 5]}  intensity={0.8} color="#7C3AED" />
          <pointLight position={[-5, -3, 3]} intensity={0.5} color="#4F46E5" />
          <NebulaMesh />
          <ParticleField />
          <CameraRig />
        </Suspense>
      </Canvas>
    </div>
  );
}
