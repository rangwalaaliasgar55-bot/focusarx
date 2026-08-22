import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { Shield, ArrowLeft } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

export default function PrivacyPage() {
  return (
    <div className="relative min-h-[100dvh] forge-bg-glow">
      <PageSEO {...PAGE_SEO.privacy} />
      <main id="main-content" className="relative z-[var(--z-content)] mx-auto max-w-3xl px-4 py-10">
        <PageTransition>
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs text-[var(--foreground-subtle)] hover:text-[var(--brand-400)] transition-colors">
            <ArrowLeft size={13} /> Back to FocusArx
          </Link>

          <header className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--rgba-124-58-237-0_15)]">
                <Shield size={20} className="text-[var(--brand-400)]" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--foreground-subtle)]">Legal</p>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">Privacy Policy</h1>
              </div>
            </div>
            <p className="text-xs text-[var(--foreground-subtle)]">Last updated: August 2026</p>
          </header>

          <div className="prose-legal space-y-8">
            <Section title="1. Information We Collect">
              <p>We collect information you provide directly, including your name, email address, and password when you register. For guest sessions, we generate an anonymous identifier stored locally.</p>
              <p className="mt-3">We automatically collect usage data such as focus session durations, break patterns, task completions, and interaction events to power your productivity analytics and gamification features.</p>
            </Section>

            <Section title="2. How We Use Your Information">
              <ul>
                <li>Provide and improve the FocusArx service</li>
                <li>Calculate your XP, coins, streaks, and leaderboard rankings</li>
                <li>Generate personalised AI coaching and study roadmaps</li>
                <li>Send account-related emails (password resets, if configured)</li>
                <li>Conduct aggregate, anonymised analytics to understand product usage</li>
              </ul>
            </Section>

            <Section title="3. AI Features & Data Processing">
              <p>FocusArx uses third-party AI providers (Groq / Llama 3 and Google Gemini) to power the Coach and Roadmap features. When you use these features, your messages and limited session context are sent to these providers. We do not share personally identifiable information with AI providers beyond what is necessary for the request.</p>
              <p className="mt-3">Webcam-based attention monitoring (MediaPipe) is processed entirely locally in your browser. No video data is transmitted to our servers.</p>
            </Section>

            <Section title="4. Data Retention">
              <p>We retain your account data for as long as your account is active. You can request deletion at any time via <Link href="/data-deletion" className="text-[var(--brand-400)] hover:underline">our data deletion page</Link>. Guest session data is eligible for purging after 30 days of inactivity.</p>
            </Section>

            <Section title="5. Cookies & Local Storage">
              <p>We use browser local storage for your session token and preferences. We do not use third-party advertising cookies. For analytics, we use a self-hosted system that collects anonymous visitor metrics.</p>
            </Section>

            <Section title="6. Sharing & Disclosure">
              <p>We do not sell your personal data. We may share aggregated, non-identifiable statistics publicly (e.g. total focus hours across the platform). We will disclose information where required by law.</p>
            </Section>

            <Section title="7. Your Rights">
              <p>Depending on your jurisdiction, you may have rights to access, correct, or delete your personal data. Contact us or use the <Link href="/data-deletion" className="text-[var(--brand-400)] hover:underline">data deletion page</Link> to exercise these rights.</p>
            </Section>

            <Section title="8. Contact">
              <p>Questions about this policy? Reach us at <span className="text-[var(--brand-400)]">focusarx@gmail.com</span></p>
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
      <div className="space-y-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{children}</div>
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
