import { useEffect, useRef, useState, useCallback, Suspense, lazy } from "react";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { ChevronDown, Sparkles, Target, Zap, Shield, Trophy, Users, BarChart3, Rocket, MessageSquare, CheckCircle2, Star, ArrowRight, ShieldCheck, Lock, RefreshCw } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
const Hero3D = lazy(() => import("@/components/Hero3D"));
import ProductivityResume from "@/components/ProductivityResume";

/* ─── Feature Card ────────────────────────────────────────────────── */
const FEATURES = [
  { icon: <Target className="text-purple-400" />, title: "Precision Timer", desc: "Adaptive Pomodoro sessions that sync with your brain's natural rhythms.", from: "#7c3aed22", border: "rgba(124,58,237,0.28)", glow: "rgba(124,58,237,0.18)" },
  { icon: <Zap className="text-emerald-400" />, title: "AI Coaching", desc: "Personalized focus tips and productivity roadmaps generated in real-time.", from: "#10b98122", border: "rgba(16,185,129,0.28)", glow: "rgba(16,185,129,0.18)" },
  { icon: <BarChart3 className="text-blue-400" />, title: "Deep Analytics", desc: "Visualize your Focus DNA and stability scores with lab-grade precision.", from: "#60a5fa22", border: "rgba(96,165,250,0.28)", glow: "rgba(96,165,250,0.18)" },
];

