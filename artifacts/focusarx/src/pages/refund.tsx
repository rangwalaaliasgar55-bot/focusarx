import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { ArrowLeft, CreditCard } from "lucide-react";

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
            <p className="text-xs text-[#4B5563]">Last updated: June 2025</p>
          </header>

          <div className="space-y-8">
            <Section title="1. Free Tier">
              <p>FocusArx's core features are completely free — no credit card required. There is nothing to refund for free accounts. You may delete your account at any time via your profile settings or by contacting us.</p>
            </Section>

            <Section title="2. Premium Subscriptions">
              <p>If you purchase a FocusArx Premium subscription, you may request a full refund within <strong className="text-[#E2E8F0]">7 days</strong> of your initial purchase, provided you have not heavily utilised premium-only features during that period.</p>
              <p>After 7 days, refunds are evaluated on a case-by-case basis. Refunds will not be issued for partial billing periods.</p>
            </Section>

            <Section title="3. In-App Purchases (Coins & Items)">
              <p>Purchases of virtual currency (Forge Coins) and in-app items (themes, titles, boosts) are <strong className="text-[#E2E8F0]">non-refundable</strong> once the items have been delivered to your account, except where required by applicable law.</p>
              <p>If you believe a charge was made in error or without your authorisation, please contact us immediately.</p>
            </Section>

            <Section title="4. How to Request a Refund">
              <p>To request a refund, email us at <a href="mailto:support@focusarx.app" className="text-[#A78BFA] hover:underline">support@focusarx.app</a> with:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Your registered email address</li>
                <li>Date of purchase</li>
                <li>Reason for refund request</li>
              </ul>
              <p>We aim to respond within 3 business days.</p>
            </Section>

            <Section title="5. Chargebacks">
              <p>If you initiate a chargeback with your bank or payment provider without first contacting FocusArx support, we reserve the right to suspend your account pending resolution of the dispute.</p>
            </Section>

            <Section title="6. Legal Rights">
              <p>This policy does not affect any statutory rights you may have under applicable consumer protection laws in your jurisdiction, including rights under EU/UK consumer law.</p>
            </Section>

            <Section title="7. Contact">
              <p>Questions about this policy? Reach us at <a href="mailto:support@focusarx.app" className="text-[#A78BFA] hover:underline">support@focusarx.app</a> or visit our <Link href="/support" className="text-[#A78BFA] hover:underline">Support page</Link>.</p>
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
