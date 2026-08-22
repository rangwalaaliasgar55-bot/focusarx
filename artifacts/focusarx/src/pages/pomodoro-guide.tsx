import { Link } from "wouter";
import { ArrowRight, Timer, Brain, Coffee, BarChart2, Smartphone, Globe, ShieldCheck } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

function TipCard({ icon: Icon, title, body, color }: { icon: React.ComponentType<any>; title: string; body: string; color: string }) {
  return (
    <div className="rounded-3xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.01] p-8 hover:border-[var(--palette-f87171)]/30 transition-all group">
      <div className="h-12 w-12 rounded-2xl bg-[var(--palette-white)]/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        <Icon size={24} style={{ color }} />
      </div>
      <h3 className="text-xl font-bold text-[var(--palette-white)] mb-3">{title}</h3>
      <p className="text-[var(--muted-fg)] leading-relaxed">{body}</p>
    </div>
  );
}

export default function PomodoroGuidePage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PageSEO {...PAGE_SEO.pomodoroGuide} />

      <div className="relative overflow-hidden border-b border-[var(--palette-white)]/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,_var(--rgba-239-68-68-0_12),_transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--palette-red-500)]/30 bg-[var(--palette-red-500)]/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--palette-red-400)] mb-8">
            <Timer size={12} /> Pomodoro System
          </div>
          <h1 className="text-5xl sm:text-8xl font-black text-[var(--palette-white)] mb-6 leading-tight tracking-tight">
            The Pomodoro<br />
            <span className="bg-gradient-to-r from-[var(--palette-red-400)] to-[var(--palette-orange-400)] bg-clip-text text-transparent">Technique</span>
          </h1>
          <p className="text-xl text-[var(--foreground-muted)] max-w-2xl mx-auto mb-12 leading-relaxed">
            The world's most popular study system. We break down the science of 25-minute intervals and how to use them to reach your biggest goals.
          </p>
          <Link href="/signup">
            <button className="h-16 px-10 rounded-2xl bg-gradient-to-r from-[var(--palette-red-500)] to-[var(--palette-orange-500)] text-lg font-black shadow-[0_0_40px_var(--rgba-239-68-68-0_3)] hover:scale-105 transition-transform">
              Try the Free Pomodoro Timer <ArrowRight size={18} className="inline ml-1" />
            </button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-24 space-y-32">

        {/* The science */}
        <section className="text-center">
          <h2 className="text-4xl font-black text-[var(--palette-white)] mb-12 tracking-tight">The Bio-Logic of 25 Minutes</h2>
          <div className="grid sm:grid-cols-3 gap-6 mb-16">
            {[
              { label: "High Performance", value: "25m", note: "Peak focus window before the 'restlessness' curve starts." },
              { label: "Neuro-Recharge", value: "5m", note: "Replenishes glycogen in the prefrontal cortex." },
              { label: "Consolidation", value: "30m", note: "Long break to move info from short to long-term memory." },
            ].map(s => (
              <div key={s.label} className="rounded-3xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-8 backdrop-blur-xl">
                <p className="text-5xl font-black text-[var(--palette-white)] mb-4">{s.value}</p>
                <p className="text-xs font-black uppercase tracking-widest text-[var(--palette-red-400)] mb-2">{s.label}</p>
                <p className="text-xs text-[var(--foreground-subtle)] leading-relaxed">{s.note}</p>
              </div>
            ))}
          </div>
          <div className="max-w-2xl mx-auto text-[var(--foreground-muted)] leading-relaxed text-lg italic">
            "Sustained attention has a natural biological ebb at around 30 minutes. The Pomodoro technique isn't just a timer—it's an alignment with your brain's ultradian rhythm."
          </div>
        </section>

        {/* Tips */}
        <section>
          <div className="text-center mb-16">
             <h2 className="text-4xl font-black text-[var(--palette-white)] mb-4">Elite Study Protocols</h2>
             <p className="text-[var(--muted-fg)]">Small tweaks that separate top performers from everyone else.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <TipCard icon={Brain} color="var(--palette-f87171)" title="The Single Intent Rule" body="Vague goals lead to vague focus. Write down the EXACT sentence you will produce or topic you will learn before the timer starts." />
            <TipCard icon={Smartphone} color="var(--color-warning)" title="Physical Isolation" body="Keep your phone in a DIFFERENT ROOM. Visual proximity to a phone, even if it's off, reduces your effective IQ by 10 points." />
            <TipCard icon={Coffee} color="var(--info)" title="Active Rest Only" body="Do NOT check social media on breaks. Look at distance (the horizon), stretch, or drink water. Screens prevent neural recharge." />
            <TipCard icon={ShieldCheck} color="var(--palette-10b981)" title="The Distraction Log" body="If a task pops into your head, write it down and immediately go back. Don't let your 'Default Mode Network' hijack your flow." />
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <div className="rounded-[40px] border border-[var(--palette-red-500)]/20 bg-gradient-to-br from-[var(--palette-red-500)]/10 to-[var(--palette-orange-500)]/5 p-16 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
               <Timer size={200} className="text-[var(--palette-red-400)]" />
            </div>
            <h2 className="text-4xl sm:text-6xl font-black text-[var(--palette-white)] mb-6 tracking-tight">Upgrade Your <br />Learning Output</h2>
            <p className="text-[var(--foreground-muted)] mb-12 max-w-xl mx-auto text-lg">FocusArx combines the classic Pomodoro system with AI coaching and immersive 3D metrics.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <button className="h-16 px-12 rounded-2xl bg-[var(--palette-white)] text-[var(--palette-black)] font-black text-lg hover:scale-105 transition-all">
                  Initialize Timer
                </button>
              </Link>
            </div>
          </div>
        </section>
      </div>

      <div className="border-t border-[var(--palette-white)]/5 py-12 text-center flex flex-wrap justify-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--palette-2a2d3a)]">
        <Link href="/" className="hover:text-[var(--palette-white)] transition-colors">Home</Link>
        <Link href="/science-of-deep-work" className="hover:text-[var(--palette-white)] transition-colors">Neuro-Science</Link>
        <Link href="/feynman-technique" className="hover:text-[var(--palette-white)] transition-colors">Feynman Technique</Link>
        <Link href="/leaderboard" className="hover:text-[var(--palette-white)] transition-colors">World Board</Link>
      </div>
    </div>
  );
}
