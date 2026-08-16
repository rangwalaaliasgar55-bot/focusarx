import { useFrame } from "@react-three/fiber";
import { useRef, Suspense } from "react";
import * as THREE from "three";
import { Float, ContactShadows, Environment } from "@react-three/drei";

function Plant({ stage }: { stage: number }) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.1;
  });

  return (
    <group ref={groupRef}>
      {/* Soil */}
      <mesh position={[0, -0.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.5, 32]} />
        <meshStandardMaterial color="#402905" roughness={1} />
      </mesh>

      {/* Trunk/Stem */}
      <mesh position={[0, stage * 0.5 - 0.5, 0]}>
        <cylinderGeometry args={[0.1 + stage * 0.05, 0.2 + stage * 0.05, 1 + stage * 1, 16]} />
        <meshStandardMaterial color={stage === 3 ? "#5D4037" : "#4ADE80"} />
      </mesh>

      {/* Leaves/Canopy */}
      {[...Array(stage + 1)].map((_, i) => (
        <Float key={i} speed={2} rotationIntensity={0.5} floatIntensity={0.5} >
          <mesh position={[0, i * 0.8 + 0.5, 0]}>
            <coneGeometry args={[0.5 + i * 0.5, 1, 16]} />
            <meshStandardMaterial color={["#4ADE80", "#22C55E", "#16A34A", "#15803D"][i % 4]} />
          </mesh>
        </Float>
      ))}

      {/* Flower (Stage 2+) */}
      {stage >= 2 && (
        <mesh position={[0, stage * 0.8 + 1.2, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#F472B6" emissive="#F472B6" emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  );
}

import { Canvas } from "@react-three/fiber";

export default function FocusGarden3D({ stage, className }: { stage: number, className?: string }) {
  return (
    <div className={`h-full w-full ${className}`}>
      <Canvas>
        <ambientLight intensity={0.8} />
        <pointLight position={[5, 5, 5]} intensity={1} />
        <Suspense fallback={null}>
          <Plant stage={stage} />
          <Environment preset="forest" />
          <ContactShadows opacity={0.4} scale={10} blur={2} far={4} />
        </Suspense>
      </Canvas>
    </div>
  );
}
