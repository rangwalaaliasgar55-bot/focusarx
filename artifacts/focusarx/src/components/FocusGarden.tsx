import { motion } from "framer-motion";
import { lazy, Suspense } from "react";

const FocusGarden3D = lazy(() => import("./FocusGarden3D"));

interface FocusGardenProps {
  minutesToday: number;
  className?: string;
}

function getStage(minutes: number): 0 | 1 | 2 | 3 {
  if (minutes >= 180) return 3;
  if (minutes >= 90) return 2;
  if (minutes >= 30) return 1;
  return 0;
}

function Seedling() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-label="Seedling">
      {/* Soil */}
      <ellipse cx="60" cy="95" rx="30" ry="8" fill="var(--rgba-120-80-40-0_5)" />
      {/* Stem */}
      <line x1="60" y1="94" x2="60" y2="72" stroke="var(--palette-4ade80)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Tiny leaves */}
      <ellipse cx="52" cy="78" rx="8" ry="4" fill="var(--palette-4ade80)" transform="rotate(-30 52 78)" opacity="0.9" />
      <ellipse cx="68" cy="75" rx="8" ry="4" fill="var(--color-success)" transform="rotate(30 68 75)" opacity="0.9" />
    </svg>
  );
}

function Sapling() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-label="Sapling">
      <ellipse cx="60" cy="95" rx="32" ry="9" fill="var(--rgba-120-80-40-0_5)" />
      {/* Stem */}
      <line x1="60" y1="94" x2="60" y2="55" stroke="var(--palette-4ade80)" strokeWidth="3" strokeLinecap="round" />
      {/* Left branch */}
      <path d="M60 75 Q45 65 40 60" stroke="var(--palette-4ade80)" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Right branch */}
      <path d="M60 70 Q75 60 80 55" stroke="var(--color-success)" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Big leaves */}
      <ellipse cx="44" cy="58" rx="14" ry="7" fill="var(--palette-4ade80)" transform="rotate(-20 44 58)" opacity="0.95" />
      <ellipse cx="78" cy="53" rx="14" ry="7" fill="var(--palette-16a34a)" transform="rotate(20 78 53)" opacity="0.95" />
      {/* Top leaf */}
      <ellipse cx="60" cy="50" rx="10" ry="6" fill="var(--color-success)" opacity="0.9" />
    </svg>
  );
}

function Flowering() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-label="Flowering plant">
      <ellipse cx="60" cy="97" rx="34" ry="9" fill="var(--rgba-120-80-40-0_5)" />
      {/* Main stem */}
      <line x1="60" y1="96" x2="60" y2="42" stroke="var(--palette-4ade80)" strokeWidth="3" strokeLinecap="round" />
      {/* Branches */}
      <path d="M60 80 Q42 72 36 65" stroke="var(--palette-4ade80)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M60 72 Q78 64 84 57" stroke="var(--color-success)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M60 60 Q46 50 42 44" stroke="var(--palette-4ade80)" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Leaves */}
      <ellipse cx="38" cy="63" rx="14" ry="7" fill="var(--palette-4ade80)" transform="rotate(-25 38 63)" opacity="0.9" />
      <ellipse cx="82" cy="55" rx="14" ry="7" fill="var(--palette-16a34a)" transform="rotate(25 82 55)" opacity="0.9" />
      <ellipse cx="44" cy="42" rx="12" ry="6" fill="var(--color-success)" transform="rotate(-15 44 42)" opacity="0.9" />
      {/* Flower */}
      <circle cx="60" cy="36" r="4" fill="var(--brand-gold)" />
      <ellipse cx="60" cy="28" rx="5" ry="6" fill="var(--brand-pink)" transform="rotate(0 60 28)" opacity="0.9" />
      <ellipse cx="60" cy="44" rx="5" ry="6" fill="var(--brand-pink)" transform="rotate(0 60 44)" opacity="0.9" />
      <ellipse cx="52" cy="36" rx="6" ry="5" fill="var(--danger)" transform="rotate(90 52 36)" opacity="0.9" />
      <ellipse cx="68" cy="36" rx="6" ry="5" fill="var(--danger)" transform="rotate(90 68 36)" opacity="0.9" />
      <circle cx="60" cy="36" r="4" fill="var(--brand-gold)" />
    </svg>
  );
}

