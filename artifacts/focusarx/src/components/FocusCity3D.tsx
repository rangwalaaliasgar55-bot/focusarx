import { resolveColorToken } from "@/lib/color-tokens";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo, Suspense } from "react";
import * as THREE from "three";
import { OrbitControls, PerspectiveCamera, Text, Float, Environment, ContactShadows } from "@react-three/drei";

const BUILDINGS_CONFIG = [
  { id: "hut", name: "Study Hut", xp: 0, color: resolveColorToken("--brand-400"), emoji: "🏠", height: 1 },
  { id: "library", name: "Library", xp: 500, color: resolveColorToken("--info"), emoji: "📚", height: 2 },
  { id: "cafe", name: "Focus Cafe", xp: 2000, color: resolveColorToken("--palette-fcd34d"), emoji: "☕", height: 1.5 },
  { id: "gym", name: "Mind Gym", xp: 5000, color: resolveColorToken("--success"), emoji: "⚡", height: 2.5 },
  { id: "academy", name: "Academy", xp: 10000, color: resolveColorToken("--brand-pink"), emoji: "🏛️", height: 3 },
  { id: "tower", name: "Clock Tower", xp: 25000, color: resolveColorToken("--palette-fb923c"), emoji: "🕰️", height: 4 },
  { id: "observatory", name: "Observatory", xp: 100000, color: resolveColorToken("--palette-818cf8"), emoji: "🔭", height: 3.5 },
];

function Building({ config, position, unlocked }: { config: any, position: [number, number, number], unlocked: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!);

  return (
    <group position={position}>
      <Float speed={unlocked ? 1.5 : 0} rotationIntensity={0.2} floatIntensity={0.5}>
        <mesh ref={meshRef}>
          <boxGeometry args={[1, config.height, 1]} />
          <meshStandardMaterial
            color={unlocked ? config.color : resolveColorToken("--palette-2a2a3a")}
            metalness={0.6}
            roughness={0.2}
            transparent
            opacity={unlocked ? 0.9 : 0.4}
            emissive={unlocked ? config.color : resolveColorToken("--neutral-950")}
            emissiveIntensity={unlocked ? 0.2 : 0}
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

function CityScene({ totalXp }: { totalXp: number }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[8, 8, 8]} fov={40} />
      <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
      <ambientLight intensity={0.7} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <Environment preset="night" />

      <group position={[0, -1, 0]}>
        {/* Ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color={resolveColorToken("--palette-0a0f1e")} roughness={0.8} />
        </mesh>

        <gridHelper args={[20, 20, resolveColorToken("--palette-1a2e1a"), resolveColorToken("--palette-111")]} position={[0, 0.01, 0]} />

        {BUILDINGS_CONFIG.map((b, i) => {
          const angle = (i / BUILDINGS_CONFIG.length) * Math.PI * 2;
          const radius = 5;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const unlocked = totalXp >= b.xp;
          return (
            <Building
              key={b.id}
              config={b}
              position={[x, b.height / 2, z]}
              unlocked={unlocked}
            />
          );
        })}
      </group>

      <ContactShadows opacity={0.4} scale={20} blur={2.4} far={4.5} />
    </>
  );
}

export default function FocusCity3D({ totalXp, className }: { totalXp: number, className?: string }) {
  return (
    <div className={`h-full w-full ${className}`}>
      <Canvas shadows>
        <Suspense fallback={null}>
          <CityScene totalXp={totalXp} />
        </Suspense>
      </Canvas>
    </div>
  );
}
