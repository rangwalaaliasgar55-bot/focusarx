import { Link } from "wouter";
import { ArrowRight, Timer, Brain, Coffee, BarChart2, Smartphone, Globe } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

function TipCard({ icon: Icon, title, body, color }: { icon: React.ComponentType<any>; title: string; body: string; color: string }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-5 hover:border-[#7C3AED]/30 transition-colors">
      <Icon size={18} style={{ color }} className="mb-3" />
      <h3 className="font-bold text-[#E2E8F0] mb-2">{title}</h3>
      <p className="text-sm text-[#6b7280] leading-relaxed">{body}</p>
    </div>
  );
}

export default function PomodoroGuidePage() {
  return (
    <div className="min-h-screen bg-[rgba(255,255,255,0.02)] text-[#E2E8F0]">
      <PageSEO {...PAGE_SEO.pomodoroGuide} />

      <div className="relative overflow-hidden border-b border-[rgba(255,255,255,0.06)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,_rgba(239,68,68,0.12),_transparent_70%)]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 mb-6">
            <Timer size={12} /> Pomodoro Guide
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-[#E2E8F0] mb-4 leading-tight">
            The Pomodoro<br />
            <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">Technique</span>
          </h1>
          <p className="text-lg text-[#6b7280] max-w-xl mx-auto mb-8">
            How a kitchen timer and 25-minute intervals became the world's most popular productivity system — and how to use it for exam prep, coding, and creative work.
          </p>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-6 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity">
            Try the Free Pomodoro Timer <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 space-y-16">

        {/* Origin */}
        <section>
          <h2 className="text-2xl font-black text-[#E2E8F0] mb-4">Origin of the Pomodoro Technique</h2>
          <div className="prose-dark space-y-4 text-[#8b8fa8] leading-relaxed text-sm">
            <p>In the late 1980s, a university student named Francesco Cirillo was struggling to focus on his studies. He grabbed a tomato-shaped kitchen timer (<em>pomodoro</em> is Italian for tomato), set it for 25 minutes, and made a pact with himself: work with full concentration until it rang.</p>
            <p>What followed was a productivity breakthrough. Cirillo refined the system over years and published it in 2006. Today it's used by over 2 million students, developers, and creatives worldwide.</p>
            <p>The insight is deceptively simple: <strong className="text-[#E2E8F0]">our brains work better in focused bursts with deliberate rest</strong>, not in marathon sessions that drain mental energy without recovery.</p>
          </div>
        </section>

        {/* The science */}
        <section className="border-t border-[rgba(255,255,255,0.06)] pt-12">
          <h2 className="text-2xl font-black text-[#E2E8F0] mb-4">The Science Behind It</h2>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: "Minutes", value: "25", note: "Optimal deep-work burst for most people" },
              { label: "Break", value: "5 min", note: "Short reset between each pomodoro" },
              { label: "Long break", value: "20–30 min", note: "After every 4 pomodoros" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-4 text-center">
                <p className="text-3xl font-black text-[#E2E8F0] mb-1">{s.value}</p>
                <p className="text-xs font-bold text-[#a78bfa] mb-1">{s.label}</p>
                <p className="text-[11px] text-[#4B5563]">{s.note}</p>
              </div>
            ))}
          </div>
          <div className="text-sm text-[#8b8fa8] leading-relaxed space-y-3">
            <p>Research in cognitive neuroscience confirms that sustained attention has a natural ebb at around 20–30 minutes. The Pomodoro timer aligns with the brain's <strong className="text-[#E2E8F0]">ultradian rhythm</strong> — 90-minute cycles of high and low alertness.</p>
            <p>Breaks allow the <strong className="text-[#E2E8F0]">default mode network</strong> to activate, which consolidates learning and creative insight. Skipping breaks doesn't produce more work — it produces worse work.</p>
          </div>
        </section>

        {/* Tips */}
        <section className="border-t border-[rgba(255,255,255,0.06)] pt-12">
          <h2 className="text-2xl font-black text-[#E2E8F0] mb-2">7 Tips to Supercharge Your Pomodoros</h2>
          <p className="text-[#6b7280] mb-6 text-sm">Small tweaks that double the effectiveness of the technique.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <TipCard icon={Brain} color="#7C3AED" title="Set a single intention" body="Before starting the timer, write one specific sub-task you'll complete. Vague goals lead to vague focus." />
            <TipCard icon={Smartphone} color="#f59e0b" title="Phone in another room" body="Not on silent — in another room. Even a face-down phone reduces cognitive capacity by occupying background processing." />
            <TipCard icon={Coffee} color="#f87171" title="Protect your break" body="Don't check social media on a 5-minute break. Look out a window, stretch, or breathe. Screens during breaks extend cognitive fatigue." />
            <TipCard icon={BarChart2} color="#22d387" title="Track your velocity" body="Count your pomodoros per day. Pros average 8–12 per day. Build to that gradually — starting with 4 is fine." />
            <TipCard icon={Globe} color="#60a5fa" title="Use ambient sound" body="Brown noise, lo-fi, or rain sounds mask distracting background noise and signal to your brain 'it's focus time.'" />
            <TipCard icon={Timer} color="#a78bfa" title="Customize the duration" body="25 minutes isn't sacred. Developers often prefer 50-minute blocks; students cramming for exams do well with 20. FocusArx lets you pick any duration." />
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-[rgba(255,255,255,0.06)] pt-12 text-center">
          <div className="rounded-3xl border border-red-500/20 bg-gradient-to-br from-red-500/8 to-orange-500/5 p-10">
            <Timer size={32} className="text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-[#E2E8F0] mb-3">Start your first Pomodoro in 10 seconds</h2>
            <p className="text-[#6b7280] mb-6 max-w-md mx-auto text-sm">FocusArx adds gamification, AI coaching, and accountability on top of the classic technique — free forever.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-7 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity">
                Create Free Account <ArrowRight size={15} />
              </Link>
              <Link href="/focus-guide" className="inline-flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] px-6 py-3 text-sm font-medium text-[#a78bfa] hover:border-[#7C3AED]/40 transition-colors">
                Read the Full Focus Guide
              </Link>
            </div>
          </div>
        </section>
      </div>

      <div className="border-t border-[rgba(255,255,255,0.06)] py-6 text-center space-x-4 text-xs text-[#374151]">
        <Link href="/" className="hover:text-[#7C3AED]">Home</Link>
        <Link href="/focus-guide" className="hover:text-[#7C3AED]">Focus Guide</Link>
        <Link href="/study-techniques" className="hover:text-[#7C3AED]">Study Techniques</Link>
        <Link href="/leaderboard" className="hover:text-[#7C3AED]">Leaderboard</Link>
        <Link href="/study-rooms" className="hover:text-[#7C3AED]">Study Rooms</Link>
      </div>
    </div>
  );
}
