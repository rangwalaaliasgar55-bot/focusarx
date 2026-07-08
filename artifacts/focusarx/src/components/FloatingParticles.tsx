import { useMemo } from "react";
import { motion } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  color: string;
}

const COLORS = [
  "rgba(124,58,237,0.6)",
  "rgba(167,139,250,0.5)",
  "rgba(79,70,229,0.5)",
  "rgba(6,214,160,0.4)",
  "rgba(255,184,0,0.35)",
];

export function FloatingParticles({ count = 18 }: { count?: number }) {
  const particles: Particle[] = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2.5,
      duration: 8 + Math.random() * 14,
      delay: Math.random() * -14,
      opacity: 0.3 + Math.random() * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
    })), [count]);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 1 }} aria-hidden>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          }}
          animate={{
            y: [0, -30, -60, -30, 0],
            x: [0, 10, -8, 12, 0],
            opacity: [0, p.opacity, p.opacity * 0.7, p.opacity, 0],
            scale: [0.8, 1.2, 1, 1.1, 0.8],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export function PageAmbientOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }} aria-hidden>
      <motion.div
        className="absolute -top-20 -left-20 h-72 w-72 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.07) 0%, transparent 70%)", filter: "blur(80px)" }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.25, 0.4, 0.25] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(6,214,160,0.05) 0%, transparent 70%)", filter: "blur(80px)" }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />
    </div>
  );
}
