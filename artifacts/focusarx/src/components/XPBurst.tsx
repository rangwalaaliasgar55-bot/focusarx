import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  label: string;
  color: string;
  size: number;
}

interface XPBurstProps {
  active: boolean;
  earnedXp: number;
  earnedCoins: number;
  originRef?: React.RefObject<HTMLElement | null>;
}

export function XPBurst({ active, earnedXp, earnedCoins, originRef }: XPBurstProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || (earnedXp === 0 && earnedCoins === 0)) return;

    const cx = originRef?.current
      ? originRef.current.getBoundingClientRect().left + originRef.current.offsetWidth / 2
      : window.innerWidth / 2;
    const cy = originRef?.current
      ? originRef.current.getBoundingClientRect().top + originRef.current.offsetHeight / 2
      : window.innerHeight * 0.4;

    const newParticles: Particle[] = [];
    let id = 0;

    // XP label particles
    if (earnedXp > 0) {
      const count = Math.min(8, Math.max(4, Math.floor(earnedXp / 10)));
      for (let i = 0; i < count; i++) {
        const angle = ((2 * Math.PI) / count) * i - Math.PI / 2;
        const speed = 2.5 + Math.random() * 2.5;
        newParticles.push({
          id: id++,
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          label: i === 0 ? `+${earnedXp} XP` : "✦",
          color: i === 0 ? "var(--brand-400)" : "var(--brand-600)",
          size: i === 0 ? 14 : 10,
        });
      }
    }

    // Coin label particles
    if (earnedCoins > 0) {
      const count = Math.min(6, Math.max(3, Math.floor(earnedCoins / 10)));
      for (let i = 0; i < count; i++) {
        const angle = ((2 * Math.PI) / count) * i - Math.PI / 2 + 0.5;
        const speed = 2 + Math.random() * 2;
        newParticles.push({
          id: id++,
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.2,
          label: i === 0 ? `+${earnedCoins} 🪙` : "◆",
          color: i === 0 ? "var(--warning)" : "var(--color-warning)",
          size: i === 0 ? 14 : 9,
        });
      }
    }

    // Extra sparkle dots
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.3;
      const speed = 3 + Math.random() * 3;
      newParticles.push({
        id: id++,
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        label: ["✦", "✧", "⬡", "★"][Math.floor(Math.random() * 4)]!,
        color: ["var(--brand-600)", "var(--brand-400)", "var(--warning)", "var(--brand-teal)", "var(--info)"][Math.floor(Math.random() * 5)]!,
        size: 8 + Math.random() * 6,
      });
    }

    // Particles depend on a DOM measurement (origin element), so they are
    // committed on the next frame rather than synchronously in the effect.
    const raf = requestAnimationFrame(() => setParticles(newParticles));
    const timer = setTimeout(() => setParticles([]), 1800);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [active]);

  if (particles.length === 0) return null;

  return (
    <div ref={containerRef} className="pointer-events-none fixed inset-0 z-[var(--z-modal)] overflow-hidden">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{
              x: p.x,
              y: p.y,
              opacity: 1,
              scale: 0.5,
            }}
            animate={{
              x: p.x + p.vx * 120,
              y: p.y + p.vy * 80,
              opacity: 0,
              scale: 1.2,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 1.2 + Math.random() * 0.6,
              ease: [0.2, 0, 0.8, 1],
            }}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              color: p.color,
              fontSize: p.size,
              fontWeight: 700,
              textShadow: `0 0 12px color-mix(in srgb, ${p.color} 53%, transparent)`,
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
          >
            {p.label}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
