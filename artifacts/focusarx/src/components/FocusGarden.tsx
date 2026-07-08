import { motion } from "framer-motion";

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
      <ellipse cx="60" cy="95" rx="30" ry="8" fill="rgba(120,80,40,0.5)" />
      {/* Stem */}
      <line x1="60" y1="94" x2="60" y2="72" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round" />
      {/* Tiny leaves */}
      <ellipse cx="52" cy="78" rx="8" ry="4" fill="#4ADE80" transform="rotate(-30 52 78)" opacity="0.9" />
      <ellipse cx="68" cy="75" rx="8" ry="4" fill="#22C55E" transform="rotate(30 68 75)" opacity="0.9" />
    </svg>
  );
}

function Sapling() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-label="Sapling">
      <ellipse cx="60" cy="95" rx="32" ry="9" fill="rgba(120,80,40,0.5)" />
      {/* Stem */}
      <line x1="60" y1="94" x2="60" y2="55" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" />
      {/* Left branch */}
      <path d="M60 75 Q45 65 40 60" stroke="#4ADE80" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Right branch */}
      <path d="M60 70 Q75 60 80 55" stroke="#22C55E" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Big leaves */}
      <ellipse cx="44" cy="58" rx="14" ry="7" fill="#4ADE80" transform="rotate(-20 44 58)" opacity="0.95" />
      <ellipse cx="78" cy="53" rx="14" ry="7" fill="#16A34A" transform="rotate(20 78 53)" opacity="0.95" />
      {/* Top leaf */}
      <ellipse cx="60" cy="50" rx="10" ry="6" fill="#22C55E" opacity="0.9" />
    </svg>
  );
}

function Flowering() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-label="Flowering plant">
      <ellipse cx="60" cy="97" rx="34" ry="9" fill="rgba(120,80,40,0.5)" />
      {/* Main stem */}
      <line x1="60" y1="96" x2="60" y2="42" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" />
      {/* Branches */}
      <path d="M60 80 Q42 72 36 65" stroke="#4ADE80" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M60 72 Q78 64 84 57" stroke="#22C55E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M60 60 Q46 50 42 44" stroke="#4ADE80" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Leaves */}
      <ellipse cx="38" cy="63" rx="14" ry="7" fill="#4ADE80" transform="rotate(-25 38 63)" opacity="0.9" />
      <ellipse cx="82" cy="55" rx="14" ry="7" fill="#16A34A" transform="rotate(25 82 55)" opacity="0.9" />
      <ellipse cx="44" cy="42" rx="12" ry="6" fill="#22C55E" transform="rotate(-15 44 42)" opacity="0.9" />
      {/* Flower */}
      <circle cx="60" cy="36" r="4" fill="#FFB800" />
      <ellipse cx="60" cy="28" rx="5" ry="6" fill="#F472B6" transform="rotate(0 60 28)" opacity="0.9" />
      <ellipse cx="60" cy="44" rx="5" ry="6" fill="#F472B6" transform="rotate(0 60 44)" opacity="0.9" />
      <ellipse cx="52" cy="36" rx="6" ry="5" fill="#FB7185" transform="rotate(90 52 36)" opacity="0.9" />
      <ellipse cx="68" cy="36" rx="6" ry="5" fill="#FB7185" transform="rotate(90 68 36)" opacity="0.9" />
      <circle cx="60" cy="36" r="4" fill="#FFB800" />
    </svg>
  );
}

function Tree() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-label="Full tree">
      <ellipse cx="60" cy="98" rx="36" ry="10" fill="rgba(100,60,20,0.55)" />
      {/* Trunk */}
      <rect x="55" y="74" width="10" height="24" rx="3" fill="#92400E" />
      {/* Canopy layers */}
      <polygon points="60,18 22,65 98,65" fill="#15803D" opacity="0.95" />
      <polygon points="60,28 26,68 94,68" fill="#16A34A" opacity="0.95" />
      <polygon points="60,38 30,72 90,72" fill="#4ADE80" opacity="0.85" />
      {/* Top highlight */}
      <circle cx="60" cy="30" r="14" fill="#22C55E" opacity="0.4" />
      {/* Animated leaves (will float) */}
      <motion.ellipse cx="38" cy="55" rx="5" ry="3" fill="#4ADE80" opacity="0.7"
        animate={{ y: [0, -3, 0], rotate: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
      />
      <motion.ellipse cx="82" cy="50" rx="5" ry="3" fill="#22C55E" opacity="0.7"
        animate={{ y: [0, -4, 0], rotate: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", delay: 0.5 }}
      />
      <motion.ellipse cx="55" cy="42" rx="4" ry="2.5" fill="#4ADE80" opacity="0.6"
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
        className="relative h-28 w-28 group cursor-default"
        title={`${STAGE_LABELS[stage]}: ${STAGE_DESCS[stage]}`}
      >
        {/* Glow base */}
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.18),transparent_65%)] blur-sm" />
        <PlantComponent />
        {/* Stage badge */}
        <div className="absolute -top-1 -right-1 rounded-full bg-[rgba(10,15,30,0.9)] px-1.5 py-0.5 text-[9px] font-bold text-[#4ADE80] border border-[rgba(74,222,128,0.3)]">
          Lv.{stage + 1}
        </div>
      </motion.div>

      <div className="w-full text-center">
        <p className="text-xs font-semibold text-[#4ADE80]">{STAGE_LABELS[stage]}</p>
        <p className="text-[10px] text-[#94A3B8]">{STAGE_DESCS[stage]}</p>
      </div>

      {/* Progress bar to next stage */}
      {nextThreshold !== Infinity && (
        <div className="w-full">
          <div className="mb-1 flex justify-between text-[9px] text-[#4B5563]">
            <span>{minutesToday}m today</span>
            <span>{nextThreshold}m to next stage</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(74,222,128,0.1)]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#4ADE80] to-[#22C55E]"
              style={{ boxShadow: "0 0 6px rgba(74,222,128,0.5)" }}
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
