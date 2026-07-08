import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

function useOrbCanvas(ref: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    resize();

    const nodes: { x: number; y: number; vx: number; vy: number }[] = [];
    for (let i = 0; i < 40; i++) {
      nodes.push({
        x: Math.random() * 320,
        y: Math.random() * 320,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
      });
    }

    const draw = () => {
      t += 0.018;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width / devicePixelRatio;
      const H = canvas.height / devicePixelRatio;
      const cx = W / 2;
      const cy = H / 2;
      const r = 80 + Math.sin(t * 1.5) * 6;

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 90) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(124,58,237,${0.15 * (1 - d / 90)})`;
            ctx.lineWidth = 0.7;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.arc(nodes[i].x, nodes[i].y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(167,139,250,0.4)";
        ctx.fill();
      }

      // Outer glow rings
      for (const [rM, a] of [[2.5, 0.04], [1.8, 0.08], [1.3, 0.14]] as [number, number][]) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * rM);
        g.addColorStop(0, `rgba(124,58,237,${a})`);
        g.addColorStop(1, "rgba(124,58,237,0)");
        ctx.beginPath();
        ctx.arc(cx, cy, r * rM, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      // Core orb
      const core = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx, cy, r);
      core.addColorStop(0, "rgba(210,180,255,0.95)");
      core.addColorStop(0.4, "rgba(124,58,237,0.9)");
      core.addColorStop(0.8, "rgba(79,46,220,0.82)");
      core.addColorStop(1, "rgba(49,10,180,0.75)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      // Rotating rings
      for (let ring = 0; ring < 3; ring++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.5 * (ring % 2 === 0 ? 1 : -1) + ring * 1.2);
        ctx.scale(1, Math.sin(t * 0.4 + ring * 1.1) * 0.35 + 0.12);
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.88 + ring * 0.1), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(167,139,250,${0.2 - ring * 0.05})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // Highlight
      const hl = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.38, 0, cx - r * 0.15, cy - r * 0.15, r * 0.52);
      hl.addColorStop(0, "rgba(255,255,255,0.28)");
      hl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = hl;
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ref]);
}

const TIPS = [
  "Preparing your focus environment…",
  "Loading AI coaching engine…",
  "Syncing your progress…",
  "Initialising deep work OS…",
  "Almost ready…",
];

export default function LoadingScreen({ onDone }: { onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [done, setDone] = useState(false);

  useOrbCanvas(canvasRef);

  useEffect(() => {
    let p = 0;
    const id = setInterval(() => {
      p += Math.random() * 14 + 4;
      if (p >= 100) {
        p = 100;
        clearInterval(id);
        setTimeout(() => {
          setDone(true);
          onDone?.();
        }, 400);
      }
      setProgress(Math.min(100, p));
    }, 140);
    const tipId = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 1400);
    return () => { clearInterval(id); clearInterval(tipId); };
  }, [onDone]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="loading"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(12px)" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#030308] overflow-hidden"
        >
          {/* Background particles */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {/* Radial gradient bg */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(124,58,237,0.12),transparent)]" />

          <div className="relative z-10 flex flex-col items-center gap-8">
            {/* Logo mark */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#4f46e5] opacity-40 blur-2xl scale-150" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#4f46e5] shadow-2xl shadow-purple-900/60">
                <svg viewBox="0 0 24 24" fill="white" className="h-8 w-8">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </motion.div>

            {/* Brand name */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center"
            >
              <h1 className="text-2xl font-black tracking-tight text-white">FocusArx</h1>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4b5563] mt-0.5">AI-Powered Deep Work OS</p>
            </motion.div>

            {/* Progress bar */}
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "100%" }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="w-64"
            >
              <div className="h-1 w-full rounded-full bg-[#0d0f18] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #7c3aed, #e879f9)",
                    boxShadow: "0 0 12px rgba(124,58,237,0.6)",
                  }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                />
              </div>
              <div className="mt-3 text-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={tipIndex}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                    className="text-[11px] text-[#4b5563] font-medium"
                  >
                    {TIPS[tipIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Spinning ring decoration */}
            <div className="absolute -z-10" style={{ width: 300, height: 300, top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border border-purple-500/10"
                  style={{ scale: 1 + i * 0.25 }}
                  animate={{ rotate: 360 * (i % 2 === 0 ? 1 : -1) }}
                  transition={{ duration: 8 + i * 4, repeat: Infinity, ease: "linear" }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
