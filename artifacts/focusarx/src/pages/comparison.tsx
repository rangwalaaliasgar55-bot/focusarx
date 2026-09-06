import { Check, Minus, ArrowRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { PageSEO } from "@/components/PageSEO";
import { AdSlot } from "@/components/AdSlot";
import { COMPARISONS, COMPARISON_PATHS } from "@/content/seo-pages.mjs";
import type { Comparison } from "@/content/seo-pages.mjs";

/**
 * ══════════════════════════════════════════════════════════════════
 * Comparison / alternative pages
 * ══════════════════════════════════════════════════════════════════
 * High-intent commercial research queries ("focusarx vs forest",
 * "forest alternative"). Routed as /comparison/:slug and driven by the
 * COMPARISONS map in src/content/seo-pages.mjs — the same map the
 * prerenderer and the sitemap read, so the three cannot drift.
 *
 * Editorial rule: competitor facts are limited to what those companies
 * state publicly about themselves. We describe differences; we do not
 * invent weaknesses, and "when to choose them instead" is a real section
 * on every page. A comparison that only ever recommends us reads as an ad
 * and ranks like one.
 */

/** `/comparison/focusarx-vs-forest` → `forest` (the map key). */
function keyFromPath(location: string): string | null {
  const slug = location.replace(/^\/comparison\//, "").replace(/\/+$/, "");
  const match = Object.entries(COMPARISONS).find(([, c]) => c.slug === slug);
  return match?.[0] ?? null;
}

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto text-[var(--success)]" size={18} aria-label="Yes" />
    ) : (
      <Minus className="mx-auto text-[var(--foreground-subtle)]" size={18} aria-label="No" />
    );
  }
  return <span className="block text-center text-xs leading-snug text-[var(--foreground-muted)]">{value}</span>;
}

export default function ComparisonPage() {
  const [location] = useLocation();
  const key = keyFromPath(location);

  // Unknown slug → an honest 404-style page with real navigation, not a
  // silently-wrong comparison. Soft-404s waste crawl budget.
  if (!key) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <PageSEO title="Comparison not found" description="That comparison page does not exist. See the comparisons we do publish." noindex />
        <h1 className="text-3xl font-semibold text-[var(--foreground)]">Comparison not found</h1>
        <p className="mt-3 text-sm text-[var(--foreground-muted)]">
          We only publish comparisons we can keep accurate. Here are the ones we have.
        </p>
        <ul className="mx-auto mt-8 grid max-w-sm gap-2 text-left">
          {COMPARISON_PATHS.map((href) => (
            <li key={href}>
              <Link href={href} className="block rounded-xl border border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--brand-400)] hover:border-[var(--brand-600)]/40">
                {COMPARISONS[Object.keys(COMPARISONS).find((k) => `/comparison/${COMPARISONS[k]!.slug}` === href)!]!.title}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const data: Comparison = COMPARISONS[key]!;
  const canonical = `/comparison/${data.slug}`;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <PageSEO
        title={`${data.title} | FocusArx`}
        description={data.description}
        canonical={canonical}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: `When should I choose FocusArx over ${data.name}?`,
              acceptedAnswer: { "@type": "Answer", text: data.whenOurs },
            },
            {
              "@type": "Question",
              name: `When should I choose ${data.name} over FocusArx?`,
              acceptedAnswer: { "@type": "Answer", text: data.whenTheirs },
            },
          ],
        }}
      />

      <p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-400)]">
        Product comparison · Updated 2026
      </p>
      <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
        {data.title}
      </h1>
      <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-[var(--foreground-muted)]">
        {data.lead}
      </p>

      {/* ── Feature table ─────────────────────────────────────── */}
      <div
        role="region"
        aria-label="Feature comparison table"
        // Scrollable regions must be focusable so keyboard users can scroll them (WCAG 2.1.1).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className="mt-10 overflow-x-auto rounded-2xl border border-[var(--border)]"
      >
        <div className="grid min-w-[30rem] grid-cols-[1.6fr_1fr_1fr] bg-[var(--surface-raised)] p-4 text-sm font-bold text-[var(--foreground)]">
          <span>Capability</span>
          <span className="text-center">FocusArx</span>
          <span className="text-center">{data.name}</span>
        </div>
        {data.rows.map(([label, ours, theirs]) => (
          <div key={label} className="grid min-h-14 min-w-[30rem] grid-cols-[1.6fr_1fr_1fr] items-center border-t border-[var(--border)] px-4 py-2 text-sm text-[var(--foreground)]">
            <span>{label}</span>
            <Cell value={ours} />
            <Cell value={theirs} />
          </div>
        ))}
      </div>

      {/* ── Honest two-sided verdict ──────────────────────────── */}
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-6">
          <h2 className="text-lg font-bold text-[var(--foreground)]">When FocusArx is the better fit</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">{data.whenOurs}</p>
          <ul className="mt-4 space-y-1.5">
            {data.ours.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-[var(--foreground-muted)]">
                <Check size={14} className="mt-1 shrink-0 text-[var(--success)]" /> {f}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-6">
          <h2 className="text-lg font-bold text-[var(--foreground)]">When {data.name} is the better fit</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">{data.whenTheirs}</p>
          <ul className="mt-4 space-y-1.5">
            {data.theirs.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-[var(--foreground-muted)]">
                <Check size={14} className="mt-1 shrink-0 text-[var(--brand-400)]" /> {f}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <AdSlot name="comparisonMid" minHeight={120} />

      {/* ── Other comparisons (internal linking between siblings) ── */}
      <nav aria-label="Other comparisons" className="mt-10">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--foreground-subtle)]">
          Other comparisons
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.values(COMPARISONS)
            .filter((c) => c.slug !== data.slug)
            .map((c) => (
              <Link
                key={c.slug}
                href={`/comparison/${c.slug}`}
                className="rounded-full border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--foreground-muted)] transition-colors hover:border-[var(--brand-600)]/40 hover:text-[var(--foreground)]"
              >
                FocusArx vs {c.name}
              </Link>
            ))}
        </div>
      </nav>

      {/* ── Related guides ────────────────────────────────────── */}
      <nav aria-label="Related learning guides" className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link className="text-[var(--brand-400)]" href="/focus-guide">How to focus</Link>
        <Link className="text-[var(--brand-400)]" href="/deep-work-guide">Deep work guide</Link>
        <Link className="text-[var(--brand-400)]" href="/pomodoro-guide">Pomodoro guide</Link>
        <Link className="text-[var(--brand-400)]" href="/study-techniques">Study techniques</Link>
        <Link className="text-[var(--brand-400)]" href="/evidence">Our claim policy</Link>
      </nav>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="mt-10 rounded-2xl bg-[var(--brand-soft)] p-7">
        <h2 className="text-xl font-bold text-[var(--foreground)]">Try FocusArx free</h2>
        <p className="mt-2 text-sm text-[var(--foreground-muted)]">
          The core timer, tasks, streaks and public study rooms are free forever — no credit card,
          and Premium unlocks with tokens you earn by focusing rather than by paying.
        </p>
        <Link
          href="/signup"
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand-600)] px-6 text-sm font-bold text-white transition-colors hover:bg-[var(--brand-700)]"
        >
          Start focusing free <ArrowRight size={15} />
        </Link>
      </section>
    </main>
  );
}
