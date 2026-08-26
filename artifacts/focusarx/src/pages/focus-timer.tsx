import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { Timer, Crown, Zap, BarChart2, Palette, Sparkles, CheckCircle } from "lucide-react";

export default function FocusTimerPage() {
  return (
    <PageTransition>
      <PageSEO {...PAGE_SEO.focusTimer} structuredData={[
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "FocusArx Focus Timer",
          "applicationCategory": "ProductivityApplication",
          "operatingSystem": "Web",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
          "description": PAGE_SEO.focusTimer.description
        }
      ]} />
      <div className="min-h-screen bg-[var(--background)]">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-600)]/20 bg-[var(--brand-600)]/10 px-4 py-1.5 text-xs font-bold text-[var(--brand-400)] mb-4">
              <Timer size={14} /> Free Focus Timer • No Credit Card
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[var(--foreground)] mb-4">
              Free Focus Timer for Deep Work
            </h1>
            <p className="mx-auto max-w-2xl text-[15px] leading-relaxed text-[var(--foreground-muted)]">
              Start a Pomodoro or custom 10–180 min deep work session. Earn Focus Tokens, level up pets, build your Focus City. Premium unlocks rituals, sound mixing, intentions, reflections, templates, animations.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/" className="min-h-[44px] inline-flex items-center justify-center rounded-xl bg-[var(--brand-600)] px-6 text-sm font-bold text-white hover:bg-[var(--brand-700)]">Start Focusing — Free</Link>
              <Link href="/premium" className="min-h-[44px] inline-flex items-center justify-center rounded-xl border border-[var(--rgba-255-255-255-0_10)] bg-[var(--rgba-255-255-255-0_04)] px-6 text-sm font-semibold">View Premium Benefits</Link>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-12">
            {[
              { icon: Zap, title: "Free: Core Timer", desc: "25m Pomodoro, basic tasks, streaks, 1 pet, starter city, daily quests, public rooms" },
              { icon: Crown, title: "Premium: Rituals", desc: "Custom presets 10-180m, sequences, fullscreen zen, sound mixing, intentions, reflections, templates" },
              { icon: BarChart2, title: "Premium: Analytics", desc: "Best hours/days, completion/abandonment, trends, breakdown, export, 180-day view" },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_03)] p-5">
                <c.icon size={20} className="text-[var(--brand-400)] mb-3" />
                <h3 className="text-sm font-bold text-[var(--foreground)] mb-1">{c.title}</h3>
                <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--surface-1)] p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Sparkles size={18} className="text-[var(--brand-400)]" /> How Focus Tokens Work</h2>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[
                "Earn 50 tokens per 25m+ focus session (max 10/day)",
                "Daily quests +30, weekly +100, streak +20",
                "Battle pass milestones, pet milestones, city upgrades",
                "Seasonal events, referrals, achievements",
                "Spend tokens for Premium (10k/25k/80k), pets, cosmetics",
                "Ledger is source of truth — idempotent, audited, no real money",
              ].map((t) => (
                <div key={t} className="flex items-start gap-2"><CheckCircle size={14} className="text-[var(--success)] mt-0.5 shrink-0" /><span className="text-[var(--foreground-muted)]">{t}</span></div>
              ))}
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-[var(--foreground-subtle)]">Free forever. Premium unlocked purely with earned Focus Tokens — no Stripe/PayPal.</p>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
