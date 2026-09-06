/**
 * ThreeBackground — Optimized with InstancedMesh for stars
 * 
 * Blueprint: Weeks 7-8 3D Gamification
 * Performance: InstancedMesh renders 2000+ stars in a single draw call
 * instead of individual mesh instances.
 */

import { resolveColorToken } from "@/lib/color-tokens";
import { use3DQuality } from "@/hooks/use3DQuality";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useFrame, useThree, Canvas } from "@react-three/fiber";
import { useRef, useMemo, Suspense, useState, useEffect } from "react";
import { motion } from "framer-motion";
import * as THREE from "three";

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

function CssFallbackBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} aria-hidden="true">
      <motion.div
        className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full"
        style={{ background: "radial-gradient(circle, var(--rgba-124-58-237-0_15) 0%, transparent 70%)", filter: "blur(80px)" }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full"
        style={{ background: "radial-gradient(circle, var(--rgba-79-70-229-0_12) 0%, transparent 70%)", filter: "blur(90px)" }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
    </div>
  );
}

/**
 * InstancedMesh Stars — Single draw call for all stars
 * Performance: ~10x faster than individual meshes
 */
function InstancedStars({ count = 1200, reducedMotion = false }: { count?: number; reducedMotion?: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Generate star positions once
  const { positions, colors } = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const colors: THREE.Color[] = [];
    const colorOptions = [
      new THREE.Color(resolveColorToken("--brand-600")),
      new THREE.Color(resolveColorToken("--brand-400")),
      new THREE.Color(resolveColorToken("--neutral-0")),
      new THREE.Color(resolveColorToken("--palette-4f46e5")),
    ];

    for (let i = 0; i < count; i++) {
      const r = 25 + Math.random() * 25;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions.push(new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      ));

      colors.push(colorOptions[Math.floor(Math.random() * colorOptions.length)]!);
    }
    return { positions, colors };
  }, [count]);

  // Set up instances
  useEffect(() => {
    if (!meshRef.current) return;
    
    positions.forEach((pos, i) => {
      dummy.position.copy(pos);
      dummy.scale.setScalar(0.08 + Math.random() * 0.08);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, colors[i]!);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [positions, colors, dummy]);

  // Animate rotation
  useFrame((state) => {
    if (reducedMotion || !meshRef.current) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.rotation.y = t * 0.015;
    meshRef.current.rotation.x = t * 0.005;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
}

function NebulaCloud({ position, color, scale }: { position: [number, number, number]; color: string; scale: number }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const seed = useMemo(() => Math.random() * 100, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime() + seed;
    meshRef.current.rotation.x = Math.sin(t * 0.1) * 0.2;
    meshRef.current.rotation.y = Math.cos(t * 0.15) * 0.2;
    meshRef.current.position.y = position[1] + Math.sin(t * 0.2) * 0.5;
  });

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.08}
        roughness={1}
        metalness={0}
        emissive={color}
        emissiveIntensity={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** A distant ringed planet that slowly drifts */
function RingedPlanet({ position, color, size }: { position: [number, number, number]; color: string; size: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.02;
    if (ringRef.current) ringRef.current.rotation.z = Math.sin(t * 0.08) * 0.05;
  });

  return (
    <group ref={groupRef} position={position} scale={size}>
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0.1} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2.3, 0, 0]}>
        <torusGeometry args={[1.7, 0.28, 8, 64]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.3} emissive={color} emissiveIntensity={0.3} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function SceneContent({ isFocusing = false, reducedMotion = false }: { isFocusing?: boolean; reducedMotion?: boolean }) {
  const { mouse, camera } = useThree();
  const targetCameraPos = useRef(new THREE.Vector3(0, 0, 15));

  useFrame(() => {
    if (reducedMotion) return;
    const targetZ = isFocusing ? 12 : 15;
    const lerpFactor = isFocusing ? 0.02 : 0.05;

    targetCameraPos.current.x = mouse.x * (isFocusing ? 0.5 : 2);
    targetCameraPos.current.y = mouse.y * (isFocusing ? 0.5 : 2);
    targetCameraPos.current.z = targetZ;

    camera.position.lerp(targetCameraPos.current, lerpFactor);
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <ambientLight intensity={isFocusing ? 0.2 : 0.4} />
      <pointLight position={[10, 10, 10]} intensity={isFocusing ? 2 : 1.5} color={resolveColorToken("--brand-600")} />
      <pointLight position={[-10, -10, -10]} intensity={1} color={resolveColorToken("--palette-4f46e5")} />
      <InstancedStars count={isFocusing ? 2500 : 1500} reducedMotion={reducedMotion} />
      <NebulaCloud position={[-8, 4, -10]} color={resolveColorToken("--brand-600")} scale={isFocusing ? 7 : 6} />
      <NebulaCloud position={[8, -4, -12]} color={resolveColorToken("--palette-4f46e5")} scale={isFocusing ? 9 : 8} />
      <RingedPlanet position={[14, 5, -18]} color={resolveColorToken("--color-info")} size={isFocusing ? 3.4 : 3} />
      <RingedPlanet position={[-16, -6, -20]} color={resolveColorToken("--brand-teal")} size={isFocusing ? 2.6 : 2.2} />
    </>
  );
}

export default function ThreeBackground({ isFocusing }: { isFocusing?: boolean }) {
  const [webglOk] = useState<boolean>(() => (typeof window === "undefined" ? false : canUseWebGL()));
  const reducedMotion = useReducedMotion();
  const { isBattery } = use3DQuality();

  if (!webglOk) return <CssFallbackBackground />;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 15], fov: 60 }}
        gl={{ antialias: false, alpha: true, powerPreference: isBattery ? "default" : "high-performance" }}
        dpr={isBattery ? [1, 1.2] : [1, 1.5]}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <Suspense fallback={null}>
          <SceneContent isFocusing={isFocusing} reducedMotion={reducedMotion} />
        </Suspense>
      </Canvas>
      <div className="absolute inset-0 bg-[var(--background)]/40 pointer-events-none transition-opacity duration-[var(--duration-slow)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,var(--rgba-3-3-8-0_4)_100%)] pointer-events-none" />
    </div>
  );
}
