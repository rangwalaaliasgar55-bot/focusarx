import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { ArrowLeft, CreditCard } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-bold text-[#E2E8F0]">{title}</h2>
      <div className="text-sm leading-relaxed text-[#94A3B8] space-y-2">{children}</div>
    </section>
  );
}

export default function RefundPage() {
  return (
    <div className="relative min-h-[100dvh] forge-bg-glow">
      <PageSEO {...PAGE_SEO.refund} />
      <main id="main-content" className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        <PageTransition>
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs text-[#4B5563] hover:text-[#A78BFA] transition-colors">
            <ArrowLeft size={13} /> Back to FocusArx
          </Link>

          <header className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(124,58,237,0.15)]">
                <CreditCard size={20} className="text-[#A78BFA]" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4B5563]">Legal</p>
                <h1 className="text-2xl font-bold text-[#E2E8F0]">Refund Policy</h1>
              </div>
            </div>
            <p className="text-xs text-[#4B5563]">Last updated: August 2026</p>
          </header>

          <div className="space-y-8">
            <Section title="1. Free Tier">
              <p>FocusArx's core features are completely free — no credit card required. There is nothing to refund for free accounts. You may delete your account at any time via your profile settings or by contacting us.</p>
            </Section>

            <Section title="2. Premium (Coin-Based)">
              <p>FocusArx Premium is not a paid subscription. It is unlocked with <strong className="text-[#E2E8F0]">9,000 in-app coins</strong>, which you earn by completing focus sessions and missions. Because no real money changes hands, there are no monetary refunds for Premium activation.</p>
              <p>If Premium was activated in error (for example, by accidental coin spending), contact us and we will review your case and may restore your coins at our discretion.</p>
            </Section>

            <Section title="3. Virtual Items & Coins">
              <p>Virtual currency (coins) and in-app items (themes, pets, boosts) earned or unlocked through the app are <strong className="text-[#E2E8F0]">non-refundable</strong> once delivered to your account, except where required by applicable law.</p>
            </Section>

            <Section title="4. How to Request Help">
              <p>If you believe coins were spent or lost in error, email us at <a href="mailto:focusarx@gmail.com" className="text-[#A78BFA] hover:underline">focusarx@gmail.com</a> with:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Your registered email address</li>
                <li>Date and time of the issue</li>
                <li>A short description of what happened</li>
              </ul>
              <p>We aim to respond within 3 business days.</p>
            </Section>

            <Section title="5. Future Paid Features">
              <p>If FocusArx ever introduces paid features in the future, this policy will be updated and a clear refund window will be published before any purchase is made.</p>
            </Section>

            <Section title="6. Legal Rights">
              <p>This policy does not affect any statutory rights you may have under applicable consumer protection laws in your jurisdiction, including rights under EU/UK consumer law.</p>
            </Section>

            <Section title="7. Contact">
              <p>Questions about this policy? Reach us at <a href="mailto:focusarx@gmail.com" className="text-[#A78BFA] hover:underline">focusarx@gmail.com</a> or visit our <Link href="/support" className="text-[#A78BFA] hover:underline">Support page</Link>.</p>
            </Section>
          </div>

          <div className="mt-12 flex flex-wrap gap-3 border-t border-[rgba(124,58,237,0.1)] pt-6 text-xs text-[#374151]">
            {[["/privacy","Privacy"], ["/terms","Terms"], ["/contact","Contact"], ["/support","Support"]].map(([href, label]) => (
              <Link key={href} href={href} className="hover:text-[#A78BFA] transition-colors">{label}</Link>
            ))}
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
