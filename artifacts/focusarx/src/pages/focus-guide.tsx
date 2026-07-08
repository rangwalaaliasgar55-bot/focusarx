import { Link } from "wouter";
import { ArrowRight, Brain, Clock, Target, Zap, CheckCircle, TrendingUp, Users } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`max-w-3xl mx-auto px-4 sm:px-6 ${className}`}>{children}</section>;
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-5">
      <p className="font-semibold text-[#E2E8F0] mb-2">{q}</p>
      <p className="text-sm text-[#6b7280] leading-relaxed">{a}</p>
    </div>
  );
}

const FAQS = [
  {
    q: "How long should a focus session be?",
    a: "Research suggests 25–52 minutes is optimal for most people, followed by a 5–17 minute break. FocusArx defaults to 25-minute Pomodoro sessions, but you can customize them from 10 to 120 minutes based on your attention span and task type.",
  },
  {
    q: "What is the Pomodoro Technique?",
    a: "The Pomodoro Technique, developed by Francesco Cirillo, breaks work into 25-minute focused intervals (pomodoros) separated by short breaks. After 4 pomodoros you take a longer 15–30 minute break. This rhythm prevents mental fatigue and builds sustainable focus habits.",
  },
  {
    q: "Does FocusArx work without internet?",
    a: "The core timer and task tracking work with a local fallback. AI coaching and social features require internet, but your sessions are saved locally first and synced when you reconnect.",
  },
  {
    q: "How does the attention tracking work?",
    a: "FocusArx uses your webcam via MediaPipe to detect gaze direction and posture. The camera never streams or stores footage — all processing happens locally in your browser. You earn bonus XP for maintaining focus during a session.",
  },
  {
    q: "Can I use FocusArx with friends?",
    a: "Yes! Add friends, join live Study Rooms, compete on leaderboards, and cheer each other on via the Social Hub. Accountability is one of the strongest predictors of study consistency.",
  },
  {
    q: "What are Focus Coins and XP?",
    a: "XP (Experience Points) measure your cumulative learning effort and unlock new levels. Focus Coins are earned during sessions and can be spent in the Coin Shop on themes, boosts, title cosmetics, and Premium access.",
  },
];

