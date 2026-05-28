import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { Cloud, Sun, Zap, Wind, Rainbow } from "lucide-react";

type WeatherState = "clear_skies" | "flow_state_incoming" | "partly_cloudy" | "fog" | "storm_warning";

type Forecast = {
  state: WeatherState;
  emoji: string;
  label: string;
  tagline: string;
  recommendedSessionMin: number;
  recommendedBlocks: number;
  color: string;
};

type WeatherData = {
  forecast: Forecast;
  score: number;
  readinessScore: number;
  currentStreak: number;
  meetingCount: number;
};

// --- CSS animated weather backgrounds ---
function WeatherCanvas({ state, color }: { state: WeatherState; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; size: number; opacity: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    // Init particles
    particlesRef.current = Array.from({ length: state === "storm_warning" ? 80 : state === "fog" ? 30 : 40 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: state === "storm_warning" ? -1.5 - Math.random() * 2 : (Math.random() - 0.5) * 0.3,
      vy: state === "storm_warning" ? 2 + Math.random() * 3 : state === "fog" ? 0.1 : 0.3 + Math.random() * 0.4,
      size: state === "storm_warning" ? 1.5 : state === "fog" ? 8 + Math.random() * 12 : 2 + Math.random() * 3,
      opacity: state === "fog" ? 0.03 + Math.random() * 0.05 : 0.4 + Math.random() * 0.5,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of particlesRef.current) {
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = state === "storm_warning" ? "#60A5FA" :
                        state === "flow_state_incoming" ? color :
                        state === "clear_skies" ? "#FCD34D" :
                        "#94A3B8";
        if (state === "fog") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (state === "storm_warning") {
          ctx.fillRect(p.x, p.y, 1, p.size * 4);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y > H + 10) p.y = -10;
      }
      ctx.globalAlpha = 1;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [state, color]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={120}
      className="absolute inset-0 w-full h-full rounded-2xl pointer-events-none"
    />
  );
}

export default function WeatherWidget() {
  const { status } = useAuth();
  const [data, setData] = useState<WeatherData | null>(null);
  const [meetings, setMeetings] = useState(0);
  const [loading, setLoading] = useState(true);

  const token = () => localStorage.getItem("focusarx-auth-token");

  const load = (m = meetings) => {
    setLoading(true);
    fetch(`/api/focus-weather?meetings=${m}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then((r) => r.json())
      .then((d: WeatherData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { setLoading(false); return; }
    load();
  }, [status]);

  if (status === "unauthenticated" || (!loading && !data)) return null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 h-[120px] flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" />
      </div>
    );
  }

  if (!data) return null;

  const { forecast } = data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl border overflow-hidden"
      style={{
        borderColor: `${forecast.color}33`,
        background: `linear-gradient(135deg, ${forecast.color}0D 0%, transparent 60%)`,
        minHeight: 120,
      }}
    >
      <WeatherCanvas state={forecast.state} color={forecast.color} />

      <div className="relative z-10 p-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{forecast.emoji}</span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#4B5563]">Focus Forecast</p>
              <p className="text-base font-bold" style={{ color: forecast.color }}>{forecast.label}</p>
            </div>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">{forecast.tagline}</p>
          <div className="flex gap-3 mt-2">
            <span className="text-[10px] text-[#4B5563]">
              Rec: <span className="font-semibold text-[#E2E8F0]">{forecast.recommendedSessionMin}m blocks</span>
            </span>
            <span className="text-[10px] text-[#4B5563]">
              × <span className="font-semibold text-[#E2E8F0]">{forecast.recommendedBlocks}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div
            className="rounded-xl px-3 py-1 text-xs font-bold"
            style={{ background: `${forecast.color}1A`, color: forecast.color }}
          >
            Score {data.score}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-[#4B5563]">Meetings today:</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => { setMeetings(n); load(n); }}
                  className={`w-5 h-5 rounded text-[9px] font-bold transition-all ${meetings === n ? "text-white" : "text-[#4B5563]"}`}
                  style={meetings === n ? { background: forecast.color } : { background: "rgba(124,58,237,0.08)" }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
