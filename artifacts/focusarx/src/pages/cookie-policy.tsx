import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { Database, ArrowLeft } from "lucide-react";

export default function CookiePolicyPage() {
  return (
    <div className="relative min-h-[100dvh] forge-bg-glow">
      <main id="main-content" className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        <PageTransition>
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs text-[#4B5563] hover:text-[#A78BFA] transition-colors">
            <ArrowLeft size={13} /> Back to FocusArx
          </Link>

          <header className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(124,58,237,0.15)]">
                <Database size={20} className="text-[#A78BFA]" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4B5563]">Legal</p>
                <h1 className="text-2xl font-bold text-[#E2E8F0]">Cookie Policy</h1>
              </div>
            </div>
            <p className="text-xs text-[#4B5563]">Last updated: June 2025</p>
          </header>

          <div className="space-y-8">
            <Section title="What We Use Instead of Cookies">
              <p>FocusArx is a single-page application that primarily uses <strong className="text-[#E2E8F0]">browser localStorage</strong> rather than cookies to store your session. This means your authentication token and preferences are kept locally in your browser and are never transmitted to advertising networks.</p>
            </Section>

            <Section title="localStorage Items">
              <p>The following items are stored in your browser's localStorage:</p>
              <ul>
                <li><code className="rounded bg-[rgba(124,58,237,0.15)] px-1.5 py-0.5 text-[#A78BFA]">focusarx-auth-token</code> — Your JWT authentication token (expires after 7 days).</li>
                <li><code className="rounded bg-[rgba(124,58,237,0.15)] px-1.5 py-0.5 text-[#A78BFA]">focusarx-guest-key</code> — Anonymous guest session identifier.</li>
                <li><code className="rounded bg-[rgba(124,58,237,0.15)] px-1.5 py-0.5 text-[#A78BFA]">focusarx-timer-*</code> — Active timer state backup (allows recovery if you close your tab).</li>
                <li><code className="rounded bg-[rgba(124,58,237,0.15)] px-1.5 py-0.5 text-[#A78BFA]">focusarx-onboarding-*</code> — Onboarding completion flags.</li>
              </ul>
            </Section>

            <Section title="Admin Cookie (Staff Only)">
              <p>The admin panel uses a short-lived <code className="rounded bg-[rgba(124,58,237,0.15)] px-1.5 py-0.5 text-[#A78BFA]">focusarx_admin</code> HttpOnly cookie for session management. This cookie is only set when accessing the admin dashboard and is not used for tracking.</p>
            </Section>

            <Section title="Third-Party Cookies">
              <p>We do not use third-party advertising or tracking cookies. Google Fonts are loaded from Google's CDN, which may set its own cookies per Google's policies.</p>
            </Section>

            <Section title="Analytics">
              <p>Our analytics system uses an anonymous <code className="rounded bg-[rgba(124,58,237,0.15)] px-1.5 py-0.5 text-[#A78BFA]">focusarx-visitor-id</code> stored in localStorage to count unique visitors without identifying them personally.</p>
            </Section>

            <Section title="Managing Your Stored Data">
              <p>You can clear all locally stored data at any time by clearing your browser's site data for focusarx.app. This will sign you out and reset your local preferences. To delete your account data from our servers, visit the <Link href="/data-deletion" className="text-[#A78BFA] hover:underline">Data Deletion page</Link>.</p>
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
    <section className="rounded-2xl border border-[rgba(124,58,237,0.1)] bg-[rgba(16,23,50,0.4)] p-6">
      <h2 className="mb-3 text-base font-semibold text-[#E2E8F0]">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-[#94A3B8] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2">{children}</div>
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
    <div className="mt-10 flex flex-wrap gap-3 border-t border-[rgba(124,58,237,0.1)] pt-6">
      {links.map(({ href, label }) => (
        <Link key={href} href={href} className="text-xs text-[#4B5563] hover:text-[#A78BFA] transition-colors">
          {label}
        </Link>
      ))}
    </div>
  );
}