export default function FocusGuidePage() {
  return (
    <div className="min-h-screen bg-[rgba(255,255,255,0.02)] text-[#E2E8F0]">
      <PageSEO {...PAGE_SEO.focusGuide} />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[rgba(255,255,255,0.06)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,_rgba(124,58,237,0.18),_transparent_70%)]" />
        <Section className="relative py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#7C3AED]/30 bg-[#7C3AED]/10 px-3 py-1.5 text-xs font-semibold text-[#a78bfa] mb-6">
            <Brain size={12} /> Free Guide
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-[#E2E8F0] mb-4 leading-tight">
            The Ultimate<br />
            <span className="bg-gradient-to-r from-[#7C3AED] to-[#a78bfa] bg-clip-text text-transparent">Focus Guide</span>
          </h1>
          <p className="text-lg text-[#6b7280] max-w-xl mx-auto mb-8">
            Deep work principles, Pomodoro science, gamified habits, and AI-powered insights — everything you need to master focus.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-6 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity">
              Start Focusing Free <ArrowRight size={15} />
            </Link>
            <Link href="/leaderboard" className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-6 py-3 text-sm font-medium text-[#a78bfa] hover:border-[#7C3AED]/40 transition-colors">
              <Users size={14} /> See Top Students
            </Link>
          </div>
        </Section>
      </div>

      {/* Core principles */}
      <Section className="py-16">
        <h2 className="text-2xl font-black text-[#E2E8F0] mb-2">The 5 Laws of Deep Focus</h2>
        <p className="text-[#6b7280] mb-8">Science-backed principles used by top performers worldwide.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: Clock, title: "Time-Block Everything", body: "Schedule focus sessions in advance like appointments. Unplanned study rarely happens. Even 25 minutes of scheduled deep work beats 3 hours of scattered effort.", color: "#f59e0b" },
            { icon: Target, title: "One Task at a Time", body: "Multitasking reduces IQ by 10–15 points. Define a single clear objective before each session. FocusArx's task system keeps your intention front and center.", color: "#22d387" },
            { icon: Brain, title: "Eliminate Distractions", body: "Phone in another room, website blockers on, notifications off. A single notification check takes 23 minutes to fully recover from cognitively.", color: "#7C3AED" },
            { icon: Zap, title: "Respect the Break", body: "Skipping breaks degrades focus quality. The 5-minute break is not lazy — it's what makes the next 25 minutes sharp. FocusArx enforces rest with a gentle timer.", color: "#60a5fa" },
            { icon: TrendingUp, title: "Track and Reflect", body: "What gets measured gets managed. Review your weekly session data in FocusArx Analytics to identify your peak hours and best study conditions.", color: "#f87171" },
            { icon: Users, title: "Study with Accountability", body: "People with study buddies are 65% more likely to hit their goals. Join Study Rooms and friend-leaderboards to harness social accountability.", color: "#a78bfa" },
          ].map(({ icon: Icon, title, body, color }) => (
            <div key={title} className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-5 hover:border-[#7C3AED]/30 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} style={{ color }} />
                <h3 className="font-bold text-[#E2E8F0]">{title}</h3>
              </div>
              <p className="text-sm text-[#6b7280] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Pomodoro step by step */}
      <Section className="py-12 border-t border-[rgba(255,255,255,0.06)]">
        <h2 className="text-2xl font-black text-[#E2E8F0] mb-2">How Pomodoro Works</h2>
        <p className="text-[#6b7280] mb-8">The world's most popular focus system, step by step.</p>
        <div className="space-y-4">
          {[
            { step: "1", title: "Choose a task", body: "Pick one specific task you'll work on. Write it down or select it in FocusArx. Vague intentions produce vague results." },
            { step: "2", title: "Set the timer for 25 minutes", body: "Commit to doing nothing but that task for 25 uninterrupted minutes. FocusArx shows your countdown with ambient focus sounds." },
            { step: "3", title: "Work until the timer rings", body: "If a distraction pops into your head, write it on a 'later' list and keep going. The pomodoro is sacred." },
            { step: "4", title: "Take a 5-minute break", body: "Step away from the screen. Stretch, breathe, hydrate. FocusArx blocks the timer until your break is done." },
            { step: "5", title: "After 4 pomodoros, take a long break", body: "20–30 minutes to fully recharge. Your brain consolidates learning during rest — this isn't optional." },
          ].map(({ step, title, body }) => (
            <div key={step} className="flex gap-4 items-start">
              <div className="h-8 w-8 shrink-0 rounded-full bg-[#7C3AED]/20 border border-[#7C3AED]/40 flex items-center justify-center text-sm font-black text-[#a78bfa]">{step}</div>
              <div>
                <p className="font-bold text-[#E2E8F0] mb-1">{title}</p>
                <p className="text-sm text-[#6b7280] leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section className="py-12 border-t border-[rgba(255,255,255,0.06)]">
        <h2 className="text-2xl font-black text-[#E2E8F0] mb-2">Frequently Asked Questions</h2>
        <p className="text-[#6b7280] mb-8">Everything you need to know about focus and FocusArx.</p>
        <div className="space-y-3">
          {FAQS.map(f => <FAQ key={f.q} {...f} />)}
        </div>
      </Section>

      {/* CTA */}
      <Section className="py-16 text-center border-t border-[rgba(255,255,255,0.06)]">
        <div className="rounded-3xl border border-[#7C3AED]/30 bg-gradient-to-br from-[#7C3AED]/10 to-[#4F46E5]/5 p-10">
          <CheckCircle size={32} className="text-[#7C3AED] mx-auto mb-4" />
          <h2 className="text-2xl font-black text-[#E2E8F0] mb-3">Ready to build your focus habit?</h2>
          <p className="text-[#6b7280] mb-6 max-w-md mx-auto">Start your first Pomodoro session in under 60 seconds. Free forever — no credit card needed.</p>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-8 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity">
            Create Free Account <ArrowRight size={15} />
          </Link>
        </div>
      </Section>

      {/* Footer links */}
      <div className="border-t border-[rgba(255,255,255,0.06)] py-6 text-center space-x-4 text-xs text-[#374151]">
        <Link href="/" className="hover:text-[#7C3AED]">Home</Link>
        <Link href="/leaderboard" className="hover:text-[#7C3AED]">Leaderboard</Link>
        <Link href="/study-rooms" className="hover:text-[#7C3AED]">Study Rooms</Link>
        <Link href="/pomodoro-guide" className="hover:text-[#7C3AED]">Pomodoro Guide</Link>
        <Link href="/study-techniques" className="hover:text-[#7C3AED]">Study Techniques</Link>
        <Link href="/privacy" className="hover:text-[#7C3AED]">Privacy</Link>
        <Link href="/terms" className="hover:text-[#7C3AED]">Terms</Link>
      </div>
    </div>
  );
}