const STATS = [
  { value: "4", label: "Focus Session Types" },
  { value: "21", label: "Daily & Weekly Missions" },
  { value: "100%", label: "On-Device Privacy" },
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

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0.6, y: 0.5 });
  const { scrollYProgress } = useScroll({ target: containerRef });
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

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "FocusArx",
    "operatingSystem": "Web, Android, iOS",
    "applicationCategory": "ProductivityApplication",
    "description": "FocusArx is an AI-powered deep work OS that helps you master your focus through adaptive Pomodoro sessions, real-time AI coaching, and gamified progress.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "FocusArx Product Features",
    "description": "Complete feature list of the FocusArx AI productivity platform",
    "numberOfItems": 6,
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "AI Pomodoro Focus Timer", "url": "https://focusarx.site/" },
      { "@type": "ListItem", "position": 2, "name": "Deep Work Tracking with Focus Score", "url": "https://focusarx.site/" },
      { "@type": "ListItem", "position": 3, "name": "AI Productivity Coach and Study Roadmap", "url": "https://focusarx.site/" },
      { "@type": "ListItem", "position": 4, "name": "Virtual Study Rooms", "url": "https://focusarx.site/study-rooms" },
      { "@type": "ListItem", "position": 5, "name": "Habit Tracker with Streaks", "url": "https://focusarx.site/" },
      { "@type": "ListItem", "position": 6, "name": "Focus DNA Analytics", "url": "https://focusarx.site/" }
    ]
  };

  // Note: Organization + WebSite schema are already injected site-wide via
  // index.html, so we only add homepage-specific structured data here to
  // avoid duplicate JSON-LD blocks on every route.
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is the best study method?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The best study method depends on your brain type. Common effective techniques include the Pomodoro Technique (25 min work / 5 min break), Flowtime (working until focus dips), and monistic Deep Work (90+ min blocks)."
        }
      },
      {
        "@type": "Question",
        "name": "Is AI coaching safe for students?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, FocusArx AI coaching is built to be a safe, private productivity companion. All vision data is processed locally, and AI insights are focused purely on academic and professional output."
        }
      }
    ]
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={onMouseMove}
      className="relative min-h-screen overflow-x-hidden bg-[#030308] text-white"
    >
      <PageSEO {...PAGE_SEO.home} structuredData={[structuredData, faqSchema, itemListSchema]} />
      <CursorGlow mouseRef={mouseRef} />

      {/* ── NAV ── */}
      <nav className={`fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4 transition-all duration-300 ${scrolled ? "border-b border-white/5 bg-[#030308]/85 backdrop-blur-2xl" : ""}`}>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#e879f9] flex items-center justify-center">
            <Rocket size={16} />
          </div>
          <span className="text-[15px] font-bold tracking-tight">FocusArx</span>
        </div>
        <div className="hidden sm:flex items-center gap-8 text-sm font-medium text-[#94A3B8]">
          <div className="relative group">
             <button className="flex items-center gap-1 hover:text-white transition-colors">Methods <ChevronDown size={12} /></button>
             <div className="absolute top-full -left-4 mt-2 w-64 p-2 rounded-2xl border border-white/5 bg-zinc-950 shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all">
                {[
                  { href: "/pomodoro-guide", title: "Pomodoro", desc: "Short, intense bursts." },
                  { href: "/science-of-deep-work", title: "Deep Work", desc: "Monastic focus blocks." },
                  { href: "/feynman-technique", title: "Feynman", desc: "Learning by teaching." },
                ].map(m => (
                  <Link key={m.title} href={m.href} className="block p-3 rounded-xl hover:bg-white/5 transition-colors">
                    <p className="text-xs font-bold text-white">{m.title}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{m.desc}</p>
                  </Link>
                ))}
             </div>
          </div>
          <Link href="/study-method-quiz" className="text-[#A78BFA] hover:brightness-110 transition-all font-bold">Free Quiz</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-bold text-[#94A3B8] hover:text-white transition-colors">Login</Link>
          <Link href="/signup">
            <button className="rounded-xl bg-white px-5 py-2 text-sm font-bold text-black hover:bg-zinc-200 transition-colors">Join Now</button>
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <main id="main-content">
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-20">
        <Suspense fallback={null}>
          <Hero3D />
        </Suspense>

        <div className="relative z-10 text-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-purple-300"
          >
            <Sparkles size={12} className="animate-pulse" />
            AI-Powered Deep Work OS
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-5xl text-6xl font-black tracking-tight sm:text-8xl lg:text-9xl"
          >
            Master Your <br />
            <RotatingWord />
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-8 max-w-2xl text-lg text-[#94A3B8] sm:text-xl"
          >
            Turn every study session into measurable progress. Build your digital civilization through the power of deep work.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link href="/signup">
              <button className="h-14 rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#F472B6] to-[#4F46E5] px-10 text-lg font-bold shadow-[0_0_24px_rgba(244,114,182,0.4)] hover:scale-105 transition-transform">
                Start Focusing Free
              </button>
            </Link>
            <Link href="/dashboard">
              <button className="h-14 rounded-2xl border border-white/10 bg-white/5 px-10 text-lg font-bold backdrop-blur-md hover:bg-white/10 transition-colors">
                Explore Dashboard
              </button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-20 grid grid-cols-3 gap-8 border-t border-white/5 pt-12"
          >
            {STATS.map((s, idx) => (
              <div key={idx}>
                <p className="text-3xl font-black text-[#E2E8F0]">{s.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#4B5563]">{s.label}</p>
              </div>
            ))}
          </motion.div>
          
          <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
             <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
             Free forever · No credit card required
          </div>
        </div>
      </section>

      {/* ── VALUE PROPS ── */}
      <section className="relative z-10 py-16 bg-white/[0.01]">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-[#4B5563] mb-10">Built around how you actually work</p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16">
             <div className="text-center">
               <div className="text-2xl">🔒</div>
               <div className="mt-2 text-xs font-bold text-white">Local-First Privacy</div>
               <p className="text-[10px] text-[#4B5563]">Webcam never leaves your device</p>
             </div>
             <div className="text-center">
               <div className="text-2xl">🧠</div>
               <div className="mt-2 text-xs font-bold text-white">Science-Backed</div>
               <p className="text-[10px] text-[#4B5563]">Pomodoro, deep work & flow</p>
             </div>
             <div className="text-center">
               <div className="text-2xl">🎮</div>
               <div className="mt-2 text-xs font-bold text-white">Gamified Progress</div>
               <p className="text-[10px] text-[#4B5563]">XP, streaks & a growing city</p>
             </div>
             <div className="text-center">
               <div className="text-2xl">🤖</div>
               <div className="mt-2 text-xs font-bold text-white">AI Coaching</div>
               <p className="text-[10px] text-[#4B5563]">Personalized, real-time</p>
             </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="relative py-32 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-20 text-center">
            <h2 className="text-4xl font-black sm:text-6xl">Built for <span className="text-[#A78BFA]">Maximum Output</span></h2>
            <p className="mt-4 text-[#94A3B8]">Scientific precision meets gamified engagement.</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
                className="rounded-3xl border border-white/5 bg-white/[0.02] p-8 backdrop-blur-sm transition-all"
              >
                <div className="mb-6 h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                  {f.icon}
                </div>
                <h3 className="mb-3 text-xl font-bold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-[#64748B]">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY FOCUSARX ── */}
      <section id="reviews" className="relative py-32 px-6 border-y border-white/5">
        <div className="mx-auto max-w-7xl">
          <div className="mb-20 text-center">
             <h2 className="text-3xl font-black sm:text-5xl">Everything in <span className="text-emerald-400">one place</span></h2>
             <p className="mt-4 text-[#94A3B8]">A complete focus system — no more juggling five different tools.</p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: <Target className="text-purple-400" />, title: "Adaptive Timer", text: "Pomodoro, deep-work and flow sessions that adapt to your energy and focus style." },
              { icon: <BarChart3 className="text-emerald-400" />, title: "Real Analytics", text: "A genuine Focus Score built from completion rate, attention and distraction events — not just time logged." },
              { icon: <Shield className="text-blue-400" />, title: "Private by Design", text: "Attention tracking runs entirely on-device with MediaPipe. No video ever leaves your browser." },
              { icon: <Trophy className="text-amber-400" />, title: "Gamified Growth", text: "Earn XP and coins, hatch a pet, and watch your Focus City expand with every session." },
              { icon: <Users className="text-pink-400" />, title: "Study Together", text: "Join live study rooms and ride group resonance to stay accountable with others." },
              { icon: <MessageSquare className="text-cyan-400" />, title: "AI Coach", text: "Context-aware coaching tips and a study roadmap that grows with your data." },
            ].map((t, i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.01] p-6">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  {t.icon}
                </div>
                <h3 className="mb-2 text-base font-bold text-white">{t.title}</h3>
                <p className="text-sm text-[#94A3B8] leading-relaxed">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCTIVITY RESUME PREVIEW ── */}
      <section className="relative py-32 px-6 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl opacity-20 pointer-events-none">
           <div className="h-96 w-96 rounded-full bg-blue-500/20 blur-3xl animate-pulse" />
        </div>
        <div className="mx-auto max-w-7xl">
           <div className="grid gap-16 lg:grid-cols-2 items-center">
              <div>
                 <h2 className="text-4xl font-black sm:text-6xl mb-6">Build Your <span className="text-blue-400">Proof of Work</span></h2>
                 <p className="text-lg text-[#94A3B8] leading-relaxed mb-8">
                    Your focus hours aren't just numbers—they're credentials. Export a professional FocusArx Certificate to prove your discipline to universities and employers.
                 </p>
                 <Link href="/signup">
                    <button className="flex items-center gap-2 text-[#A78BFA] font-black uppercase tracking-widest hover:translate-x-2 transition-transform">
                       Start Building Your Profile <ArrowRight size={18} />
                    </button>
                 </Link>
              </div>
              <div className="relative group">
                 <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-500 to-purple-600 opacity-25 blur transition duration-1000 group-hover:opacity-50" />
                 <div className="relative">
                    <ProductivityResume 
                      userName="Alex Rivers"
                      totalFocusHours={1240}
                      avgFocusScore={94}
                      rank="Grandmaster"
                      streak={42}
                      topMode="Deep Work"
                    />
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="relative py-32 px-6 bg-white/[0.01]">
        <div className="mx-auto max-w-7xl">
          <div className="mb-20 text-center">
            <h2 className="text-4xl font-black sm:text-6xl">Your Journey to <span className="text-[#A78BFA]">Mastery</span></h2>
            <p className="mt-4 text-[#94A3B8]">Three steps to total cognitive control.</p>
          </div>

          <div className="grid gap-12 lg:grid-cols-3">
            {[
              { step: "01", title: "Set Your Intent", desc: "Choose your focus mode—Deep, Social, or Flow—and define your session goals.", icon: <Target className="text-purple-400" /> },
              { step: "02", title: "Enter the Void", desc: "Our AI monitor detects distractions in real-time, gently guiding you back into state.", icon: <Shield className="text-emerald-400" /> },
              { step: "03", title: "Evolve Your City", desc: "Every minute of focus rewards you with XP and coins to build your academic civilization.", icon: <Trophy className="text-blue-400" /> },
            ].map((s, i) => (
              <div key={i} className="relative">
                <div className="mb-8 text-8xl font-black text-white/[0.03] absolute -top-12 -left-4 select-none">{s.step}</div>
                <div className="relative z-10">
                  <div className="mb-6 h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl">
                    {s.icon}
                  </div>
                  <h3 className="mb-4 text-2xl font-bold">{s.title}</h3>
                  <p className="text-[#64748B] leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="relative py-32 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-20 text-center">
            <h2 className="text-3xl font-black sm:text-5xl">Free to <span className="text-[#F472B6]">Focus</span></h2>
            <p className="mt-4 text-[#94A3B8]">Everything you need is free. Premium unlocks with coins you earn from focusing.</p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
            {/* Free */}
            <div className="rounded-3xl border border-white/5 bg-white/[0.01] p-10 backdrop-blur-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
              <h3 className="text-xl font-bold mb-2">Free</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-black text-white">$0</span>
                <span className="text-xs text-[#4B5563]">/ forever</span>
              </div>
              <ul className="space-y-4 mb-10 text-sm text-[#94A3B8]">
                <li className="flex items-center gap-2 text-white"><CheckCircle2 size={14} className="text-emerald-500" /> Unlimited Timer Sessions</li>
                <li className="flex items-center gap-2 text-white"><CheckCircle2 size={14} className="text-emerald-500" /> AI Coaching</li>
                <li className="flex items-center gap-2 text-white"><CheckCircle2 size={14} className="text-emerald-500" /> Gamification, Pets & City</li>
                <li className="flex items-center gap-2 text-white"><CheckCircle2 size={14} className="text-emerald-500" /> Analytics & Streaks</li>
              </ul>
              <Link href="/signup">
                <button className="w-full py-5 rounded-2xl border border-white/10 font-black text-white hover:bg-white hover:text-black transition-all">Get Started Free</button>
              </Link>
            </div>
            {/* Premium */}
            <div className="relative rounded-3xl border border-purple-500/30 bg-purple-500/[0.03] p-10 backdrop-blur-sm shadow-[0_0_50px_rgba(124,58,237,0.15)] group">
              <div className="absolute -top-3 right-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-xl">Earn It</div>
              <h3 className="text-xl font-bold mb-2 text-white">Premium</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-black text-white">9,000</span>
                <span className="text-xs text-[#4B5563]">coins</span>
              </div>
              <p className="mb-6 text-xs text-[#94A3B8]">Unlocked with coins you earn from completed sessions — no credit card.</p>
              <ul className="space-y-4 mb-10 text-sm text-[#E2E8F0]">
                <li className="flex items-center gap-2"><Zap size={14} className="text-purple-400" /> Unlimited AI Coaching</li>
                <li className="flex items-center gap-2"><Zap size={14} className="text-purple-400" /> XP & Coin Multipliers</li>
                <li className="flex items-center gap-2"><Zap size={14} className="text-purple-400" /> Exclusive Themes & Pets</li>
                <li className="flex items-center gap-2"><Zap size={14} className="text-purple-400" /> Premium Analytics</li>
              </ul>
              <Link href="/signup">
                <button className="w-full py-5 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 font-black text-white hover:scale-105 transition-transform shadow-[0_20px_40px_rgba(124,58,237,0.3)]">Start Earning Coins</button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="relative py-32 px-6 bg-white/[0.01]">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-black text-center mb-16 sm:text-5xl">Questions? <span className="text-purple-400">Answers.</span></h2>
          <div className="space-y-4">
            {[
              { q: "How does the AI Coach work?", a: "Our proprietary algorithm analyzes your focus patterns, distraction frequency, and session quality in real-time to provide context-aware interventions and productivity roadmaps." },
              { q: "Is my webcam data private?", a: "Absolutely. All vision processing (MediaPipe) happens locally in your browser. No video or image data is ever transmitted to our servers." },
              { q: "Can I use it for free?", a: "Yes — the Pomodoro timer, gamification, AI coaching, and analytics are free forever. Premium adds unlimited AI and multipliers, and it's unlocked with coins you earn from focusing." },
              { q: "Does it work on mobile?", a: "FocusArx is a progressive web app (PWA) that works flawlessly on desktop, tablet, and mobile devices." },
            ].map((item, i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-3">
                  <span className="h-6 w-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-black">?</span>
                  {item.q}
                </h3>
                <p className="text-[#64748B] text-sm leading-relaxed pl-9">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative py-40 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#7C3AED]/5 to-transparent pointer-events-none" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-black sm:text-7xl mb-8">Ready to achieve <br /><span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Total Focus?</span></h2>
          <p className="text-lg text-[#94A3B8] mb-12 max-w-2xl mx-auto">Join ambitious students and professionals. No credit card required. Cancel anytime.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <button className="h-16 px-12 rounded-2xl bg-white text-black font-black text-lg hover:scale-105 transition-transform shadow-[0_20px_50px_rgba(255,255,255,0.15)]">
                Start Your Journey
              </button>
            </Link>
          </div>
          <p className="mt-8 text-[10px] uppercase tracking-[0.2em] text-[#4B5563]">Built for people who take their focus seriously</p>
        </div>
      </section>

      {/* ── LEAD MAGNET ── */}
      <section className="relative py-24 px-6 bg-[#7C3AED]/5 border-y border-[#7C3AED]/10">
        <div className="mx-auto max-w-4xl text-center">
           <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 mb-6">
              <Star className="text-[#A78BFA]" />
           </div>
           <h2 className="text-3xl font-black sm:text-5xl mb-6">Get the "Deep Work" Manifesto</h2>
           <p className="text-lg text-[#94A3B8] mb-10 max-w-2xl mx-auto">
              Practical, science-backed routines to reclaim deep-focus hours every day. Free, no spam, unsubscribe anytime.
           </p>
           <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="flex-1 px-6 py-4 rounded-2xl bg-[#030308] border border-white/10 focus:border-[#A78BFA] outline-none transition-all"
              />
              <button className="px-8 py-4 rounded-2xl bg-white text-black font-black hover:bg-zinc-200 transition-all">
                 Join Free
              </button>
           </form>
           <p className="mt-4 text-[10px] text-[#4B5563] uppercase tracking-widest">No spam. Only high-performance research.</p>
        </div>
      </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 bg-[#030308] py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5 mb-6">
                <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#e879f9] flex items-center justify-center">
                  <Rocket size={12} />
                </div>
                <span className="font-bold tracking-tight text-white">FocusArx</span>
              </div>
              <p className="text-xs text-[#4B5563] leading-relaxed">
                The AI-powered OS for deep work. Build focus habits that actually stick.
              </p>
            </div>
            <div>
              <h4 className="mb-6 text-[10px] font-bold uppercase tracking-widest text-white">Product</h4>
              <ul className="space-y-4 text-xs text-[#4B5563]">
                <li><Link href="/dashboard" className="hover:text-white">Dashboard</Link></li>
                <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/roadmap" className="hover:text-white">Roadmap</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-6 text-[10px] font-bold uppercase tracking-widest text-white">Resources</h4>
              <ul className="space-y-4 text-xs text-[#4B5563]">
                <li><Link href="/study-method-quiz" className="hover:text-[#A78BFA] transition-colors font-bold text-white/40">Study Method Quiz</Link></li>
                <li><Link href="/study-calculator" className="hover:text-white transition-colors">Study Calculator</Link></li>
                <li><Link href="/science-of-deep-work" className="hover:text-white">Science of Focus</Link></li>
                <li><Link href="/feynman-technique" className="hover:text-white">Feynman Technique</Link></li>
                <li><Link href="/focus-guide" className="hover:text-white">Focus Guide</Link></li>
                <li><Link href="/pomodoro-guide" className="hover:text-white">Pomodoro Guide</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-6 text-[10px] font-bold uppercase tracking-widest text-white">Company</h4>
              <ul className="space-y-4 text-xs text-[#4B5563]">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                <li><Link href="/support" className="hover:text-white">Support</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-6 text-[10px] font-bold uppercase tracking-widest text-white">Legal</h4>
              <ul className="space-y-4 text-xs text-[#4B5563]">
                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          {/* Product Disclaimer */}
          <div className="max-w-3xl mx-auto mt-16 px-6 py-6 rounded-2xl border border-white/5 bg-white/[0.01] text-center">
             <p className="text-[10px] leading-relaxed text-zinc-600 uppercase tracking-widest">
               *FocusArx is a productivity engine. Our AI Coach provides general optimization guidance and is not a substitute for medical or psychological advice. Deep work results depend on individual consistency.
             </p>
          </div>

          {/* Trust Badges */}
          <div className="mt-16 flex flex-wrap justify-center gap-8 opacity-60">
             <div className="flex flex-col items-center gap-2">
                <Lock size={20} className="text-white" />
                <span className="text-[8px] font-bold uppercase tracking-widest text-white">Encrypted in Transit</span>
             </div>
             <div className="flex flex-col items-center gap-2">
                <ShieldCheck size={20} className="text-white" />
                <span className="text-[8px] font-bold uppercase tracking-widest text-white">On-Device Vision</span>
             </div>
             <div className="flex flex-col items-center gap-2">
                <RefreshCw size={20} className="text-white" />
                <span className="text-[8px] font-bold uppercase tracking-widest text-white">Free Core Forever</span>
             </div>
             <div className="flex flex-col items-center gap-2">
                <Shield size={20} className="text-white" />
                <span className="text-[8px] font-bold uppercase tracking-widest text-white">We Never Sell Data</span>
             </div>
          </div>

          <div className="mt-20 border-t border-white/5 pt-8 text-center text-[10px] text-[#2A2D3A]">
            © 2026 FocusArx. Built for the modern learner.
          </div>
        </div>
      </footer>
    </div>
  );
}