function Tree() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-label="Full tree">
      <ellipse cx="60" cy="98" rx="36" ry="10" fill="var(--rgba-100-60-20-0_55)" />
      {/* Trunk */}
      <rect x="55" y="74" width="10" height="24" rx="3" fill="var(--palette-92400e)" />
      {/* Canopy layers */}
      <polygon points="60,18 22,65 98,65" fill="var(--palette-15803d)" opacity="0.95" />
      <polygon points="60,28 26,68 94,68" fill="var(--palette-16a34a)" opacity="0.95" />
      <polygon points="60,38 30,72 90,72" fill="var(--palette-4ade80)" opacity="0.85" />
      {/* Top highlight */}
      <circle cx="60" cy="30" r="14" fill="var(--color-success)" opacity="0.4" />
      {/* Animated leaves (will float) */}
      <motion.ellipse cx="38" cy="55" rx="5" ry="3" fill="var(--palette-4ade80)" opacity="0.7"
        animate={{ y: [0, -3, 0], rotate: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
      />
      <motion.ellipse cx="82" cy="50" rx="5" ry="3" fill="var(--color-success)" opacity="0.7"
        animate={{ y: [0, -4, 0], rotate: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", delay: 0.5 }}
      />
      <motion.ellipse cx="55" cy="42" rx="4" ry="2.5" fill="var(--palette-4ade80)" opacity="0.6"
        animate={{ y: [0, -5, 0], rotate: [0, 12, 0] }}
        transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut", delay: 1 }}
      />
    </svg>
  );
}

const STAGE_LABELS = ["Seedling", "Sapling", "Flowering", "Full Tree"];
const STAGE_DESCS  = [
  "Start focusing to grow your plant!",
  "30+ min — your plant is growing.",
  "90+ min — a flower has bloomed!",
  "180+ min — magnificent! 🌳",
];
const NEXT_THRESHOLDS = [30, 90, 180, Infinity];

export default function FocusGarden({ minutesToday, className = "" }: FocusGardenProps) {
  const stage = getStage(minutesToday);
  const nextThreshold = NEXT_THRESHOLDS[stage]!;
  const progress = nextThreshold === Infinity ? 1 : Math.min(1, minutesToday / nextThreshold);

  const Plants = [Seedling, Sapling, Flowering, Tree];
  const PlantComponent = Plants[stage]!;

  return (
    <div className={`relative flex flex-col items-center gap-3 ${className}`}>
      <motion.div
        key={stage}
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="relative h-32 w-32 group cursor-default"
      >
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center text-[10px] text-[var(--palette-zinc-500)]">Growing...</div>}>
          <FocusGarden3D stage={stage} />
        </Suspense>
        {/* Stage badge */}
        <div className="absolute -top-1 -right-1 rounded-full bg-[var(--rgba-10-15-30-0_9)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--palette-4ade80)] border border-[var(--rgba-74-222-128-0_3)]">
          Lv.{stage + 1}
        </div>
      </motion.div>

      <div className="w-full text-center">
        <p className="text-xs font-semibold text-[var(--palette-4ade80)]">{STAGE_LABELS[stage]}</p>
        <p className="text-[10px] text-[var(--foreground-muted)]">{STAGE_DESCS[stage]}</p>
      </div>

      {/* Progress bar to next stage */}
      {nextThreshold !== Infinity && (
        <div className="w-full">
          <div className="mb-1 flex justify-between text-[9px] text-[var(--foreground-subtle)]">
            <span>{minutesToday}m today</span>
            <span>{nextThreshold}m to next stage</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--rgba-74-222-128-0_1)]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--palette-4ade80)] to-[var(--color-success)]"
              style={{ boxShadow: "0 0 6px var(--rgba-74-222-128-0_5)" }}
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
