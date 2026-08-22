import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function AiPolicyPage() {
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
                <Sparkles size={20} className="text-[var(--brand-400)]" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--foreground-subtle)]">Legal</p>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">AI Usage Policy</h1>
              </div>
            </div>
            <p className="text-xs text-[var(--foreground-subtle)]">Last updated: August 2026</p>
          </header>

          <div className="space-y-8">
            <Section title="AI Features in FocusArx">
              <p>FocusArx uses artificial intelligence to power two core features:</p>
              <ul>
                <li><strong className="text-[var(--foreground)]">FocusArx Coach</strong> — A conversational productivity coach powered by Groq's Llama 3 model that provides personalised focus tips, motivation, and session-aware guidance.</li>
                <li><strong className="text-[var(--foreground)]">AI Study Roadmap</strong> — A roadmap generator powered by Google Gemini 2.5 Flash that creates structured learning paths for any subject.</li>
                <li><strong className="text-[var(--foreground)]">Webcam Attention Monitoring</strong> — Powered by MediaPipe running <em>entirely in your browser</em>. No video is sent to any server.</li>
              </ul>
            </Section>

            <Section title="Data Sent to AI Providers">
              <p>When you use the Coach or Roadmap features, the following information may be sent to third-party AI providers:</p>
              <ul>
                <li>Your typed message to the coach</li>
                <li>Recent conversation history (up to 8 messages)</li>
                <li>Anonymised session context (e.g. "currently in a 25-min focus session with 12 min remaining")</li>
                <li>Your readiness score if you've completed a daily check-in</li>
                <li>Your stated focus goal (from onboarding)</li>
              </ul>
              <p className="mt-2">We do not send your full name, email address, password, or payment information to AI providers.</p>
            </Section>

            <Section title="AI Providers & Their Policies">
              <ul>
                <li><strong className="text-[var(--foreground)]">Groq (Coach)</strong> — Requests are processed via Groq Cloud. See <a href="https://groq.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-400)] hover:underline">Groq's Privacy Policy</a>.</li>
                <li><strong className="text-[var(--foreground)]">Google Gemini (Roadmap)</strong> — Requests use the Gemini API. See <a href="https://ai.google.dev/terms" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-400)] hover:underline">Google AI Terms</a>.</li>
              </ul>
            </Section>

            <Section title="Limitations of AI Outputs">
              <p>AI-generated content in FocusArx is for informational and motivational purposes only. It does not constitute professional medical, psychological, educational, or career advice. Do not rely solely on AI responses for important decisions.</p>
              <p className="mt-2">AI models can make mistakes. If the Coach gives incorrect or unhelpful guidance, you can simply continue the conversation or ignore the response.</p>
            </Section>

            <Section title="Fallback Behaviour">
              <p>If AI providers are unavailable or API keys are not configured, FocusArx falls back to built-in curated responses. You will see a "Basic" indicator in the Coach panel when this is the case. Core productivity features (timer, tasks, streaks, analytics) never depend on AI and are always available.</p>
            </Section>

            <Section title="Rate Limits">
              <p>To ensure fair access and control costs, AI features are rate-limited. The Coach allows up to 20 messages per minute per user. The Roadmap generator allows up to 10 saves per hour per user. These limits may be adjusted over time.</p>
            </Section>

            <Section title="Contact">
              <p>Questions about our AI usage? Contact <span className="text-[var(--brand-400)]">focusarx@gmail.com</span></p>
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
