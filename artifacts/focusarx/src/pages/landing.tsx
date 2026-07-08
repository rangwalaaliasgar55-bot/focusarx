import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { ChevronDown } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

/* ─── Canvas Orb + Constellation ─────────────────────────────────── */
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

    for (let i = 0; i < 80; i++) {
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
          if (d < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(124,58,237,${0.2 * (1 - d / 130)})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
        const dx = nodes[i].x - mx;
        const dy = nodes[i].y - my;
        const distToMouse = Math.sqrt(dx * dx + dy * dy);
        const bright = distToMouse < 180 ? 0.9 : 0.35;
        ctx.beginPath();
        ctx.arc(nodes[i].x, nodes[i].y, distToMouse < 180 ? 2.2 : 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167,139,250,${bright})`;
        ctx.fill();
      }

      const cx = W * 0.62 + Math.sin(t * 0.8) * 18 + (mx - W * 0.5) * 0.04;
      const cy = H * 0.5 + Math.cos(t * 0.6) * 12 + (my - H * 0.5) * 0.03;
      const r = Math.min(W, H) * 0.2 + Math.sin(t * 1.2) * 8;

      for (const [rMult, alpha] of [[3.2, 0.025], [2.4, 0.05], [1.7, 0.09], [1.2, 0.16]] as [number, number][]) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * rMult);
        g.addColorStop(0, `rgba(124,58,237,${alpha})`);
        g.addColorStop(0.5, `rgba(167,139,250,${alpha * 0.4})`);
        g.addColorStop(1, "rgba(124,58,237,0)");
        ctx.beginPath();
        ctx.arc(cx, cy, r * rMult, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      const coreGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
      coreGrad.addColorStop(0, "rgba(220,190,255,0.97)");
      coreGrad.addColorStop(0.3, "rgba(139,92,246,0.92)");
      coreGrad.addColorStop(0.65, "rgba(109,40,217,0.85)");
      coreGrad.addColorStop(1, "rgba(67,20,180,0.78)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      for (let ring = 0; ring < 4; ring++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * (0.25 + ring * 0.08) + ring * 0.7);
        ctx.scale(1, Math.sin((ring / 4) * Math.PI + t * 0.18) * 0.4 + 0.12);
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.88 + ring * 0.14), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(167,139,250,${0.16 - ring * 0.03})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }

      const hl = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 0, cx - r * 0.2, cy - r * 0.2, r * 0.5);
      hl.addColorStop(0, "rgba(255,255,255,0.28)");
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
    const particles: { x: number; y: number; r: number; alpha: number; speed: number; hue: number }[] = [];
    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 130; i++) {
      particles.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        r: Math.random() * 1.8 + 0.3,
        alpha: Math.random() * 0.55 + 0.1,
        speed: Math.random() * 0.014 + 0.003,
        hue: Math.random() > 0.6 ? 280 : Math.random() > 0.5 ? 240 : 300,
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
        const alpha = p.alpha * (0.65 + 0.35 * Math.sin(t * 0.02 + p.x));
        ctx.beginPath();
        ctx.arc(px, py, p.r * devicePixelRatio, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},70%,75%,${alpha})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

/* ─── Feature card ────────────────────────────────────────────────── */
const FEATURES = [
  { icon: "⏱", title: "AI-Powered Timer", desc: "Pomodoro sessions that adapt to your flow state. Beat distractions, build habits, track every second.", from: "#7c3aed22", border: "rgba(124,58,237,0.28)", glow: "rgba(124,58,237,0.18)" },
  { icon: "🧠", title: "AI Coach", desc: "Your personal productivity coach. Get real-time tips, AI roadmaps, and motivational coaching when you need it most.", from: "#e879f922", border: "rgba(232,121,249,0.28)", glow: "rgba(232,121,249,0.18)" },
  { icon: "📸", title: "Webcam Attention", desc: "MediaPipe tracks your focus live. The app detects when you drift — and brings you back before you lose momentum.", from: "#06b6d422", border: "rgba(6,182,212,0.28)", glow: "rgba(6,182,212,0.18)" },
  { icon: "🏆", title: "Gamification", desc: "XP, coins, badges, daily missions, and leaderboards. Turn every study session into an epic quest.", from: "#f59e0b22", border: "rgba(245,158,11,0.28)", glow: "rgba(245,158,11,0.18)" },
  { icon: "📊", title: "Deep Analytics", desc: "Session history, Focus DNA, productivity scores, streak graphs and AI-powered weekly insights.", from: "#10b98122", border: "rgba(16,185,129,0.28)", glow: "rgba(16,185,129,0.18)" },
  { icon: "🌐", title: "Study Rooms", desc: "Live collaborative focus sessions. Study alongside thousands of learners worldwide in real time.", from: "#f43f5e22", border: "rgba(244,63,94,0.28)", glow: "rgba(244,63,94,0.18)" },
  { icon: "🎯", title: "Daily Missions", desc: "22 rotating daily and weekly missions that push you just beyond your comfort zone — every single day.", from: "#8b5cf622", border: "rgba(139,92,246,0.28)", glow: "rgba(139,92,246,0.18)" },
  { icon: "🌱", title: "Focus Pet", desc: "A virtual companion that grows with your consistency. Miss sessions — your pet suffers. Stay focused — it thrives.", from: "#22d38722", border: "rgba(34,211,135,0.28)", glow: "rgba(34,211,135,0.18)" },
  { icon: "🔥", title: "Habit Engine", desc: "Build and track focus habits with streak tracking, freeze tokens, and a powerful daily review system.", from: "#f9731622", border: "rgba(249,115,22,0.28)", glow: "rgba(249,115,22,0.18)" },
];

const STATS = [
  { value: "50K+", label: "Active Learners" },
  { value: "2.4M", label: "Sessions Completed" },
  { value: "98%", label: "Focus Improvement" },
  { value: "4.9★", label: "User Rating" },
];

const WORDS = ["Focus", "Flow", "Mastery", "Depth", "Success"];

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
        initial={{ opacity: 0, y: 28, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -28, filter: "blur(10px)" }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
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
      x: ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * 8,
      y: -((e.clientX - r.left - r.width / 2) / (r.width / 2)) * 8,
    });
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 44 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.65, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseMove={onMove}
      onMouseLeave={() => { setHovered(false); setRot({ x: 0, y: 0 }); }}
      style={{
        transform: hovered
          ? `perspective(700px) rotateX(${rot.x}deg) rotateY(${rot.y}deg) scale(1.04) translateZ(12px)`
          : "perspective(700px) rotateX(0) rotateY(0) scale(1) translateZ(0)",
        transition: hovered ? "transform 0.07s ease-out" : "transform 0.45s ease-out",
        boxShadow: hovered ? `0 24px 64px ${feat.glow}, 0 0 0 1px ${feat.border}` : "none",
      }}
      className="relative overflow-hidden rounded-2xl p-6 backdrop-blur-sm cursor-pointer"
      data-cursor-hover
    >
      <div className="absolute inset-0 rounded-2xl" style={{ background: feat.from, border: `1px solid ${feat.border}` }} />
      {hovered && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-70"
          style={{ background: `radial-gradient(circle at 40% 30%, ${feat.glow}, transparent 65%)` }} />
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

/* ─── Testimonials ─────────────────────────────────────────────────── */
const TESTIMONIALS = [
  { name: "Alex K.", role: "Computer Science Student", avatar: "AK", text: "FocusArx completely changed how I study. The Focus Score keeps me honest — I can't fake a good session anymore. My GPA went up a full point in one semester.", stars: 5, gradient: "from-violet-600 to-purple-700" },
  { name: "Sarah M.", role: "Indie Developer", avatar: "SM", text: "I've tried every Pomodoro app out there. Nothing comes close to FocusArx. The gamification actually works — I get excited to sit down and code every morning.", stars: 5, gradient: "from-pink-600 to-rose-700" },
  { name: "James L.", role: "Medical Student", avatar: "JL", text: "The AI Coach is genuinely helpful, not just filler text. It noticed my focus drops after 3pm and now I schedule hard content in the morning. Game changer.", stars: 5, gradient: "from-blue-600 to-indigo-700" },
  { name: "Priya N.", role: "UX Designer", avatar: "PN", text: "Study Rooms feature is incredible. I have a virtual study group of 20 people and we all hold each other accountable. It feels like a library but better.", stars: 5, gradient: "from-emerald-600 to-teal-700" },
  { name: "Marcus T.", role: "PhD Researcher", avatar: "MT", text: "The analytics are insane — I can literally see my focus patterns over 6 months. Found out I'm most productive on Wednesday mornings. Optimised my entire schedule around it.", stars: 5, gradient: "from-amber-600 to-orange-700" },
  { name: "Yuki H.", role: "High School Student", avatar: "YH", text: "My friends thought I was exaggerating when I said an app changed my life. Then they tried it. We now compete on the leaderboard every day — studying has never been this fun.", stars: 5, gradient: "from-cyan-600 to-sky-700" },
];

function TestimonialCard({ t, index }: { t: typeof TESTIMONIALS[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay: index * 0.07 }}
      whileHover={{ y: -4, boxShadow: "0 20px 60px rgba(124,58,237,0.15)" }}
      className="flex flex-col gap-4 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] p-6 backdrop-blur-sm"
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${t.gradient} text-xs font-bold text-white shadow-lg`}>
          {t.avatar}
        </div>
        <div>
          <p className="text-sm font-bold text-[#E2E8F0]">{t.name}</p>
          <p className="text-xs text-[#4b5563]">{t.role}</p>
        </div>
        <div className="ml-auto flex gap-0.5">
          {Array.from({ length: t.stars }).map((_, i) => (
            <span key={i} className="text-amber-400 text-sm">★</span>
          ))}
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-[#6b7280] italic">"{t.text}"</p>
    </motion.div>
  );
}

