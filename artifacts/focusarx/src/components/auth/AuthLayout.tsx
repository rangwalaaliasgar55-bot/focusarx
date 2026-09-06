import { Link } from "wouter";
import { ArrowLeft, Flame, ShieldCheck, Sparkles, Timer, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

const PROOF = [
  { icon: Timer, label: "Sessions survive refreshes, tab closes, and phone locks." },
  { icon: Flame, label: "Streaks, XP, and a city that only grows when you focus." },
  { icon: Sparkles, label: "An AI coach that reads your real history, not a script." },
];

/**
 * Two-column on desktop: a calm brand panel with a live-looking timer on the
 * left, the form on the right. Collapses to the single centred card on phones,
 * where the brand panel would only push the form below the fold.
 */
export function AuthLayout({ eyebrow, title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <main className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[40rem] bg-[radial-gradient(60%_50%_at_30%_0%,var(--brand-soft-hover),transparent_70%)]" aria-hidden="true" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* Brand panel */}
        <section className="hidden flex-col justify-between border-r border-[var(--border-subtle)] px-10 py-10 lg:flex xl:px-14" aria-label="About FocusArx">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="FocusArx home">
            <span className="brand-mark"><Zap size={18} fill="currentColor" /></span>
            <span className="text-sm font-semibold tracking-tight">FocusArx</span>
          </Link>

          <div>
            <div className="relative mx-auto grid h-56 w-56 place-items-center rounded-full" style={{ background: "conic-gradient(var(--brand-500) 0 68%, var(--brand-soft) 0)" }} aria-hidden="true">
              <div className="absolute inset-2.5 rounded-full bg-[var(--surface)] shadow-[var(--shadow-md)]" />
              <div className="relative text-center">
                <p className="font-mono text-5xl font-semibold tracking-[-0.06em] tabular-nums">17:00</p>
                <p className="mt-1 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">Focus block</p>
              </div>
            </div>
            <h2 className="mt-10 text-3xl font-semibold tracking-[-0.03em] text-balance">Deep work, made clear.</h2>
            <ul className="mt-6 space-y-3">
              {PROOF.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-start gap-3 text-sm text-[var(--foreground-muted)]">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"><Icon size={14} /></span>
                  <span className="leading-relaxed">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="inline-flex items-center gap-2 text-xs text-[var(--foreground-subtle)]"><ShieldCheck size={14} /> Passwords are hashed; sessions use httpOnly cookies.</p>
        </section>

        {/* Form column */}
        <section className="flex flex-col px-4 py-8 sm:px-8 lg:justify-center lg:px-12 xl:px-16">
          <div className="mb-7 flex items-center justify-between lg:hidden">
            <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"><ArrowLeft size={16} /> Home</Link>
            <span className="inline-flex items-center gap-2 text-xs text-[var(--foreground-subtle)]"><ShieldCheck size={14} /> Secure access</span>
          </div>
          <div className="mb-6 text-center lg:hidden">
            <span className="brand-mark mx-auto"><Zap size={18} fill="currentColor" /></span>
            <p className="mt-3 text-sm font-semibold">FocusArx</p>
          </div>

          <div className="mx-auto w-full max-w-md">
            <Card elevation="elevated" className="overflow-hidden">
              <CardContent className="p-6 sm:p-8">
                <p className="page-eyebrow">{eyebrow}</p>
                <h1 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--foreground)]">{title}</h1>
                <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{subtitle}</p>
                <div className="mt-7">{children}</div>
              </CardContent>
            </Card>
            <div className="mt-6 text-center text-sm text-[var(--foreground-muted)]">{footer}</div>
            <div className="mt-6 hidden justify-center gap-4 text-xs text-[var(--foreground-subtle)] lg:flex">
              <Link href="/" className="hover:text-[var(--foreground)]">Home</Link>
              <Link href="/privacy" className="hover:text-[var(--foreground)]">Privacy</Link>
              <Link href="/terms" className="hover:text-[var(--foreground)]">Terms</Link>
              <Link href="/support" className="hover:text-[var(--foreground)]">Help</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
