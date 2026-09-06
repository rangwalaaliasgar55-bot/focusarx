/**
 * Monster Battle Arena - 3D Pet vs Monster Combat System
 * 
 * Blueprint: Weeks 7-8 3D Gamification
 * 
 * When user starts a focus session, a monster appears.
 * If user completes the session: Pet wins, monster defeated, pet grows stronger
 * If user abandons/fails: Monster wins, pet loses HP
 * 
 * Visual: 3D arena with pet on left, monster on right, health bars, battle effects
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import { Heart, Sword, Zap, Award, X } from "lucide-react";

interface BattleState {
  petHp: number;
  petMaxHp: number;
  monsterHp: number;
  monsterMaxHp: number;
  sessionProgress: number; // 0-100%
  battleActive: boolean;
  outcome: "none" | "victory" | "defeat";
  petLevel: number;
  monsterLevel: number;
}

interface MonsterBattleArenaProps {
  sessionDuration: number; // in seconds
  sessionProgress: number; // 0-100
  isActive: boolean;
  petLevel?: number;
  onComplete?: (outcome: "victory" | "defeat") => void;
}

/**
 * 3D Pet Character - Grows with level
 */
function PetCharacter({ level, hp, maxHp, isAttacking }: { level: number; hp: number; maxHp: number; isAttacking: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);
  const scale = 1 + (level - 1) * 0.1; // Pet grows 10% per level
  
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    
    // Idle animation
    groupRef.current.position.y = Math.sin(t * 2) * 0.1;
    groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.1;
    
    // Attack animation
    if (isAttacking) {
      groupRef.current.position.x = Math.sin(t * 20) * 0.3;
    }
  });

  return (
    <group ref={groupRef} position={[-2.5, 0, 0]} scale={scale}>
      {/* Body */}
      <mesh>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshStandardMaterial color="#7c3aed" metalness={0.3} roughness={0.4} />
      </mesh>
      
      {/* Eyes */}
      <mesh position={[-0.25, 0.3, 0.6]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.25, 0.3, 0.6]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      
      {/* Pupils */}
      <mesh position={[-0.25, 0.3, 0.7]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      <mesh position={[0.25, 0.3, 0.7]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      
      {/* Aura based on HP */}
      <mesh>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshBasicMaterial 
          color={hp / maxHp > 0.5 ? "#10b981" : hp / maxHp > 0.25 ? "#f59e0b" : "#ef4444"}
          transparent 
          opacity={0.2}
        />
      </mesh>
    </group>
  );
}

/**
 * 3D Monster Character
 */
function MonsterCharacter({ level, hp, maxHp, isAttacking }: { level: number; hp: number; maxHp: number; isAttacking: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);
  
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    
    // Menacing idle
    groupRef.current.position.y = Math.sin(t * 1.5) * 0.15;
    groupRef.current.rotation.y = Math.PI + Math.sin(t * 0.3) * 0.2;
    
    // Attack animation
    if (isAttacking) {
      groupRef.current.position.x = Math.sin(t * 18) * 0.4;
    }
  });

  return (
    <group ref={groupRef} position={[2.5, 0, 0]} scale={1 + level * 0.15}>
      {/* Body - Angular/dangerous shape */}
      <mesh rotation={[0, 0, Math.PI / 6]}>
        <coneGeometry args={[0.7, 1.4, 6]} />
        <meshStandardMaterial color="#ef4444" metalness={0.5} roughness={0.3} />
      </mesh>
      
      {/* Spikes */}
      <mesh position={[0, 0.8, 0]}>
        <coneGeometry args={[0.2, 0.5, 4]} />
        <meshStandardMaterial color="#991b1b" />
      </mesh>
      <mesh position={[-0.5, 0.5, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <coneGeometry args={[0.15, 0.4, 4]} />
        <meshStandardMaterial color="#991b1b" />
      </mesh>
      <mesh position={[0.5, 0.5, 0]} rotation={[0, 0, Math.PI / 4]}>
        <coneGeometry args={[0.15, 0.4, 4]} />
        <meshStandardMaterial color="#991b1b" />
      </mesh>
      
      {/* Evil eyes */}
      <mesh position={[-0.2, 0.2, 0.5]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.2, 0.2, 0.5]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} />
      </mesh>
      
      {/* Damage aura */}
      <mesh>
        <sphereGeometry args={[1.1, 16, 16]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={hp / maxHp * 0.3} />
      </mesh>
    </group>
  );
}

/**
 * Battle Arena Ground
 */
function ArenaGround() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#1e1b4b" metalness={0.2} roughness={0.8} />
    </mesh>
  );
}