/* ─── FAQ ──────────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  { q: "Is FocusArx really free?", a: "Yes — completely free to use. Core features including the timer, missions, gamification, AI coaching, analytics, study rooms, and habit tracking cost nothing. Premium is an optional upgrade for power users who want XP multipliers and exclusive content." },
  { q: "Do I need a webcam to use FocusArx?", a: "No. The webcam attention feature is entirely optional and never stores any video. If you enable it, MediaPipe runs entirely on-device. You'll get a great experience with or without webcam tracking." },
  { q: "How does the Focus Score work?", a: "Your Focus Score (0–100) is calculated after each session based on session completion, attention consistency (if webcam is on), distraction events, and lock mode. It's the truest measure of real deep work quality — not just time logged." },
  { q: "Can I use FocusArx on mobile?", a: "Yes! FocusArx is a Progressive Web App (PWA) that works on all mobile browsers. Add it to your home screen for a native-like experience. All features — timer, missions, social, AI coach — work on mobile." },
  { q: "How does the AI Coach work?", a: "The AI Coach is powered by large language models (with local fallbacks when offline). It analyses your session data, study patterns, and goals to provide personalised advice, generate study roadmaps, and offer real-time motivational support." },
  { q: "Is my data private and secure?", a: "Your data is encrypted in transit and at rest. Webcam data never leaves your device. You can delete your account and all associated data at any time from your profile settings. See our Privacy Policy for full details." },
  { q: "What happens to my streaks if I miss a day?", a: "Your streak resets but your total XP, level, and session history are preserved. Freeze Tokens (earnable via missions) let you protect streaks across up to 3 days of absence. Consistency matters more than perfection." },
];

function FaqAccordion({ items }: { items: typeof FAQ_ITEMS }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-2xl border border-[rgba(124,58,237,0.15)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between px-5 py-4 text-left gap-4 group"
          >
            <span className={`text-sm font-semibold transition-colors ${open === i ? "text-[#A78BFA]" : "text-[#E2E8F0] group-hover:text-[#A78BFA]"}`}>{item.q}</span>
            <motion.div animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration: 0.22 }}>
              <ChevronDown size={16} className="shrink-0 text-[#4B5563]" />
            </motion.div>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <p className="px-5 pb-5 text-sm leading-relaxed text-[#94A3B8]">{item.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
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
      <PageSEO {...PAGE_SEO.home} />
      {/* Cursor glow */}
      <CursorGlow mouseRef={mouseRef} />

      {/* ── NAV ── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className={`fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4 transition-all duration-300 ${scrolled ? "border-b border-white/5 bg-[#030308]/85 backdrop-blur-2xl" : ""}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#e879f9] shadow-lg shadow-purple-900/40">
            <svg viewBox="0 0 24 24" fill="white" className="h-4 w-4"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#e879f9] opacity-60 blur-md" />
          </div>
          <span className="text-[15px] font-bold tracking-tight">FocusArx</span>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-sm text-[#6b7280]">
          {[["#features", "Features"], ["#testimonials", "Reviews"], ["#faq", "FAQ"], ["/pricing", "Pricing"]].map(([href, label]) => (
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
              Get Started Free
            </motion.button>
          </Link>
        </div>
      </motion.nav>

      {/* ── HERO ── */}
      <section className="relative flex min-h-screen items-center overflow-hidden pt-16">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-[#030308] via-[#030308]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#030308]/40 via-transparent to-[#030308]" />
        </div>

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
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mb-5 text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.04] tracking-tight"
          >
            Build Deep
            <br />
            <RotatingWord />
            <br />
            <span className="text-white/90 text-4xl sm:text-5xl lg:text-6xl">Like Never Before</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.36 }}
            className="mb-8 text-base leading-relaxed text-[#6b7280]"
          >
            FocusArx combines Pomodoro timers, webcam attention tracking, AI coaching,
            and gamification to turn every study session into a superpower.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.52 }}
            className="flex flex-wrap gap-4"
          >
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.06, boxShadow: "0 0 55px 14px rgba(124,58,237,0.48)" }}
                whileTap={{ scale: 0.97 }}
                className="group relative flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#7c3aed] to-[#e879f9] px-8 py-3.5 text-[15px] font-bold text-white shadow-2xl shadow-purple-900/50"
                data-cursor-hover
              >
                <span className="relative z-10">→ Start Focusing Free</span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </motion.button>
            </Link>
            <a href="#features">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-8 py-3.5 text-[15px] font-semibold text-[#a78bfa] backdrop-blur-sm"
                data-cursor-hover
              >
                See Features ↓
              </motion.button>
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-8 flex items-center gap-4"
          >
            <div className="flex -space-x-2">
              {["AK","SM","JL","PN","MT"].map((init, i) => (
                <div key={i} className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#030308] text-[10px] font-bold text-white ${["bg-violet-600","bg-pink-600","bg-blue-600","bg-emerald-600","bg-amber-600"][i]}`}>{init}</div>
              ))}
            </div>
            <p className="text-xs text-[#4b5563]"><span className="font-bold text-[#94A3B8]">50,000+</span> learners already building deep focus</p>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
        >
          <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#2a2d3a]">Scroll</span>
          <div className="h-10 w-px overflow-hidden rounded-full bg-[#13161e]">
            <motion.div
              className="h-4 w-full rounded-full bg-gradient-to-b from-[#7c3aed] to-transparent"
              animate={{ y: ["-100%", "300%"] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </motion.div>

        {/* Feature ticker */}
        <div className="absolute bottom-0 inset-x-0 z-10 border-t border-white/[0.04] bg-black/50 backdrop-blur-xl overflow-hidden">
          <div className="flex" style={{ animation: "marquee 30s linear infinite" }}>
            {["AI COACH", "POMODORO TIMER", "WEBCAM FOCUS", "GAMIFICATION", "STUDY ROOMS", "LEADERBOARD", "HABIT ENGINE", "DEEP ANALYTICS", "MISSIONS", "FOCUS DNA", "BATTLE PASS", "AI ROADMAP"].flatMap((item, i) => [
              <span key={i} className="inline-flex items-center shrink-0 gap-3 px-8 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#3a3f52] whitespace-nowrap">{item}</span>,
              <span key={`d${i}`} className="text-[rgba(255,255,255,0.12)] shrink-0 self-center">×</span>
            ])}
            {["AI COACH", "POMODORO TIMER", "WEBCAM FOCUS", "GAMIFICATION", "STUDY ROOMS", "LEADERBOARD", "HABIT ENGINE", "DEEP ANALYTICS", "MISSIONS", "FOCUS DNA", "BATTLE PASS", "AI ROADMAP"].flatMap((item, i) => [
              <span key={`b${i}`} className="inline-flex items-center shrink-0 gap-3 px-8 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#3a3f52] whitespace-nowrap">{item}</span>,
              <span key={`bd${i}`} className="text-[rgba(255,255,255,0.12)] shrink-0 self-center">×</span>
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
                initial={{ opacity: 0, scale: 0.82 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ scale: 1.05, boxShadow: "0 0 40px 4px rgba(124,58,237,0.22)" }}
                className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 text-center backdrop-blur-sm"
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
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="mb-14 text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-purple-300">
              Everything you need
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
              Your complete{" "}
              <span className="bg-gradient-to-r from-[#a78bfa] to-[#e879f9] bg-clip-text text-transparent">Focus OS</span>
            </h2>
            <p className="mt-3 text-sm text-[#4b5563] max-w-lg mx-auto">Nine powerful tools working together to build your deepest focus habit.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feat, i) => <FeatureCard key={i} feat={feat} index={i} />)}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="relative z-10 py-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full" style={{ background: "radial-gradient(circle, rgba(124,58,237,0.08), transparent 70%)", filter: "blur(80px)" }} />
        </div>
        <div className="relative mx-auto max-w-5xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="mb-14 text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-purple-300">
              Simple to start
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight">How FocusArx Works</h2>
          </motion.div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Create your account", desc: "Sign up free in 30 seconds. No credit card, no commitments. Start your first session immediately.", emoji: "⚡" },
              { step: "02", title: "Start a focus session", desc: "Choose your session type, set a task, and hit start. The timer tracks your deep work in real time.", emoji: "🎯" },
              { step: "03", title: "Level up & build habits", desc: "Earn XP, unlock badges, build streaks. Let gamification make deep work your default mode.", emoji: "🚀" },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.12 }}
                className="relative rounded-2xl border border-[rgba(124,58,237,0.15)] bg-[rgba(255,255,255,0.02)] p-6"
              >
                <div className="mb-4 text-3xl">{step.emoji}</div>
                <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#4B5563]">Step {step.step}</div>
                <h3 className="mb-2 font-bold text-[#E2E8F0]">{step.title}</h3>
                <p className="text-sm leading-relaxed text-[#6b7280]">{step.desc}</p>
                {i < 2 && (
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 hidden sm:flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.1)] text-[10px] font-bold text-[#a78bfa] z-10">→</div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" className="relative z-10 py-20">
        <ParticlesBg />
        <div className="relative mx-auto max-w-6xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="mb-14 text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-300">
              ★★★★★ Loved by learners
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
              Real people,{" "}
              <span className="bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] bg-clip-text text-transparent">real results</span>
            </h2>
            <p className="mt-3 text-sm text-[#4b5563] max-w-lg mx-auto">Over 50,000 students, developers and researchers have built their focus habit with FocusArx.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t, i) => <TestimonialCard key={i} t={t} index={i} />)}
          </div>
        </div>
      </section>

      {/* ── PRICING TEASER ── */}
      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="mb-12 text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-purple-300">
              Simple Pricing
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight">Start free. <span className="bg-gradient-to-r from-[#a78bfa] to-[#e879f9] bg-clip-text text-transparent">Go premium when ready.</span></h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[
              {
                name: "Free", price: "$0", period: "forever", tag: null,
                features: ["Unlimited focus sessions", "Full gamification (XP, badges, missions)", "AI Coach", "Study Rooms", "Analytics dashboard", "Habit tracking", "Leaderboard"],
                cta: "Get Started Free", href: "/signup", accent: "border-[rgba(124,58,237,0.25)]", btn: "bg-[rgba(124,58,237,0.2)] text-[#A78BFA] hover:bg-[rgba(124,58,237,0.35)]"
              },
              {
                name: "Premium", price: "$7", period: "per month", tag: "Most Popular",
                features: ["Everything in Free", "2× XP multiplier", "Exclusive premium themes", "Priority AI coaching", "Advanced analytics", "Streak freeze upgrades", "Early access to new features"],
                cta: "Start Premium Trial", href: "/pricing", accent: "border-[rgba(232,121,249,0.4)] bg-gradient-to-br from-[rgba(124,58,237,0.1)] to-[rgba(232,121,249,0.05)]", btn: "bg-gradient-to-r from-[#7c3aed] to-[#e879f9] text-white shadow-lg"
              }
            ].map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className={`relative rounded-2xl border p-6 ${plan.accent}`}
              >
                {plan.tag && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#7c3aed] to-[#e879f9] px-3 py-1 text-[10px] font-bold text-white">{plan.tag}</div>
                )}
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#4B5563] mb-1">{plan.name}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-black text-[#E2E8F0]">{plan.price}</span>
                    <span className="text-sm text-[#4b5563] mb-1">/{plan.period}</span>
                  </div>
                </div>
                <ul className="mb-6 space-y-2">
                  {plan.features.map((f, fi) => (
                    <li key={fi} className="flex items-center gap-2 text-sm text-[#94A3B8]">
                      <span className="text-emerald-400 text-xs">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href}>
                  <motion.button
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className={`w-full rounded-xl py-2.5 text-sm font-bold transition-all ${plan.btn}`}
                  >
                    {plan.cta}
                  </motion.button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="relative z-10 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="mb-12 text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-purple-300">
              FAQ
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight">Frequently asked questions</h2>
            <p className="mt-3 text-sm text-[#4b5563]">Everything you need to know before getting started.</p>
          </motion.div>
          <FaqAccordion items={FAQ_ITEMS} />
          <div className="mt-8 text-center">
            <p className="text-sm text-[#4b5563] mb-3">Still have questions?</p>
            <Link href="/support">
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                className="rounded-xl border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.1)] px-6 py-2.5 text-sm font-semibold text-[#A78BFA]"
              >
                Visit Support Center →
              </motion.button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 py-28 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[700px] w-[700px] rounded-full" style={{ background: "radial-gradient(circle, rgba(124,58,237,0.18), transparent 70%)", filter: "blur(70px)" }} />
          <div className="absolute left-1/3 top-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full" style={{ background: "radial-gradient(circle, rgba(232,121,249,0.1), transparent 70%)", filter: "blur(50px)" }} />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 42 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.85 }}
          className="mx-auto max-w-2xl px-6 text-center"
        >
          <h2 className="mb-5 text-4xl sm:text-6xl font-black tracking-tight">
            Ready to enter
            <br />
            <span className="bg-gradient-to-r from-[#7c3aed] via-[#a78bfa] to-[#e879f9] bg-clip-text text-transparent">deep focus?</span>
          </h2>
          <p className="mb-10 text-[#4b5563] text-base">Join over 50,000 learners already mastering their craft with FocusArx.</p>
          <Link href="/signup">
            <motion.button
              whileHover={{ scale: 1.06, boxShadow: "0 0 75px 16px rgba(124,58,237,0.52)" }}
              whileTap={{ scale: 0.97 }}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#7c3aed] to-[#e879f9] px-10 py-4 text-lg font-bold text-white shadow-2xl shadow-purple-900/50"
              data-cursor-hover
            >
              <span className="relative z-10">→ Create Free Account</span>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </motion.button>
          </Link>
          <p className="mt-4 text-xs text-[#2a2d3a]">No credit card required · Free forever · Cancel anytime</p>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-white/[0.05] bg-[#030308]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#e879f9]">
                  <svg viewBox="0 0 24 24" fill="white" className="h-4 w-4"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <span className="font-bold text-[#E2E8F0]">FocusArx</span>
              </div>
              <p className="text-xs leading-relaxed text-[#374151]">An AI-powered deep work OS that turns every study session into measurable progress.</p>
              <p className="mt-3 text-xs text-[#2a2d3a]">© 2025 FocusArx. All rights reserved.</p>
            </div>
            {/* Product */}
            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#374151]">Product</p>
              <ul className="space-y-2.5">
                {[["/","Timer"], ["/dashboard","Dashboard"], ["/missions","Missions"], ["/leaderboard","Leaderboard"], ["/pricing","Pricing"]].map(([href, label]) => (
                  <li key={href}><Link href={href} className="text-xs text-[#2d3448] hover:text-[#a78bfa] transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
            {/* Company */}
            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#374151]">Company</p>
              <ul className="space-y-2.5">
                {[["/about","About Us"], ["/contact","Contact"], ["/support","Support"], ["/refund","Refund Policy"]].map(([href, label]) => (
                  <li key={href}><Link href={href} className="text-xs text-[#2d3448] hover:text-[#a78bfa] transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
            {/* Legal */}
            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#374151]">Legal</p>
              <ul className="space-y-2.5">
                {[["/privacy","Privacy Policy"], ["/terms","Terms of Service"], ["/cookie-policy","Cookie Policy"], ["/ai-policy","AI Policy"], ["/acceptable-use","Acceptable Use"], ["/data-deletion","Data Deletion"]].map(([href, label]) => (
                  <li key={href}><Link href={href} className="text-xs text-[#2d3448] hover:text-[#a78bfa] transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-white/[0.04] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[rgba(255,255,255,0.12)]">
            <span>Built with ❤️ for learners worldwide</span>
            <div className="flex gap-5">
              {[["/focus-guide","Focus Guide"], ["/pomodoro-guide","Pomodoro Guide"], ["/study-techniques","Study Techniques"]].map(([href, label]) => (
                <Link key={href} href={href} className="hover:text-[#4b5563] transition-colors">{label}</Link>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
}

/* ─── Cursor glow effect ───────────────────────────────────────────── */
function CursorGlow({ mouseRef }: { mouseRef: React.RefObject<{ x: number; y: number }> }) {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  useEffect(() => {
    const id = setInterval(() => {
      if (mouseRef.current) {
        setPos({ x: mouseRef.current.x * window.innerWidth, y: mouseRef.current.y * window.innerHeight });
      }
    }, 16);
    return () => clearInterval(id);
  }, [mouseRef]);
  return (
    <div
      className="pointer-events-none fixed z-[9999] mix-blend-screen"
      style={{
        left: pos.x - 12, top: pos.y - 12, width: 24, height: 24,
        background: "radial-gradient(circle, rgba(167,139,250,0.9), transparent 70%)",
        borderRadius: "50%",
        transition: "left 0.04s linear, top 0.04s linear",
      }}
    />
  );
}
