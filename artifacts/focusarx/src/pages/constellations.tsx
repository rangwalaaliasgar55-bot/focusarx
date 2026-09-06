/**
 * STUDY CONSTELLATIONS — FocusArx Signature Feature
 *
 * Each focus session is plotted as a star on a polar coordinate map.
 * Hour of day = angle (0h at top, clockwise).
 * Session duration = distance from center (longer = farther out).
 * Focus score = star brightness/size.
 * When enough stars accumulate near each other, named constellations form.
 *
 * This is unique to FocusArx — your study history becomes a living star map.
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { Star, Info } from "lucide-react";

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = {};
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

const HOUR_LABELS = ["12am", "3am", "6am", "9am", "12pm", "3pm", "6pm", "9pm"];
const CONSTELLATION_NAMES = [
  "The Scholar", "Night Owl", "Dawn Warrior", "The Grinder",
  "Afternoon Blaze", "The Sprinter", "Iron Focus", "The Sage",
];

type Star = {
  sessionId: string;
  angle: number;
  radius: number;
  size: number;
  opacity: number;
  duration: number;
  hour: number;
  date: string;
  score: number | null;
  x: number;
  y: number;
};

type Constellation = {
  name: string;
  stars: Star[];
  centerX: number;
  centerY: number;
  color: string;
};

function sessionToStar(session: any, cx: number, cy: number, maxRadius: number): Star {
  const date = new Date(session.completedAt ?? session.createdAt);
  const hour = date.getHours() + date.getMinutes() / 60;
  const angle = (hour / 24) * 2 * Math.PI - Math.PI / 2; // 0h at top
  const durationMin = Math.floor(session.durationSec / 60);
  const radius = Math.min(maxRadius, 40 + (durationMin / 120) * (maxRadius - 40));
  const score = session.focusScore ?? 70;
  const size = 2 + (score / 100) * 4;
  const opacity = 0.4 + (score / 100) * 0.6;
  return {
    sessionId: session.id,
    angle, radius, size, opacity, duration: durationMin, hour: Math.floor(hour),
    date: date.toISOString().slice(0, 10),
    score: session.focusScore,
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

const CONSTELLATION_COLORS = ["var(--brand-600)", "var(--color-info)", "var(--color-warning)", "var(--palette-10b981)", "var(--palette-ec4899)", "var(--color-error)", "var(--palette-06b6d4)", "var(--brand-500)"];

function findConstellations(stars: Star[]): Constellation[] {
  if (stars.length < 5) return [];
  // Group stars by hour quadrant (3h blocks = 8 quadrants)
  const quadrants: Record<number, Star[]> = {};
  for (const s of stars) {
    const q = Math.floor(s.hour / 3);
    if (!quadrants[q]) quadrants[q] = [];
    quadrants[q]!.push(s);
  }
  const constellations: Constellation[] = [];
  Object.values(quadrants).forEach((qStars, i) => {
    if (qStars.length >= 3) {
      const name = CONSTELLATION_NAMES[i % CONSTELLATION_NAMES.length]!;
      const centerX = qStars.reduce((s, st) => s + st.x, 0) / qStars.length;
      const centerY = qStars.reduce((s, st) => s + st.y, 0) / qStars.length;
      constellations.push({
        name,
        stars: qStars.slice(0, 7),
        centerX, centerY,
        color: CONSTELLATION_COLORS[i % CONSTELLATION_COLORS.length]!,
      });
    }
  });
  return constellations;
}

const SVG_SIZE = 500;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;
const MAX_RADIUS = 210;
const RINGS = [70, 120, 170, 210];

export default function ConstellationsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [stars, setStars] = useState<Star[]>([]);
  const [constellations, setConstellations] = useState<Constellation[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredStar, setHoveredStar] = useState<Star | null>(null);
  const [hoveredConst, setHoveredConst] = useState<Constellation | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetch("/api/sessions/history?limit=200", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : fetch("/api/sessions?limit=200", { headers: authHeaders() }).then(r2 => r2.json()))
      .then(d => {
        const sessionList = d.sessions ?? d ?? [];
        setSessions(sessionList);
        const mapped = sessionList
          .filter((s: any) => s.durationSec >= 60 && (s.mode === "focus" || !s.mode))
          .slice(0, 150)
          .map((s: any) => sessionToStar(s, CX, CY, MAX_RADIUS));
        setStars(mapped);
        setConstellations(findConstellations(mapped));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalHours = sessions.reduce((s, sess) => s + Math.floor(sess.durationSec / 60), 0) / 60;

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--rgba-124-58-237-0_3)] bg-[var(--rgba-124-58-237-0_1)] px-4 py-1.5 mb-3">
            <Star size={14} className="text-[var(--brand-400)]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-400)]">Study Constellations</span>
            <span className="rounded-full bg-[var(--rgba-124-58-237-0_3)] px-2 py-0.5 text-[11px] font-bold text-[var(--brand-400)] uppercase">FocusArx Original</span>
          </div>
          <h1 className="text-3xl font-bold text-[var(--palette-white)] mb-1">Your Star Map</h1>
          <p className="text-[var(--muted-fg)] text-sm max-w-lg">
            Every focus session is a star. Stars form constellations. Your study journey becomes a unique universe — no two are the same.
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Star Map */}
          <div className="flex-1">
            <div className="relative rounded-3xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--palette-050614)] overflow-hidden" style={{ minHeight: 520 }}>
              {loading ? (
                <div className="flex items-center justify-center h-[520px]">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-600)] border-t-transparent" />
                    <p className="text-xs text-[var(--foreground-subtle)]">Charting your constellation...</p>
                  </div>
                </div>
              ) : stars.length === 0 ? (
                <div className="flex items-center justify-center h-[520px] flex-col gap-3">
                  <span className="text-5xl">🌑</span>
                  <p className="text-sm text-[var(--foreground-subtle)] text-center max-w-[200px]">Complete focus sessions to grow your constellation</p>
                </div>
              ) : (
                <svg ref={svgRef} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} className="w-full h-full" style={{ maxHeight: 520 }}>
                  {/* Space background particles */}
                  {[...Array(60)].map((_, i) => (
                    <circle key={`bg${i}`}
                      cx={Math.sin(i * 2.3) * 240 + CX}
                      cy={Math.cos(i * 1.7) * 240 + CY}
                      r={Math.random() * 0.8 + 0.2}
                      fill="var(--palette-white)" opacity={0.08 + (i % 5) * 0.04} />
                  ))}

                  {/* Rings */}
                  {RINGS.map(r => (
                    <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="var(--rgba-124-58-237-0_1)" strokeWidth={0.5} strokeDasharray="3,6" />
                  ))}

                  {/* Hour axes */}
                  {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
                    const angle = (h / 24) * 2 * Math.PI - Math.PI / 2;
                    return (
                      <line key={h}
                        x1={CX + 20 * Math.cos(angle)} y1={CY + 20 * Math.sin(angle)}
                        x2={CX + 218 * Math.cos(angle)} y2={CY + 218 * Math.sin(angle)}
                        stroke="var(--rgba-124-58-237-0_08)" strokeWidth={0.5} />
                    );
                  })}

                  {/* Hour labels */}
                  {showLabels && HOUR_LABELS.map((label, i) => {
                    const h = i * 3;
                    const angle = (h / 24) * 2 * Math.PI - Math.PI / 2;
                    return (
                      <text key={h}
                        x={CX + 228 * Math.cos(angle)} y={CY + 228 * Math.sin(angle)}
                        fill="var(--rgba-100-116-139-0_7)" fontSize={9} textAnchor="middle" dominantBaseline="central">
                        {label}
                      </text>
                    );
                  })}

                  {/* Center glow */}
                  <circle cx={CX} cy={CY} r={12} fill="var(--rgba-124-58-237-0_15)" />
                  <circle cx={CX} cy={CY} r={5} fill="var(--brand-600)" opacity={0.6} />
                  <circle cx={CX} cy={CY} r={2} fill="var(--brand-400)" />

                  {/* Constellation lines */}
                  {constellations.map(c => (
                    c.stars.slice(0, -1).map((s, si) => (
                      <line key={`${c.name}-${si}`}
                        x1={s.x} y1={s.y}
                        x2={c.stars[si + 1]!.x} y2={c.stars[si + 1]!.y}
                        stroke={c.color} strokeWidth={0.6} opacity={hoveredConst?.name === c.name ? 0.5 : 0.2}
                        strokeDasharray="3,4" />
                    ))
                  ))}

                  {/* Constellation name labels */}
                  {showLabels && constellations.map(c => (
                    <text key={`label-${c.name}`}
                      x={c.centerX} y={c.centerY - 14}
                      fill={c.color} fontSize={7} textAnchor="middle" opacity={0.6} fontWeight="600">
                      {c.name}
                    </text>
                  ))}

                  {/* Stars (sessions) */}
                  {stars.map((star, i) => (
                    <motion.g key={star.sessionId}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: star.opacity, scale: 1 }}
                      transition={{ delay: i * 0.008, type: "spring", stiffness: 200 }}
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(null)}
                      style={{ cursor: "pointer" }}>
                      {/* Glow */}
                      <circle cx={star.x} cy={star.y} r={star.size + 3} fill="var(--rgba-167-139-250-0_08)" />
                      {/* Star */}
                      <circle cx={star.x} cy={star.y} r={star.size} fill="var(--palette-white)"
                        opacity={star.opacity}
                        style={{ filter: `drop-shadow(0 0 ${star.size * 2}px var(--rgba-167-139-250-0_8))` }} />
                    </motion.g>
                  ))}

                  {/* Hover tooltip */}
                  {hoveredStar && (
                    <g>
                      <rect
                        x={Math.min(hoveredStar.x + 8, SVG_SIZE - 110)}
                        y={Math.max(hoveredStar.y - 30, 8)}
                        width={100} height={44} rx={6}
                        fill="var(--rgba-13-15-28-0_95)" stroke="var(--rgba-124-58-237-0_4)" strokeWidth={0.8} />
                      <text x={Math.min(hoveredStar.x + 58, SVG_SIZE - 60)} y={Math.max(hoveredStar.y - 16, 22)}
                        fill="var(--palette-white)" fontSize={8.5} textAnchor="middle" fontWeight="600">
                        {hoveredStar.date}
                      </text>
                      <text x={Math.min(hoveredStar.x + 58, SVG_SIZE - 60)} y={Math.max(hoveredStar.y - 5, 33)}
                        fill="var(--foreground-muted)" fontSize={7.5} textAnchor="middle">
                        {hoveredStar.duration}m · {hoveredStar.score != null ? `${hoveredStar.score}% focus` : "—"}
                      </text>
                      <text x={Math.min(hoveredStar.x + 58, SVG_SIZE - 60)} y={Math.max(hoveredStar.y + 6, 44)}
                        fill="var(--muted-fg)" fontSize={7} textAnchor="middle">
                        {HOUR_LABELS[Math.floor(hoveredStar.hour / 3)] ?? ""}
                      </text>
                    </g>
                  )}
                </svg>
              )}

              {/* Controls overlay */}
              <div className="absolute top-3 right-3 flex gap-2">
                <button onClick={() => setShowLabels(l => !l)}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${showLabels ? "border-[var(--rgba-124-58-237-0_4)] bg-[var(--rgba-124-58-237-0_2)] text-[var(--brand-400)]" : "border-[var(--rgba-255-255-255-0_1)] bg-[var(--rgba-0-0-0-0_4)] text-[var(--foreground-subtle)]"}`}
                  title="Toggle labels">
                  <Info size={12} />
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 justify-center flex-wrap text-[11px] text-[var(--foreground-subtle)]">
              <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-[var(--palette-white)] opacity-90" style={{ boxShadow: "0 0 6px var(--rgba-167-139-250-0_8)" }} /> Longer session = farther from center</div>
              <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-[var(--palette-white)] opacity-50" style={{ boxShadow: "0 0 4px var(--rgba-167-139-250-0_5)" }} /> Brighter = higher focus score</div>
              <div className="flex items-center gap-1.5"><div className="h-px w-6 border-t border-dashed border-[var(--rgba-124-58-237-0_5)]" /> Constellation</div>
            </div>
          </div>

          {/* Side Panel */}
          <div className="lg:w-64 space-y-4">
            {/* Stats */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--muted)] p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-fg)]">Your Map</h3>
              <div className="space-y-2">
                {[
                  { label: "Total Stars", value: stars.length, icon: "⭐" },
                  { label: "Constellations", value: constellations.length, icon: "🌌" },
                  { label: "Hours Mapped", value: `${totalHours.toFixed(1)}h`, icon: "⏱" },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-[var(--muted-fg)]">{s.icon} {s.label}</span>
                    <span className="text-xs font-bold text-[var(--palette-white)]">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Constellations List */}
            {constellations.length > 0 && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--muted)] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-fg)] mb-3">Your Constellations</h3>
                <div className="space-y-2">
                  {constellations.map(c => (
                    <motion.div key={c.name}
                      onMouseEnter={() => setHoveredConst(c)}
                      onMouseLeave={() => setHoveredConst(null)}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer transition-all hover:bg-[var(--muted)]">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
                        <span className="text-xs text-[var(--foreground-muted)]">{c.name}</span>
                      </div>
                      <span className="text-[11px] text-[var(--foreground-subtle)]">{c.stars.length} ✦</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* How it works */}
            <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-124-58-237-0_05)] p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-400)] mb-2">How it works</h3>
              <div className="space-y-1.5 text-[11px] text-[var(--muted-fg)]">
                <p>📍 Position = time of day you studied</p>
                <p>📏 Distance from center = session length</p>
                <p>✨ Brightness = focus score</p>
                <p>🔗 Lines = constellations that form when you study at similar times</p>
              </div>
            </div>

            {stars.length === 0 && !loading && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--muted)] p-4 text-center">
                <p className="text-xs text-[var(--foreground-subtle)]">Complete focus sessions to see your stars appear.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
