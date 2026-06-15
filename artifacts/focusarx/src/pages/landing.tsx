import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

/* ─── Canvas Orb ─────────────────────────────────────────────────── */
function useOrb(canvasRef: React.RefObject<HTMLCanvasElement | null>, mouseRef: React.RefObject<{ x: number; y: number }>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let t = 0;
    const nodes: { x: number; y: number; vx: number; vy: number }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    // Create constellation nodes
    for (let i = 0; i < 70; i++) {
      nodes.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
      });
    }

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);
      t += 0.008;

      const mx = (mouseRef.current?.x ?? 0.5) * W;
      const my = (mouseRef.current?.y ?? 0.5) * H;

      // Move nodes
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      }

      // Draw constellation lines
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(124,58,237,${0.18 * (1 - d / 120)})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
        // Node dots
        const dx = nodes[i].x - mx;
        const dy = nodes[i].y - my;
        const distToMouse = Math.sqrt(dx * dx + dy * dy);
        const bright = distToMouse < 160 ? 0.9 : 0.35;
        ctx.beginPath();
        ctx.arc(nodes[i].x, nodes[i].y, distToMouse < 160 ? 2 : 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167,139,250,${bright})`;
        ctx.fill();
      }

      // Central glowing orb
      const cx = W * 0.62 + Math.sin(t * 0.8) * 18 + (mx - W * 0.5) * 0.04;
      const cy = H * 0.5 + Math.cos(t * 0.6) * 12 + (my - H * 0.5) * 0.03;
      const r = Math.min(W, H) * 0.2 + Math.sin(t * 1.2) * 8;

      // Outer glow layers
      for (const [rMult, alpha] of [[2.8, 0.03], [2.0, 0.06], [1.5, 0.1], [1.15, 0.18]] as [number, number][]) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * rMult);
        g.addColorStop(0, `rgba(124,58,237,${alpha})`);
        g.addColorStop(0.5, `rgba(167,139,250,${alpha * 0.4})`);
        g.addColorStop(1, "rgba(124,58,237,0)");
        ctx.beginPath();
        ctx.arc(cx, cy, r * rMult, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      // Core orb
      const coreGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
      coreGrad.addColorStop(0, "rgba(200,170,255,0.95)");
      coreGrad.addColorStop(0.35, "rgba(124,58,237,0.88)");
      coreGrad.addColorStop(0.7, "rgba(79,46,220,0.82)");
      coreGrad.addColorStop(1, "rgba(49,10,180,0.75)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Wireframe rings
      for (let ring = 0; ring < 3; ring++) {
        const tilt = (ring / 3) * Math.PI;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.3 + ring * 0.8);
        ctx.scale(1, Math.sin(tilt + t * 0.2) * 0.45 + 0.1);
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.85 + ring * 0.12), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(167,139,250,${0.14 - ring * 0.03})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // Highlight
      const hl = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 0, cx - r * 0.2, cy - r * 0.2, r * 0.5);
      hl.addColorStop(0, "rgba(255,255,255,0.22)");
      hl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = hl;
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef, mouseRef]);
}

/* ─── Floating particles background ───────────────────────────────── */
function ParticlesBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number;
    const particles: { x: number; y: number; r: number; alpha: number; speed: number }[] = [];
    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        r: Math.random() * 1.5 + 0.3,
        alpha: Math.random() * 0.5 + 0.1,
        speed: Math.random() * 0.015 + 0.003,
      });
    }
    let t = 0;
    const draw = () => {
      t += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width / devicePixelRatio;
      const H = canvas.height / devicePixelRatio;
      for (const p of particles) {
        p.y -= p.speed;
        if (p.y < -1) p.y = 101;
        const px = (p.x / 100) * W;
        const py = (p.y / 100) * H;
        const alpha = p.alpha * (0.7 + 0.3 * Math.sin(t * 0.02 + p.x));
        ctx.beginPath();
        ctx.arc(px, py, p.r * devicePixelRatio, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167,139,250,${alpha})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

/* ─── Feature card with 3D tilt ────────────────────────────────────── */
const FEATURES = [
  { icon: "⏱", title: "Pomodoro Timer", desc: "AI-powered focus blocks that adapt to your flow state. Beat distractions, build habits.", from: "#7c3aed22", border: "rgba(124,58,237,0.25)", glow: "rgba(124,58,237,0.15)" },
  { icon: "🧠", title: "AI Coach", desc: "Your personal study coach powered by AI. Get real-time tips, roadmaps and motivation.", from: "#e879f922", border: "rgba(232,121,249,0.25)", glow: "rgba(232,121,249,0.15)" },
  { icon: "📸", title: "Webcam Attention", desc: "MediaPipe tracks your focus live. The app knows when you drift — and brings you back.", from: "#06b6d422", border: "rgba(6,182,212,0.25)", glow: "rgba(6,182,212,0.15)" },
  { icon: "🏆", title: "Gamification", desc: "XP, coins, badges, streaks and leaderboards. Turn your study sessions into an epic quest.", from: "#f59e0b22", border: "rgba(245,158,11,0.25)", glow: "rgba(245,158,11,0.15)" },
  { icon: "📊", title: "Deep Analytics", desc: "Session history, productivity scores, streak graphs and AI-powered insights.", from: "#10b98122", border: "rgba(16,185,129,0.25)", glow: "rgba(16,185,129,0.15)" },
  { icon: "🌐", title: "Study Rooms", desc: "Live collaborative focus sessions. Study alongside thousands worldwide.", from: "#f43f5e22", border: "rgba(244,63,94,0.25)", glow: "rgba(244,63,94,0.15)" },
];

const STATS = [
  { value: "50K+", label: "Active Learners" },
  { value: "2.4M", label: "Sessions Completed" },
  { value: "98%", label: "Focus Improvement" },
  { value: "4.9★", label: "User Rating" },
];

const WORDS = ["Focus", "Flow", "Mastery", "Success"];

function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI(n => (n + 1) % WORDS.length), 2400);
    return () => clearInterval(id);
  }, []);
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={i}
        initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -24, filter: "blur(8px)" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="inline-block bg-gradient-to-r from-[#e879f9] via-[#a78bfa] to-[#7c3aed] bg-clip-text text-transparent"
      >
        {WORDS[i]}
      </motion.span>
    </AnimatePresence>
  );
}

function FeatureCard({ feat, index }: { feat: typeof FEATURES[0]; index: number }) {
  const [hovered, setHovered] = useState(false);
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setRot({
      x: ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * 7,
      y: -((e.clientX - r.left - r.width / 2) / (r.width / 2)) * 7,
    });
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseMove={onMove}
      onMouseLeave={() => { setHovered(false); setRot({ x: 0, y: 0 }); }}
      style={{
        transform: hovered
          ? `perspective(700px) rotateX(${rot.x}deg) rotateY(${rot.y}deg) scale(1.035) translateZ(10px)`
          : "perspective(700px) rotateX(0) rotateY(0) scale(1) translateZ(0)",
        transition: hovered ? "transform 0.08s ease-out" : "transform 0.4s ease-out",
        boxShadow: hovered ? `0 20px 60px ${feat.glow}` : "none",
      }}
      className="relative overflow-hidden rounded-2xl p-6 backdrop-blur-sm cursor-pointer"
      data-cursor-hover
    >
      <div className="absolute inset-0 rounded-2xl" style={{ background: feat.from, border: `1px solid ${feat.border}` }} />
      {hovered && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-60"
          style={{ background: `radial-gradient(circle at 40% 30%, ${feat.glow}, transparent 70%)` }} />
      )}
      <div className="relative z-10">
        <div className="mb-3 text-3xl">{feat.icon}</div>
        <h3 className="mb-2 text-[15px] font-bold text-white">{feat.title}</h3>
        <p className="text-[13px] leading-relaxed text-[#6b7280]">{feat.desc}</p>
        <motion.div
          className="mt-4 h-[2px] rounded-full"
          style={{ background: `linear-gradient(90deg, ${feat.border}, transparent)` }}
          animate={{ width: hovered ? "100%" : "0%" }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </motion.div>
  );
}

/* ─── Main Landing Page ─────────────────────────────────────────────── */
export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.6, y: 0.5 });

  const { scrollYProgress } = useScroll({ target: containerRef });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.22], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.22], [0, -60]);
  const springY = useSpring(heroY, { stiffness: 80, damping: 25 });

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    mouseRef.current = {
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    };
  }, []);

  useOrb(canvasRef, mouseRef);

  return (
    <div
      ref={containerRef}
      onMouseMove={onMouseMove}
      className="relative min-h-screen overflow-x-hidden bg-[#030308] text-white select-none"
      style={{ cursor: "none" }}
    >
      {/* ── NAV ── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className={`fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4 transition-all duration-300 ${scrolled ? "border-b border-white/5 bg-[#030308]/80 backdrop-blur-2xl" : ""}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#e879f9] shadow-lg shadow-purple-900/40">
            <svg viewBox="0 0 24 24" fill="white" className="h-4 w-4"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#e879f9] opacity-60 blur-md" />
          </div>
          <span className="text-[15px] font-bold tracking-tight">FocusArx</span>
        </div>
        <div className="hidden sm:flex items-center gap-7 text-sm text-[#6b7280]">
          {[["#features", "Features"], ["#stats", "Stats"], ["/pricing", "Pricing"]].map(([href, label]) => (
            href.startsWith("/") ? (
              <Link key={label} href={href} className="transition-colors hover:text-white">{label}</Link>
            ) : (
              <a key={label} href={href} className="transition-colors hover:text-white">{label}</a>
            )
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10">
              Sign In
            </motion.button>
          </Link>
          <Link href="/signup">
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 0 30px 8px rgba(124,58,237,0.4)" }}
              whileTap={{ scale: 0.97 }}
              className="rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#e879f9] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-900/30">
              Get Started
            </motion.button>
          </Link>
        </div>
      </motion.nav>

      {/* ── HERO ── */}
      <section className="relative flex min-h-screen items-center overflow-hidden pt-16">
        {/* Main canvas (orb + constellation) */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* Gradient fade */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-[#030308] via-[#030308]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#030308]/40 via-transparent to-[#030308]" />
        </div>

        {/* Hero text */}
        <motion.div
          style={{ opacity: heroOpacity, y: springY }}
          className="relative z-10 ml-6 sm:ml-14 lg:ml-24 max-w-xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-purple-300 backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400" />
            AI-Powered Deep Work OS
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mb-5 text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.04] tracking-tight"
          >
            Build Deep
            <br />
            <RotatingWord />
            <br />
            <span className="text-white/90 text-4xl sm:text-5xl lg:text-6xl">Like Never Before</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="mb-8 text-base leading-relaxed text-[#6b7280]"
          >
            FocusArx combines Pomodoro timers, webcam attention tracking, AI coaching,
            and gamification to turn every study session into a superpower.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-wrap gap-4"
          >
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.06, boxShadow: "0 0 50px 12px rgba(124,58,237,0.45)" }}
                whileTap={{ scale: 0.97 }}
                className="group relative flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#7c3aed] to-[#e879f9] px-8 py-3.5 text-[15px] font-bold text-white shadow-2xl shadow-purple-900/50"
                data-cursor-hover
              >
                <span className="relative z-10">→ Start Focusing Free</span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </motion.button>
            </Link>
            <Link href="/login">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-8 py-3.5 text-[15px] font-semibold text-[#a78bfa] backdrop-blur-sm"
                data-cursor-hover
              >
                View More
              </motion.button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
        >
          <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#2a2d3a]">Scroll</span>
          <div className="h-9 w-px overflow-hidden rounded-full bg-[#13161e]">
            <motion.div
              className="h-4 w-full rounded-full bg-gradient-to-b from-[#7c3aed] to-transparent"
              animate={{ y: ["-100%", "250%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </motion.div>

        {/* Feature ticker */}
        <div className="absolute bottom-0 inset-x-0 z-10 border-t border-white/[0.04] bg-black/50 backdrop-blur-xl overflow-hidden">
          <div className="flex" style={{ animation: "marquee 28s linear infinite" }}>
            {["AI AGENTS", "POMODORO TIMER", "WEBCAM FOCUS", "GAMIFICATION", "STUDY ROOMS", "LEADERBOARD", "AI COACHING", "DEEP ANALYTICS", "HABIT TRACKING", "MISSIONS"].flatMap((item, i) => [
              <span key={i} className="inline-flex items-center shrink-0 gap-3 px-8 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#3a3f52] whitespace-nowrap">{item}</span>,
              <span key={`d${i}`} className="text-[#1e2130] shrink-0 self-center">×</span>
            ])}
            {["AI AGENTS", "POMODORO TIMER", "WEBCAM FOCUS", "GAMIFICATION", "STUDY ROOMS", "LEADERBOARD", "AI COACHING", "DEEP ANALYTICS", "HABIT TRACKING", "MISSIONS"].flatMap((item, i) => [
              <span key={`b${i}`} className="inline-flex items-center shrink-0 gap-3 px-8 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#3a3f52] whitespace-nowrap">{item}</span>,
              <span key={`bd${i}`} className="text-[#1e2130] shrink-0 self-center">×</span>
            ])}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section id="stats" className="relative z-10 py-20">
        <ParticlesBg />
        <div className="relative mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {STATS.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.09 }}
                whileHover={{ scale: 1.04, boxShadow: "0 0 40px 4px rgba(124,58,237,0.2)" }}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 text-center backdrop-blur-sm"
                data-cursor-hover
              >
                <span className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-[#a78bfa] to-[#e879f9] bg-clip-text text-transparent">{s.value}</span>
                <span className="text-[11px] text-[#4b5563] font-semibold uppercase tracking-wider">{s.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="relative z-10 py-16 pb-24">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="mb-12 text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-purple-300">
              Everything you need
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
              Your complete{" "}
              <span className="bg-gradient-to-r from-[#a78bfa] to-[#e879f9] bg-clip-text text-transparent">Focus OS</span>
            </h2>
            <p className="mt-3 text-sm text-[#4b5563] max-w-lg mx-auto">Sign up to unlock all features — it's completely free to start.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feat, i) => <FeatureCard key={i} feat={feat} index={i} />)}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 py-28 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full" style={{ background: "radial-gradient(circle, rgba(124,58,237,0.16), transparent 70%)", filter: "blur(60px)" }} />
          <div className="absolute left-1/3 top-1/2 -translate-y-1/2 h-[350px] w-[350px] rounded-full" style={{ background: "radial-gradient(circle, rgba(232,121,249,0.1), transparent 70%)", filter: "blur(40px)" }} />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mx-auto max-w-2xl px-6 text-center"
        >
          <h2 className="mb-5 text-4xl sm:text-6xl font-black tracking-tight">
            Ready to enter
            <br />
            <span className="bg-gradient-to-r from-[#7c3aed] via-[#a78bfa] to-[#e879f9] bg-clip-text text-transparent">deep focus?</span>
          </h2>
          <p className="mb-10 text-[#4b5563] text-base">Join thousands of learners already mastering their craft with FocusArx.</p>
          <Link href="/signup">
            <motion.button
              whileHover={{ scale: 1.06, boxShadow: "0 0 70px 14px rgba(124,58,237,0.5)" }}
              whileTap={{ scale: 0.97 }}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#7c3aed] to-[#e879f9] px-10 py-4 text-lg font-bold text-white shadow-2xl shadow-purple-900/50"
              data-cursor-hover
            >
              <span className="relative z-10">→ Create Free Account</span>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </motion.button>
          </Link>
          <p className="mt-4 text-xs text-[#2a2d3a]">No credit card required · Free forever</p>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-white/[0.04] py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#374151]">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-[#7c3aed] to-[#e879f9]">
              <svg viewBox="0 0 24 24" fill="white" className="h-3 w-3"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span className="font-semibold text-[#4b5563]">FocusArx</span>
            <span>© 2025</span>
          </div>
          <div className="flex gap-5">
            {["/privacy", "/terms", "/pricing"].map((href, i) => (
              <Link key={i} href={href} className="hover:text-[#a78bfa] transition-colors capitalize">{href.slice(1)}</Link>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
}
