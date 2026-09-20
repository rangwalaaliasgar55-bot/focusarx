import { Link } from "wouter";
import { Check, ArrowLeft, Crown, CreditCard, Sparkles, Zap } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

const FREE = ["Unlimited focus timer and guest sessions", "Tasks, goals, streaks and core analytics", "Study rooms, guides and exam plans", "Earn Focus Credits from verified sessions"];
const PRO = ["Everything in Free", "Unlimited AI coaching and roadmaps", "Advanced analytics and Focus DNA", "All premium themes, scenes and cosmetics", "No ads on any working surface"];

function FeatureList({ items }: { items: string[] }) {
  return <ul className="mt-6 space-y-3">{items.map((item) => <li key={item} className="flex items-start gap-2 text-sm text-[var(--foreground-muted)]"><Check size={15} className="mt-0.5 shrink-0 text-[var(--brand-teal)]" />{item}</li>)}</ul>;
}

export default function PricingPage() {
  const productSchema = {
    "@context": "https://schema.org", "@type": "Product", name: "FocusArx Pro", image: "https://www.focusarx.site/logo.png",
    description: "FocusArx Pro adds unlimited AI coaching, advanced analytics and premium customization. Pay by card or UPI, or earn access with Focus Credits.",
    brand: { "@type": "Brand", name: "FocusArx" },
  };
  return <div className="min-h-[100dvh] forge-bg-glow">
    <PageSEO {...PAGE_SEO.pricing} structuredData={productSchema} />
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/" className="mb-8 inline-flex min-h-11 items-center gap-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--brand-400)]"><ArrowLeft size={15} /> Back to FocusArx</Link>
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-400)]">Pay with money or pay with focus</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">A generous free plan. Two ways to unlock Pro.</h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--foreground-muted)]">The timer, tasks, goals, streaks, study rooms and guides stay free. Choose a normal subscription when convenience matters, or exchange Focus Credits earned from completed sessions. Earning access remains a full alternative—not a trial and not a discount code.</p>
      </header>

      <section className="mt-10 grid gap-5 lg:grid-cols-3" aria-label="FocusArx plans">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-6">
          <Zap className="text-[var(--brand-teal)]" /><h2 className="mt-4 text-2xl font-bold">Free</h2><p className="mt-2 text-4xl font-bold">₹0 <span className="text-base font-medium text-[var(--foreground-subtle)]">forever</span></p>
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">Start without an account or payment method. Create an account only when you want synced history.</p><FeatureList items={FREE} />
          <Link href="/focus" className="mt-8 flex min-h-11 items-center justify-center rounded-xl border border-[var(--brand-500)] font-bold text-[var(--brand-400)]">Start focusing</Link>
        </article>

        <article className="relative rounded-2xl border-2 border-[var(--brand-500)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-violet-sm)]">
          <span className="absolute -top-3 right-5 rounded-full bg-[var(--brand-600)] px-3 py-1 text-xs font-bold text-white">Most direct</span>
          <CreditCard className="text-[var(--brand-400)]" /><h2 className="mt-4 text-2xl font-bold">Pro subscription</h2>
          <p className="mt-2 text-3xl font-bold">₹199 <span className="text-base font-medium text-[var(--foreground-subtle)]">/ month</span></p><p className="mt-1 text-sm font-semibold text-[var(--brand-teal)]">₹1,499/year · save 37%</p>
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">India checkout supports UPI and cards through Razorpay when enabled. International card checkout uses Stripe, with launch pricing of $4.99 monthly or $39 annually.</p><FeatureList items={PRO} />
          <Link href="/premium" className="mt-8 flex min-h-11 items-center justify-center rounded-xl bg-[var(--brand-600)] font-bold text-white">Choose Pro</Link>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-6">
          <Sparkles className="text-[var(--brand-gold)]" /><h2 className="mt-4 text-2xl font-bold">Pro with Focus Credits</h2><p className="mt-2 text-3xl font-bold">10,000 <span className="text-base font-medium text-[var(--foreground-subtle)]">credits / 30 days</span></p>
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">A completed verified session earns 50 credits, with daily anti-abuse limits. Quests, streaks and referrals can add more. The same Pro entitlement is granted whichever door you use.</p>
          <ul className="mt-6 space-y-3 text-sm text-[var(--foreground-muted)]"><li>90 days — 25,000 credits</li><li>365 days — 80,000 credits</li><li className="flex items-start gap-2"><Crown size={15} className="mt-0.5 text-[var(--brand-gold)]" />No card required for the earned route</li></ul>
          <Link href="/premium" className="mt-8 flex min-h-11 items-center justify-center rounded-xl border border-[var(--brand-gold)] font-bold text-[var(--brand-gold)]">Use Focus Credits</Link>
        </article>
      </section>

      <section className="mx-auto mt-12 max-w-4xl rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-7">
        <h2 className="text-2xl font-bold">What never changes</h2>
        <div className="mt-4 grid gap-6 text-sm leading-relaxed text-[var(--foreground-muted)] md:grid-cols-2"><p>FocusArx does not put the basic study loop behind a subscription. You can run the timer, plan work, join study rooms and build a streak on Free. Pro funds costly AI usage and adds deeper analysis and customization.</p><p>Payments create the same provider-neutral entitlement as Focus Credits. FocusArx does not sell focus history or webcam data. Card details are handled by Stripe or Razorpay and are not stored on FocusArx servers.</p></div>
      </section>
    </main>
  </div>;
}
