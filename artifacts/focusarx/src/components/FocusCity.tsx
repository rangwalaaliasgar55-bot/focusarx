import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";

async function apiFetch(path: string) {
  const token = getToken();
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const BUILDINGS = [
  { id: "hut", name: "Study Hut", xpRequired: 0, color: "#A78BFA", dark: "#5B21B6", desc: "Your journey begins", emoji: "🏠" },
  { id: "library", name: "Library", xpRequired: 500, color: "#60A5FA", dark: "#1D4ED8", desc: "Knowledge keeper", emoji: "📚" },
  { id: "cafe", name: "Focus Cafe", xpRequired: 2_000, color: "#FCD34D", dark: "#D97706", desc: "Where ideas brew", emoji: "☕" },
  { id: "gym", name: "Mind Gym", xpRequired: 5_000, color: "#34D399", dark: "#047857", desc: "Train your mind", emoji: "⚡" },
  { id: "academy", name: "Academy", xpRequired: 10_000, color: "#F472B6", dark: "#BE185D", desc: "Elite training ground", emoji: "🏛️" },
  { id: "tower", name: "Clock Tower", xpRequired: 25_000, color: "#FB923C", dark: "#C2410C", desc: "Master of time", emoji: "🕰️" },
  { id: "observatory", name: "Observatory", xpRequired: 100_000, color: "#818CF8", dark: "#3730A3", desc: "Among the stars", emoji: "🔭" },
];

function Tooltip({ building, xpRequired, unlocked }: { building: typeof BUILDINGS[0]; xpRequired: number; unlocked: boolean }) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 pointer-events-none">
      <div className="rounded-xl border border-[rgba(124,58,237,0.3)] bg-[rgba(10,8,30,0.95)] px-3 py-2 text-center backdrop-blur-xl shadow-xl min-w-[110px]">
        <p className="text-[11px] font-bold text-white whitespace-nowrap">{building.emoji} {building.name}</p>
        <p className="text-[9px] text-zinc-400 mt-0.5">{building.desc}</p>
        {!unlocked && (
          <p className="text-[9px] font-semibold mt-1" style={{ color: building.color }}>
            {xpRequired.toLocaleString()} XP to unlock
          </p>
        )}
        {unlocked && <p className="text-[9px] text-emerald-400 mt-1 font-semibold">✓ Unlocked!</p>}
      </div>
      <div className="mx-auto w-2 h-2 rotate-45 border-b border-r border-[rgba(124,58,237,0.3)] bg-[rgba(10,8,30,0.95)] -mt-1" />
    </div>
  );
}

