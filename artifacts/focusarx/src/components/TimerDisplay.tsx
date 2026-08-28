
import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useRef, useState, useEffect } from "react";
import { formatTime } from "@/lib/timerUtils";
import type { TimerMode } from "@/types/timer";
import { colorWithAlpha, resolveColorToken } from "@/lib/color-tokens";

interface TimerDisplayProps {
  secondsLeft: number;
  progress: number;
  mode: TimerMode;
  isRunning: boolean;
  onEditClick?: () => void;
  sessionType?: string;
  activeSecondsEarned?: number;
}

const SIZE = 280;
const STROKE = 10;
const RADIUS = (SIZE - STROKE * 2) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const OUTER_SIZE = SIZE + 40;
const OUTER_STROKE = 2;
const OUTER_RADIUS = (OUTER_SIZE - OUTER_STROKE * 2) / 2;
const OUTER_CIRCUMFERENCE = 2 * Math.PI * OUTER_RADIUS;

const RING2_SIZE = SIZE + 68;
const RING2_STROKE = 1;
const RING2_RADIUS = (RING2_SIZE - RING2_STROKE * 2) / 2;

const MODE_CONFIG: Record<TimerMode, { label: string; icon: string; color: string; glow: string; gradient: [string, string]; particleColor: `--${string}` }> = {
  focus:     { label: "FOCUS",      icon: "⚔️", color: "var(--palette-f43f5e)", glow: "var(--rgba-244-63-94-0_6)",    gradient: ["var(--palette-f43f5e)", "var(--palette-ec4899)"], particleColor: "--palette-f43f5e" },
  break:     { label: "BREAK",      icon: "☕", color: "var(--color-success)", glow: "var(--rgba-34-197-94-0_6)",    gradient: ["var(--color-success)", "var(--palette-10b981)"], particleColor: "--color-success" },
  longBreak: { label: "LONG BREAK", icon: "🌙", color: "var(--brand-500)", glow: "var(--rgba-139-92-246-0_6)",   gradient: ["var(--brand-500)", "var(--palette-6366f1)"], particleColor: "--brand-500" },
};

/* ─── Energy Particle Canvas ────────────────────────────────────── */
function EnergyParticles({ color, active, size }: { color: `--${string}`; active: boolean; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    if (!active) { ctx.clearRect(0, 0, size, size); return; }

    const cx = size / 2, cy = size / 2;
    const resolvedColor = resolveColorToken(color);
    const particles: { angle: number; radius: number; speed: number; size: number; alpha: number; drift: number }[] = [];
    for (let i = 0; i < 22; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: (SIZE / 2) * (0.82 + Math.random() * 0.3),
        speed: (Math.random() - 0.5) * 0.012 + 0.008,
        size: Math.random() * 2.2 + 0.8,
        alpha: Math.random() * 0.7 + 0.3,
        drift: (Math.random() - 0.5) * 0.4,
      });
    }
    let raf: number, t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      t += 0.016;
      for (const p of particles) {
        p.angle += p.speed;
        p.radius += p.drift * 0.01;
        if (p.radius > (SIZE / 2) * 1.2 || p.radius < (SIZE / 2) * 0.7) p.drift *= -1;
        const px = cx + Math.cos(p.angle) * p.radius;
        const py = cy + Math.sin(p.angle) * p.radius;
        const alpha = p.alpha * (0.5 + 0.5 * Math.sin(t * 2 + p.angle));
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = colorWithAlpha(resolvedColor, alpha);
        ctx.fill();
        // Trail
        const trailLen = 4;
        for (let j = 1; j <= trailLen; j++) {
          const ta = p.angle - p.speed * j * 3;
          const tp = { x: cx + Math.cos(ta) * p.radius, y: cy + Math.sin(ta) * p.radius };
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, p.size * (1 - j / trailLen) * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = colorWithAlpha(resolvedColor, alpha * (1 - j / trailLen) * 0.4);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, color, size]);
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: size, height: size }} />;
}

