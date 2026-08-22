import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export default function AcceptableUsePage() {
  return (
    <div className="relative min-h-[100dvh] forge-bg-glow">
      <main id="main-content" className="relative z-[var(--z-content)] mx-auto max-w-3xl px-4 py-10">
        <PageTransition>
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs text-[var(--foreground-subtle)] hover:text-[var(--brand-400)] transition-colors">
            <ArrowLeft size={13} /> Back to FocusArx
          </Link>

          <header className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--rgba-124-58-237-0_15)]">
                <AlertTriangle size={20} className="text-[var(--brand-400)]" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--foreground-subtle)]">Legal</p>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">Acceptable Use Policy</h1>
              </div>
            </div>
            <p className="text-xs text-[var(--foreground-subtle)]">Last updated: August 2026</p>
          </header>

          <div className="space-y-8">
            <Section title="Overview">
              <p>This Acceptable Use Policy (AUP) governs how you may use FocusArx. Using our service means you agree to these rules. Violations may result in account suspension or termination.</p>
            </Section>

            <Section title="Permitted Uses">
              <p>You may use FocusArx to:</p>
              <ul>
                <li>Track and improve your personal focus and productivity</li>
                <li>Participate in leaderboards and gamification features</li>
                <li>Interact with the AI coach and roadmap generator for personal development</li>
                <li>Store tasks, goals, and session notes for your own use</li>
              </ul>
            </Section>

            <Section title="Prohibited Activities">
              <p>You must not:</p>
              <ul>
                <li><strong className="text-[var(--foreground)]">Cheat on leaderboards</strong> — scripting sessions, creating multiple accounts, or any artificial inflation of XP/coins.</li>
                <li><strong className="text-[var(--foreground)]">Abuse AI features</strong> — sending excessive requests designed to circumvent rate limits, or using AI outputs for commercial resale.</li>
                <li><strong className="text-[var(--foreground)]">Attack the service</strong> — attempting SQL injection, XSS, DoS, credential stuffing, or any other attack against our infrastructure.</li>
                <li><strong className="text-[var(--foreground)]">Reverse-engineer</strong> — decompiling, disassembling, or scraping the application or API in ways that violate our <Link href="/terms" className="text-[var(--brand-400)] hover:underline">Terms of Service</Link>.</li>
                <li><strong className="text-[var(--foreground)]">Harmful content</strong> — entering content into tasks, goals, or the AI coach that is illegal, abusive, or intended to harass others.</li>
                <li><strong className="text-[var(--foreground)]">Impersonation</strong> — using another person's name or identity in your profile.</li>
              </ul>
            </Section>

            <Section title="Pledge Wall Rules">
              <p>The Break Free pledge wall is a community space. Pledges must be genuine and constructive. We moderate and remove pledges that contain profanity, hate speech, or personal information.</p>
            </Section>

            <Section title="Enforcement">
              <p>We reserve the right to remove content, suspend access, or permanently ban accounts that violate this policy without prior notice in severe cases. We will attempt to notify users of less severe violations before taking action.</p>
            </Section>

            <Section title="Reporting Violations">
              <p>If you observe a violation of this policy, contact us at <span className="text-[var(--brand-400)]">focusarx@gmail.com</span></p>
            </Section>
          </div>

          <LegalFooter />
        </PageTransition>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--rgba-124-58-237-0_1)] bg-[var(--rgba-16-23-50-0_4)] p-6">
      <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-[var(--foreground-muted)] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2">{children}</div>
    </section>
  );
}

function LegalFooter() {
  const links = [
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/cookie-policy", label: "Cookies" },
    { href: "/acceptable-use", label: "Acceptable Use" },
    { href: "/ai-policy", label: "AI Policy" },
    { href: "/data-deletion", label: "Data Deletion" },
  ];
  return (
    <div className="mt-10 flex flex-wrap gap-3 border-t border-[var(--rgba-124-58-237-0_1)] pt-6">
      {links.map(({ href, label }) => (
        <Link key={href} href={href} className="text-xs text-[var(--foreground-subtle)] hover:text-[var(--brand-400)] transition-colors">
          {label}
        </Link>
      ))}
    </div>
  );
}