function CityBuildings({ totalXp }: { totalXp: number }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const unlocked = useMemo(() => new Set(BUILDINGS.filter(b => totalXp >= b.xpRequired).map(b => b.id)), [totalXp]);
  const W = 520; const H = 160; const GY = 135;

  const buildings = [
    // Hut
    { id: "hut", x: 12, render: (u: boolean, col: string, dark: string) => (
      <g>
        <rect x="12" y={GY - 30} width="52" height="30" rx="2" fill={u ? col : "#1e1e30"} opacity={u ? 0.9 : 0.5} />
        <polygon points={`10,${GY - 30} 64,${GY - 30} 38,${GY - 56}`} fill={u ? dark : "#14142a"} opacity={u ? 1 : 0.4} />
        <rect x="34" y={GY - 16} width="8" height="16" rx="1" fill={u ? "#1a0a2e" : "#0a0a18"} />
        <rect x="16" y={GY - 26} width="9" height="9" rx="1" fill={u ? "#FEF08A" : "#111"} opacity={u ? 0.9 : 0.3} />
        <rect x="51" y={GY - 26} width="9" height="9" rx="1" fill={u ? "#FEF08A" : "#111"} opacity={u ? 0.9 : 0.3} />
        {u && <rect x="16" y={GY - 26} width="9" height="9" rx="1" fill="#FEF08A" opacity="0.15" filter="url(#glow)" />}
      </g>
    )},
    // Library
    { id: "library", x: 78, render: (u: boolean, col: string, dark: string) => (
      <g>
        {/* Steps */}
        <rect x="76" y={GY - 4} width="66" height="4" rx="1" fill={u ? dark : "#14142a"} opacity={u ? 0.7 : 0.35} />
        <rect x="79" y={GY - 8} width="60" height="4" rx="1" fill={u ? dark : "#14142a"} opacity={u ? 0.6 : 0.3} />
        {/* Main body */}
        <rect x="82" y={GY - 48} width="54" height="40" fill={u ? col : "#1e1e30"} opacity={u ? 0.85 : 0.4} />
        {/* Pediment triangle */}
        <polygon points={`80,${GY - 48} 138,${GY - 48} 109,${GY - 66}`} fill={u ? dark : "#14142a"} opacity={u ? 1 : 0.4} />
        {/* Columns */}
        {[90, 101, 112, 123].map((cx, i) => (
          <rect key={i} x={cx} y={GY - 48} width="5" height="40" fill={u ? dark : "#111"} opacity={u ? 0.5 : 0.3} />
        ))}
        {/* Windows */}
        <rect x="88" y={GY - 44} width="10" height="14" rx="1" fill={u ? "#FEF08A" : "#111"} opacity={u ? 0.85 : 0.2} />
        <rect x="118" y={GY - 44} width="10" height="14" rx="1" fill={u ? "#FEF08A" : "#111"} opacity={u ? 0.85 : 0.2} />
      </g>
    )},
    // Cafe
    { id: "cafe", x: 158, render: (u: boolean, col: string, dark: string) => (
      <g>
        <rect x="158" y={GY - 38} width="52" height="38" rx="2" fill={u ? col : "#1e1e30"} opacity={u ? 0.85 : 0.4} />
        {/* Awning */}
        <path d={`M156,${GY - 38} L213,${GY - 38} L210,${GY - 30} L159,${GY - 30} Z`} fill={u ? "#EF4444" : "#1a1a2a"} opacity={u ? 0.9 : 0.4} />
        {/* Awning stripes */}
        {u && [163, 172, 181, 190, 199].map((cx, i) => (
          <line key={i} x1={cx} y1={GY - 38} x2={cx - 1} y2={GY - 30} stroke="white" strokeWidth="2" opacity="0.3" />
        ))}
        {/* Sign */}
        <rect x="168" y={GY - 54} width="32" height="14" rx="3" fill={u ? dark : "#111"} opacity={u ? 0.9 : 0.3} />
        <text x="184" y={GY - 44} textAnchor="middle" fontSize="7" fill={u ? "#FEF08A" : "#333"} fontFamily="sans-serif">☕ CAFE</text>
        {/* Windows */}
        <rect x="162" y={GY - 28} width="12" height="14" rx="1" fill={u ? "#BAE6FD" : "#111"} opacity={u ? 0.7 : 0.2} />
        <rect x="194" y={GY - 28} width="12" height="14" rx="1" fill={u ? "#BAE6FD" : "#111"} opacity={u ? 0.7 : 0.2} />
        {/* Door */}
        <rect x="179" y={GY - 22} width="10" height="22" rx="1" fill={u ? "#1a0a2e" : "#0a0a18"} />
      </g>
    )},
    // Gym
    { id: "gym", x: 224, render: (u: boolean, col: string, dark: string) => (
      <g>
        <rect x="224" y={GY - 50} width="66" height="50" rx="2" fill={u ? col : "#1e1e30"} opacity={u ? 0.8 : 0.4} />
        {/* Arched entrance */}
        <path d={`M246,${GY} L246,${GY - 26} Q257,${GY - 34} 268,${GY - 26} L268,${GY} Z`} fill={u ? dark : "#111"} opacity={u ? 0.9 : 0.4} />
        {/* Sign */}
        <rect x="232" y={GY - 58} width="50" height="10" rx="2" fill={u ? dark : "#14142a"} opacity={u ? 0.9 : 0.3} />
        <text x="257" y={GY - 51} textAnchor="middle" fontSize="6.5" fill={u ? "#FEF08A" : "#333"} fontFamily="sans-serif">⚡ MIND GYM</text>
        {/* Windows */}
        {[229, 246, 262, 276].map((cx, i) => (
          i !== 1 && i !== 2 && <rect key={i} x={cx} y={GY - 38} width="10" height="10" rx="1" fill={u ? "#FEF08A" : "#111"} opacity={u ? 0.75 : 0.2} />
        ))}
        <rect x="229" y={GY - 38} width="10" height="10" rx="1" fill={u ? "#FEF08A" : "#111"} opacity={u ? 0.75 : 0.2} />
        <rect x="278" y={GY - 38} width="10" height="10" rx="1" fill={u ? "#FEF08A" : "#111"} opacity={u ? 0.75 : 0.2} />
        <rect x="229" y={GY - 22} width="10" height="10" rx="1" fill={u ? "#FEF08A" : "#111"} opacity={u ? 0.75 : 0.2} />
        <rect x="278" y={GY - 22} width="10" height="10" rx="1" fill={u ? "#FEF08A" : "#111"} opacity={u ? 0.75 : 0.2} />
      </g>
    )},
    // Academy
    { id: "academy", x: 305, render: (u: boolean, col: string, dark: string) => (
      <g>
        {/* Main body */}
        <rect x="302" y={GY - 62} width="64" height="62" rx="2" fill={u ? col : "#1e1e30"} opacity={u ? 0.8 : 0.4} />
        {/* Bell tower */}
        <rect x="324" y={GY - 90} width="20" height="28" rx="1" fill={u ? dark : "#14142a"} opacity={u ? 1 : 0.4} />
        {/* Bell tower roof */}
        <polygon points={`322,${GY - 90} 346,${GY - 90} 334,${GY - 106}`} fill={u ? col : "#14142a"} opacity={u ? 0.9 : 0.35} />
        {/* Bell */}
        {u && <text x="334" y={GY - 76} textAnchor="middle" fontSize="8">🔔</text>}
        {/* Windows */}
        {[309, 328, 347, 364].map((cx, i) => (
          <rect key={i} x={cx} y={GY - 50} width="10" height="12" rx="1" fill={u ? "#FEF08A" : "#111"} opacity={u ? 0.8 : 0.2} />
        ))}
        {[309, 328, 347, 364].map((cx, i) => (
          <rect key={i} x={cx} y={GY - 30} width="10" height="12" rx="1" fill={u ? "#FEF08A" : "#111"} opacity={u ? 0.8 : 0.2} />
        ))}
        {/* Door */}
        <rect x="326" y={GY - 20} width="16" height="20" rx="2" fill={u ? "#1a0a2e" : "#0a0a18"} />
        {/* Steps */}
        <rect x="310" y={GY - 4} width="48" height="4" rx="1" fill={u ? dark : "#14142a"} opacity={u ? 0.5 : 0.25} />
      </g>
    )},
    // Clock Tower
    { id: "tower", x: 384, render: (u: boolean, col: string, dark: string) => (
      <g>
        {/* Base */}
        <rect x="382" y={GY - 50} width="40" height="50" rx="2" fill={u ? col : "#1e1e30"} opacity={u ? 0.8 : 0.4} />
        {/* Tower shaft */}
        <rect x="390" y={GY - 95} width="24" height="45" rx="2" fill={u ? dark : "#14142a"} opacity={u ? 1 : 0.4} />
        {/* Spire */}
        <polygon points={`388,${GY - 95} 416,${GY - 95} 402,${GY - 115}`} fill={u ? col : "#14142a"} opacity={u ? 1 : 0.35} />
        {/* Clock face */}
        <circle cx="402" cy={GY - 75} r="9" fill={u ? "#FEF3C7" : "#111"} opacity={u ? 0.9 : 0.2} />
        <circle cx="402" cy={GY - 75} r="9" fill="none" stroke={u ? dark : "#222"} strokeWidth="1.5" />
        {u && <>
          <line x1="402" y1={GY - 75} x2="402" y2={GY - 82} stroke={dark} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="402" y1={GY - 75} x2="406" y2={GY - 73} stroke={dark} strokeWidth="1" strokeLinecap="round" />
        </>}
        {/* Windows */}
        <rect x="388" y={GY - 42} width="10" height="12" rx="1" fill={u ? "#FEF08A" : "#111"} opacity={u ? 0.8 : 0.2} />
        <rect x="406" y={GY - 42} width="10" height="12" rx="1" fill={u ? "#FEF08A" : "#111"} opacity={u ? 0.8 : 0.2} />
        <rect x="388" y={GY - 22} width="10" height="12" rx="1" fill={u ? "#FEF08A" : "#111"} opacity={u ? 0.8 : 0.2} />
        <rect x="406" y={GY - 22} width="10" height="12" rx="1" fill={u ? "#FEF08A" : "#111"} opacity={u ? 0.8 : 0.2} />
        {/* Arch entrance */}
        <path d={`M394,${GY} L394,${GY - 16} Q402,${GY - 22} 410,${GY - 16} L410,${GY} Z`} fill={u ? "#1a0a2e" : "#0a0a18"} />
      </g>
    )},
    // Observatory
    { id: "observatory", x: 432, render: (u: boolean, col: string, dark: string) => (
      <g>
        {/* Hill */}
        <ellipse cx="472" cy={GY} rx="52" ry="14" fill={u ? "#1a3a2e" : "#111"} opacity={u ? 0.7 : 0.3} />
        {/* Base building */}
        <rect x="448" y={GY - 38} width="48" height="24" rx="3" fill={u ? col : "#1e1e30"} opacity={u ? 0.85 : 0.4} />
        {/* Dome base */}
        <rect x="455" y={GY - 52} width="34" height="14" rx="2" fill={u ? dark : "#14142a"} opacity={u ? 1 : 0.4} />
        {/* Dome */}
        <ellipse cx="472" cy={GY - 52} rx="20" ry="16" fill={u ? col : "#1e1e30"} opacity={u ? 0.9 : 0.35} />
        {/* Dome opening slit */}
        <rect x="471" y={GY - 66} width="3" height="14" rx="1" fill={u ? "#0a0a18" : "#0a0a18"} opacity="0.8" />
        {/* Telescope glint */}
        {u && <ellipse cx="474" cy={GY - 58} rx="2" ry="1" fill="#FEF08A" opacity="0.9" />}
        {/* Stars emanating */}
        {u && [
          { x: 500, y: GY - 80 }, { x: 510, y: GY - 60 }, { x: 492, y: GY - 100 }
        ].map((s, i) => (
          <motion.text key={i} x={s.x} y={s.y} fontSize="8" animate={{ opacity: [0.3, 1, 0.3], y: [s.y, s.y - 4, s.y] }}
            transition={{ duration: 2 + i * 0.7, repeat: Infinity, delay: i * 0.5 }}>✨</motion.text>
        ))}
        {/* Windows */}
        <rect x="452" y={GY - 32} width="10" height="10" rx="1" fill={u ? "#BAE6FD" : "#111"} opacity={u ? 0.8 : 0.2} />
        <rect x="482" y={GY - 32} width="10" height="10" rx="1" fill={u ? "#BAE6FD" : "#111"} opacity={u ? 0.8 : 0.2} />
      </g>
    )},
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible">
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={totalXp >= 100000 ? "#0d0d2b" : totalXp >= 25000 ? "#0f0a1e" : "#0a0f1e"} />
          <stop offset="100%" stopColor={totalXp >= 25000 ? "#1a0a2e" : "#111827"} />
        </linearGradient>
        <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2e1a" />
          <stop offset="100%" stopColor="#0f1f0f" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Sky */}
      <rect x="0" y="0" width={W} height={H} fill="url(#skyGrad)" rx="12" />

      {/* Stars (appear at higher XP) */}
      {totalXp >= 10000 && [
        { x: 30, y: 20 }, { x: 80, y: 8 }, { x: 140, y: 25 }, { x: 200, y: 10 },
        { x: 260, y: 30 }, { x: 320, y: 12 }, { x: 380, y: 28 }, { x: 440, y: 15 }, { x: 490, y: 35 },
        { x: 55, y: 40 }, { x: 170, y: 45 }, { x: 350, y: 42 }, { x: 460, y: 50 },
      ].map((s, i) => (
        <motion.circle key={i} cx={s.x} cy={s.y} r="1.2" fill="white"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5 + (i * 0.3) % 2, repeat: Infinity, delay: (i * 0.4) % 3 }} />
      ))}

      {/* Moon (25k+ XP) */}
      {totalXp >= 25000 && (
        <g>
          <circle cx="480" cy="22" r="14" fill="#FEF3C7" opacity="0.9" />
          <circle cx="488" cy="17" r="11" fill={totalXp >= 100000 ? "#0d0d2b" : "#0f0a1e"} opacity="0.95" />
        </g>
      )}

      {/* Ground */}
      <rect x="0" y={GY} width={W} height={H - GY} fill="url(#groundGrad)" rx="0" />
      <rect x="0" y={GY - 1} width={W} height="3" fill="#2d4a2d" opacity="0.8" />

      {/* Buildings */}
      {buildings.map((b, i) => {
        const building = BUILDINGS[i];
        const u = unlocked.has(b.id);
        const col = u ? building.color : "#2a2a3a";
        const dark = u ? building.dark : "#111";
        return (
          <g key={b.id} className="cursor-pointer"
            onMouseEnter={() => setHovered(b.id)}
            onMouseLeave={() => setHovered(null)}>
            {/* Glow under unlocked buildings */}
            {u && <ellipse cx={b.x + 30} cy={GY + 2} rx="28" ry="4" fill={building.color} opacity="0.12" />}
            {b.render(u, col, dark)}
          </g>
        );
      })}

      {/* Ground road/path */}
      <rect x="0" y={GY + 4} width={W} height="3" fill="#1a2a1a" opacity="0.6" />
      <rect x="0" y={GY + 6} width={W} height="1" fill="#2d4a2d" opacity="0.4" />

      {/* NPC Students — appear once buildings start unlocking */}
      {totalXp >= 500 && [
        { cx: 85,  cy: GY - 2, color: "#60A5FA", dir: 1,  delay: 0    },
        { cx: 160, cy: GY - 2, color: "#A78BFA", dir: -1, delay: 0.8  },
        { cx: 270, cy: GY - 2, color: "#34D399", dir: 1,  delay: 1.5  },
        { cx: 360, cy: GY - 2, color: "#F472B6", dir: -1, delay: 2.2  },
        { cx: 430, cy: GY - 2, color: "#FCD34D", dir: 1,  delay: 0.4  },
      ].filter((_, i) => i < Math.min(5, Math.floor(totalXp / 2000) + 1)).map((npc, i) => (
        <g key={i}>
          {/* Body */}
          <motion.g
            animate={{ x: [0, npc.dir * 3, 0] }}
            transition={{ duration: 2 + i * 0.5, repeat: Infinity, delay: npc.delay, ease: "easeInOut" }}
          >
            {/* Head */}
            <circle cx={npc.cx} cy={npc.cy - 8} r="3" fill={npc.color} opacity="0.9" />
            {/* Body */}
            <rect x={npc.cx - 2} y={npc.cy - 5} width="4" height="5" rx="1" fill={npc.color} opacity="0.75" />
            {/* Legs */}
            <motion.g animate={{ rotate: [-8, 8, -8] }} style={{ transformOrigin: `${npc.cx}px ${npc.cy}px` }}
              transition={{ duration: 0.6 + i * 0.1, repeat: Infinity, delay: npc.delay }}>
              <line x1={npc.cx - 1} y1={npc.cy} x2={npc.cx - 2} y2={npc.cy + 3} stroke={npc.color} strokeWidth="1.5" opacity="0.7" />
              <line x1={npc.cx + 1} y1={npc.cy} x2={npc.cx + 2} y2={npc.cy + 3} stroke={npc.color} strokeWidth="1.5" opacity="0.7" />
            </motion.g>
          </motion.g>
        </g>
      ))}
    </svg>
  );
}