/**
 * Battle Effects
 */
function BattleEffects({ active }: { active: boolean }) {
  const particlesRef = useRef<THREE.Points>(null!);
  
  useEffect(() => {
    if (!particlesRef.current || !active) return;
    const positions = new Float32Array(300);
    for (let i = 0; i < 300; i++) {
      positions[i] = (Math.random() - 0.5) * 10;
    }
    particlesRef.current.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  }, [active]);

  useFrame((state) => {
    if (!particlesRef.current || !active) return;
    const t = state.clock.getElapsedTime();
    particlesRef.current.rotation.y = t * 0.5;
  });

  if (!active) return null;

  return (
    <points ref={particlesRef}>
      <bufferGeometry />
      <pointsMaterial size={0.1} color="#fbbf24" transparent opacity={0.6} />
    </points>
  );
}

/**
 * Battle Scene
 */
function BattleScene({ battleState }: { battleState: BattleState }) {
  const { camera } = useThree();
  
  useFrame(() => {
    camera.position.lerp(new THREE.Vector3(0, 2, 8), 0.05);
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ef4444" />
      
      <ArenaGround />
      <PetCharacter 
        level={battleState.petLevel}
        hp={battleState.petHp}
        maxHp={battleState.petMaxHp}
        isAttacking={battleState.sessionProgress > 0 && battleState.sessionProgress < 100}
      />
      <MonsterCharacter 
        level={battleState.monsterLevel}
        hp={battleState.monsterHp}
        maxHp={battleState.monsterMaxHp}
        isAttacking={battleState.sessionProgress < 50}
      />
      <BattleEffects active={battleState.battleActive} />
    </>
  );
}

/**
 * Health Bar Component
 */
function HealthBar({ current, max, label, color }: { current: number; max: number; label: string; color: string }) {
  const percentage = (current / max) * 100;
  
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold" style={{ color }}>{label}</span>
        <span className="text-[var(--foreground-subtle)]">{Math.round(current)}/{max} HP</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--surface-1)] border border-[var(--forge-border)]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}dd)` }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default function MonsterBattleArena({
  sessionProgress,
  isActive,
  petLevel = 1,
  onComplete,
}: MonsterBattleArenaProps) {
  const [battleState, setBattleState] = useState<BattleState>({
    petHp: 100 + petLevel * 20,
    petMaxHp: 100 + petLevel * 20,
    monsterHp: 80 + petLevel * 15,
    monsterMaxHp: 80 + petLevel * 15,
    sessionProgress: 0,
    battleActive: false,
    outcome: "none",
    petLevel,
    monsterLevel: Math.max(1, petLevel - 1 + Math.floor(Math.random() * 3)),
  });

  const [showResult, setShowResult] = useState(false);

  /* Progress → HP and the victory transition: HP is a pure function of
     `sessionProgress` (a candidate for deriving instead of storing), while the
     outcome has to stay an effect because it calls `onComplete` into the parent.
     The rule sees both; only the second one is a real side effect. The HP half is
     tracked in REMAINING.md with the query-client migration. */
  /* eslint-disable react-hooks/set-state-in-effect -- see the note above */
  useEffect(() => {
    if (!isActive) return;

    setBattleState(prev => ({
      ...prev,
      sessionProgress,
      battleActive: true,
      // Pet takes damage as session progresses (represents effort)
      petHp: Math.max(0, prev.petMaxHp * (1 - sessionProgress / 200)),
      // Monster takes damage as session progresses (user's focus defeats it)
      monsterHp: Math.max(0, prev.monsterMaxHp * (1 - sessionProgress / 100)),
    }));

    // Victory condition
    if (sessionProgress >= 100) {
      setBattleState(prev => ({
        ...prev,
        outcome: "victory",
        battleActive: false,
      }));
      setShowResult(true);
      onComplete?.("victory");
    }
  }, [sessionProgress, isActive, onComplete]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* Defeat on abandon. Same story as the progress effect above: it notifies the
     parent, so it cannot be a render-time derivation. */
  /* eslint-disable react-hooks/set-state-in-effect -- see the note above */
  useEffect(() => {
    if (!isActive && battleState.battleActive && sessionProgress < 100) {
      setBattleState(prev => ({
        ...prev,
        outcome: "defeat",
        battleActive: false,
      }));
      setShowResult(true);
      onComplete?.("defeat");
    }
  }, [isActive, battleState.battleActive, sessionProgress, onComplete]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleClose = useCallback(() => {
    setShowResult(false);
  }, []);

  if (!isActive && !showResult) return null;

  return (
    <div className="w-full rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] overflow-hidden">
      {/* Battle Header */}
      <div className="flex items-center justify-between border-b border-[var(--forge-border)] bg-[var(--surface-1)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sword size={18} className="text-[var(--brand-400)]" />
          <h3 className="text-sm font-bold">Pet vs Monster Battle</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-[var(--brand-soft)] px-2 py-1 font-bold text-[var(--brand-400)]">
            Session {Math.round(sessionProgress)}%
          </span>
        </div>
      </div>

      {/* 3D Arena */}
      <div className="relative h-64 w-full">
        <Canvas camera={{ position: [0, 2, 8], fov: 50 }}>
          <Suspense fallback={null}>
            <BattleScene battleState={battleState} />
          </Suspense>
        </Canvas>

        {/* Health Bars Overlay */}
        <div className="absolute left-4 top-4 w-48">
          <HealthBar
            current={battleState.petHp}
            max={battleState.petMaxHp}
            label={`Your Pet (Lv.${battleState.petLevel})`}
            color="#10b981"
          />
        </div>
        <div className="absolute right-4 top-4 w-48">
          <HealthBar
            current={battleState.monsterHp}
            max={battleState.monsterMaxHp}
            label={`Monster (Lv.${battleState.monsterLevel})`}
            color="#ef4444"
          />
        </div>
      </div>

      {/* Battle Status */}
      <div className="border-t border-[var(--forge-border)] bg-[var(--surface-1)] px-4 py-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Heart size={14} className="text-[var(--brand-400)]" />
            <span className="text-[var(--foreground-subtle)]">
              {battleState.battleActive ? "Battle in progress..." : battleState.outcome === "victory" ? "Victory!" : battleState.outcome === "defeat" ? "Defeated!" : "Ready"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-[var(--palette-amber-400)]" />
            <span className="font-bold text-[var(--foreground)]">
              {battleState.battleActive ? "Keep focusing!" : battleState.outcome === "victory" ? "Monster defeated!" : "Session incomplete"}
            </span>
          </div>
        </div>
      </div>

      {/* Result Modal */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[var(--z-modal)] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={handleClose}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {battleState.outcome === "victory" ? (
                <>
                  <div className="text-center">
                    <Award size={48} className="mx-auto text-[var(--palette-amber-400)]" />
                    <h3 className="mt-4 text-2xl font-bold text-[var(--palette-amber-400)]">Victory!</h3>
                    <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                      Your pet defeated the monster! +50 Bond XP earned.
                    </p>
                    <div className="mt-4 rounded-xl bg-[var(--surface-1)] p-4">
                      <p className="text-xs text-[var(--foreground-subtle)]">Pet Level</p>
                      <p className="text-3xl font-bold text-[var(--brand-400)]">{battleState.petLevel}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center">
                    <X size={48} className="mx-auto text-[var(--danger)]" />
                    <h3 className="mt-4 text-2xl font-bold text-[var(--danger)]">Defeated</h3>
                    <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                      The monster won this time. Complete more sessions to grow stronger!
                    </p>
                    <div className="mt-4 rounded-xl bg-[var(--surface-1)] p-4">
                      <p className="text-xs text-[var(--foreground-subtle)]">Progress</p>
                      <p className="text-3xl font-bold text-[var(--foreground)]">{Math.round(sessionProgress)}%</p>
                    </div>
                  </div>
                </>
              )}
              <button
                onClick={handleClose}
                className="mt-6 w-full rounded-xl bg-[var(--brand-600)] py-3 text-sm font-bold text-white transition-all hover:bg-[var(--brand-700)]"
              >
                Continue
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