export function TimerDisplay({
  secondsLeft,
  progress,
  mode,
  isRunning,
  onEditClick,
  sessionType,
  activeSecondsEarned = 0,
}: TimerDisplayProps) {
  const { minutes, seconds } = formatTime(secondsLeft);
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const outerDashOffset = OUTER_CIRCUMFERENCE * (1 - progress * 0.7);
  const cfg = MODE_CONFIG[mode];
  const reduceMotion = useReducedMotion();

  const prevSecondsRef = useRef(secondsLeft);
  const [pulsing, setPulsing] = useState(false);
  const [orbPulse, setOrbPulse] = useState(0);

  useEffect(() => {
    if (!isRunning || reduceMotion) return;
    if (prevSecondsRef.current !== secondsLeft) {
      prevSecondsRef.current = secondsLeft;
      setPulsing(true);
      setOrbPulse(p => p + 1);
      const t = setTimeout(() => setPulsing(false), 280);
      return () => clearTimeout(t);
    }
  }, [secondsLeft, isRunning, reduceMotion]);

  const xpEarned = Math.floor(activeSecondsEarned / 60) * 20;
  const coinsEarned = Math.floor(activeSecondsEarned / 300) * 10;

  const totalSize = RING2_SIZE + 16;

  return (
    <div className="relative flex items-center justify-center" style={{ width: totalSize, height: totalSize }}>

      {/* Energy particles — only when focus session running */}
      {isRunning && mode === "focus" && !reduceMotion && (
        <EnergyParticles color={cfg.particleColor} active={isRunning} size={totalSize} />
      )}

      {/* Outermost ring — decorative dashed, slow rotate */}
      <motion.svg
        width={RING2_SIZE}
        height={RING2_SIZE}
        className="absolute"
        style={{ left: 8, top: 8 }}
        animate={isRunning && !reduceMotion ? { rotate: [0, 360] } : { rotate: 0 }}
        transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
        aria-hidden
      >
        <circle
          cx={RING2_SIZE / 2}
          cy={RING2_SIZE / 2}
          r={RING2_RADIUS}
          fill="none"
          stroke={cfg.color}
          strokeWidth={RING2_STROKE}
          strokeDasharray="2 14"
          strokeLinecap="round"
          opacity={0.18}
        />
      </motion.svg>

      {/* Outer glow ring — progress indicator */}
      <svg
        width={OUTER_SIZE}
        height={OUTER_SIZE}
        className="absolute -rotate-90"
        style={{ left: (totalSize - OUTER_SIZE) / 2, top: (totalSize - OUTER_SIZE) / 2 }}
        aria-hidden
      >
        <defs>
          <linearGradient id={`outer-grad-${mode}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={cfg.gradient[0]} stopOpacity="0.4" />
            <stop offset="100%" stopColor={cfg.gradient[1]} stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <circle
          cx={OUTER_SIZE / 2}
          cy={OUTER_SIZE / 2}
          r={OUTER_RADIUS}
          fill="none"
          stroke={cfg.color}
          strokeWidth={OUTER_STROKE + 1}
          strokeDasharray="3 10"
          strokeLinecap="round"
          opacity={0.12}
        />
        <motion.circle
          cx={OUTER_SIZE / 2}
          cy={OUTER_SIZE / 2}
          r={OUTER_RADIUS}
          fill="none"
          stroke={`url(#outer-grad-${mode})`}
          strokeWidth={OUTER_STROKE + 1}
          strokeLinecap="round"
          strokeDasharray={OUTER_CIRCUMFERENCE}
          initial={false}
          animate={{ strokeDashoffset: outerDashOffset }}
          transition={{ duration: isRunning ? 1 : 0.5, ease: [0.22, 0.61, 0.36, 1] }}
        />
      </svg>

      {/* Main timer SVG ring */}
      <div className="absolute flex items-center justify-center" style={{ width: SIZE, height: SIZE, left: (totalSize - SIZE) / 2, top: (totalSize - SIZE) / 2 }}>
        <svg
          width={SIZE}
          height={SIZE}
          className="absolute inset-0 -rotate-90"
          aria-hidden
        >
          <defs>
            <filter id={`glow-${mode}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation={isRunning ? "8" : "4"} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id={`grad-${mode}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={cfg.gradient[0]} />
              <stop offset="50%" stopColor={cfg.color} />
              <stop offset="100%" stopColor={cfg.gradient[1]} />
            </linearGradient>
            <radialGradient id={`orb-bg-${mode}`} cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor={cfg.color} stopOpacity="0.15" />
              <stop offset="60%" stopColor={cfg.color} stopOpacity="0.06" />
              <stop offset="100%" stopColor={cfg.color} stopOpacity="0.02" />
            </radialGradient>
          </defs>

          {/* Orb background glow */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS - 4}
            fill={`url(#orb-bg-${mode})`}
          />

          {/* Track */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--rgba-255-255-255-0_04)"
            strokeWidth={STROKE}
          />
          {/* Progress arc */}
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={`url(#grad-${mode})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={false}
            animate={{ strokeDashoffset: dashOffset }}
            transition={reduceMotion ? { duration: 0 } : { duration: isRunning ? 0.95 : 0.5, ease: [0.22, 0.61, 0.36, 1] }}
            filter={`url(#glow-${mode})`}
          />
        </svg>

        {/* Inner orb glow pulse */}
        {isRunning && !reduceMotion && (
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: SIZE * 0.65,
              height: SIZE * 0.65,
              background: `radial-gradient(circle, color-mix(in srgb, ${cfg.color} 13%, transparent) 0%, color-mix(in srgb, ${cfg.color} 4%, transparent) 50%, transparent 70%)`,
              filter: `blur(${SIZE * 0.08}px)`,
            }}
            animate={{
              scale: [0.95, 1.08, 0.95],
              opacity: [0.6, 1, 0.6],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* Timer content */}
        <motion.div
          className="relative flex flex-col items-center justify-center gap-1 z-[var(--z-content)]"
          initial={false}
          animate={{ scale: pulsing ? 1.035 : 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {isRunning && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-1 flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm"
              style={{ background: `color-mix(in srgb, ${cfg.color} 9%, transparent)`, color: cfg.color, border: `1px solid color-mix(in srgb, ${cfg.color} 21%, transparent)` }}
            >
              <motion.span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: cfg.color }}
                animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              />
              {sessionType ? sessionType.replace(/_/g, " ") : cfg.label}
            </motion.div>
          )}

          <div className="relative group flex items-center justify-center">
            <motion.span
              className={`font-mono text-[3.6rem] font-black tabular-nums leading-none tracking-tight select-none ${onEditClick ? "cursor-pointer" : ""}`}
              style={{
                backgroundImage: `linear-gradient(135deg, var(--neutral-0), ${cfg.gradient[0]} 40%, ${cfg.gradient[1]})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: `drop-shadow(0 0 22px ${cfg.glow})`,
              }}
              onClick={onEditClick}
              animate={orbPulse > 0 ? { filter: [`drop-shadow(0 0 22px ${cfg.glow})`, `drop-shadow(0 0 38px ${cfg.glow})`, `drop-shadow(0 0 22px ${cfg.glow})`] } : {}}
              transition={{ duration: 0.4 }}
              title={onEditClick ? "Click to edit duration" : undefined}
            >
              {minutes}:{seconds}
            </motion.span>
            {onEditClick && (
              <button
                type="button"
                onClick={onEditClick}
                className="absolute -right-12 grid h-11 w-11 place-items-center rounded-[var(--radius-md)] text-[var(--palette-zinc-500)] opacity-0 transition-opacity hover:text-[var(--palette-zinc-300)] group-hover:opacity-100 focus-visible:opacity-100"
                title="Edit time"
                aria-label="Edit timer duration"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>

          <motion.span
            className="text-[11px] font-bold uppercase tracking-[0.25em]"
            style={{ color: cfg.color, opacity: 0.75 }}
            animate={isRunning ? { opacity: [0.6, 1, 0.6] } : { opacity: 0.75 }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            {isRunning ? "in progress" : "ready"}
          </motion.span>

          {isRunning && mode === "focus" && activeSecondsEarned > 30 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1.5 flex items-center gap-2.5 text-[10px] font-bold"
            >
              <span className="text-[var(--palette-violet-400)]">+{xpEarned} XP</span>
              <span className="text-[var(--palette-yellow-400)]">+{coinsEarned} 🪙</span>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