interface FocusCityProps {
  className?: string;
}

const MOTIVATIONAL_MESSAGES = [
  { emoji: "🔥", text: "Your focus builds the city, brick by brick." },
  { emoji: "⚡", text: "Every session unlocks a new chapter." },
  { emoji: "🌟", text: "Deep work is your superpower." },
  { emoji: "🏛️", text: "Rome wasn't built in a day — your city grows with every session." },
  { emoji: "🎯", text: "Distraction fades. Focus compounds." },
  { emoji: "🧠", text: "Your attention is the most valuable resource." },
  { emoji: "📈", text: "Progress, not perfection, builds greatness." },
  { emoji: "🌙", text: "Late nights and early mornings are your secret weapon." },
  { emoji: "✨", text: "Each minute of focus is XP for your real life." },
  { emoji: "🚀", text: "The best time to start was yesterday. Second best is now." },
];

export default function FocusCity({ className }: FocusCityProps) {
  const [msgIdx, setMsgIdx] = useState(0);

  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => apiFetch("/api/gamification/wallet"),
    staleTime: 30_000,
  });

  const totalXp: number = wallet?.totalXp ?? 0;
  const unlockedCount = useMemo(() => BUILDINGS.filter(b => totalXp >= b.xpRequired).length, [totalXp]);
  const nextBuilding = useMemo(() => BUILDINGS.find(b => totalXp < b.xpRequired), [totalXp]);
  const prevBuilding = useMemo(() => {
    const idx = BUILDINGS.findIndex(b => totalXp < b.xpRequired);
    return idx > 0 ? BUILDINGS[idx - 1] : BUILDINGS[BUILDINGS.length - 1];
  }, [totalXp]);

  // Rotate motivational message every 8 seconds
  useEffect(() => {
    const id = setInterval(() => setMsgIdx(i => (i + 1) % MOTIVATIONAL_MESSAGES.length), 8000);
    return () => clearInterval(id);
  }, []);

  const progress = nextBuilding
    ? ((totalXp - (prevBuilding?.xpRequired ?? 0)) / (nextBuilding.xpRequired - (prevBuilding?.xpRequired ?? 0))) * 100
    : 100;

  return (
    <div className={`rounded-2xl border border-[rgba(124,58,237,0.2)] bg-gradient-to-b from-[#0a0f1e] to-[#0d0812] overflow-hidden ${className ?? ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#4B5563]">Focus City</p>
          <p className="text-xs font-bold text-[#E2E8F0] mt-0.5">
            {unlockedCount}/{BUILDINGS.length} buildings
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[#4B5563] uppercase tracking-wider">Total XP</p>
          <p className="text-sm font-bold text-[#A78BFA]">{totalXp.toLocaleString()}</p>
        </div>
      </div>

      {/* City SVG */}
      <div className="px-2 pb-1 h-[155px] relative">
        <CityBuildings totalXp={totalXp} />
      </div>

      {/* Next unlock progress */}
      {nextBuilding && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] text-[#4B5563]">
              Next: <span className="text-[#E2E8F0] font-medium">{nextBuilding.emoji} {nextBuilding.name}</span>
            </p>
            <p className="text-[10px] font-semibold" style={{ color: nextBuilding.color }}>
              {(nextBuilding.xpRequired - totalXp).toLocaleString()} XP away
            </p>
          </div>
          <div className="h-1.5 rounded-full bg-[rgba(124,58,237,0.1)] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${nextBuilding.color}80, ${nextBuilding.color})` }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {unlockedCount === BUILDINGS.length && (
        <div className="px-4 pb-1">
          <div className="rounded-xl bg-gradient-to-r from-[rgba(129,140,248,0.15)] to-[rgba(167,139,250,0.1)] border border-[rgba(129,140,248,0.2)] px-3 py-2 text-center">
            <p className="text-[11px] font-bold text-[#818CF8]">🏆 Full city unlocked! Legendary status.</p>
          </div>
        </div>
      )}

      {/* Motivational message — rotates every 8s */}
      <div className="px-4 pb-4 pt-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={msgIdx}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-2 rounded-lg bg-[rgba(124,58,237,0.06)] border border-[rgba(124,58,237,0.12)] px-3 py-2"
          >
            <span className="text-base leading-none flex-shrink-0">{MOTIVATIONAL_MESSAGES[msgIdx]!.emoji}</span>
            <p className="text-[10px] text-[#94A3B8] leading-tight italic">{MOTIVATIONAL_MESSAGES[msgIdx]!.text}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
