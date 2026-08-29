import { PageSEO } from "@/components/PageSEO";
import { AdSlot } from "@/components/AdSlot";
import { Link } from "wouter";
import { SEO_PAGES } from "@/content/seo-pages.mjs";
import type { SeoPage } from "@/content/seo-pages.mjs";
import { ArrowRight, BookOpen, ShieldCheck, Wrench } from "lucide-react";

/**
 * ══════════════════════════════════════════════════════════════════
 * Data-driven intent page
 * ══════════════════════════════════════════════════════════════════
 * Renders the copy in src/content/seo-pages.mjs — the SAME copy the
 * build-time prerenderer (scripts/prerender.mjs) writes into the static
 * HTML for this route.
 *
 * That symmetry is deliberate. The prerenderer injects static content into
 * #root for crawlers that never execute JavaScript; React then replaces it.
 * If the two versions disagreed, crawlers would be served content real
 * visitors never see, which is cloaking and a spam signal. One content
 * source makes the drift impossible rather than merely unlikely.
 *
 * It is also the "ranking page template" both SEO audits ask for: one H1,
 * a direct answer in the first paragraph, how-it-works sections, an
 * explicit limitations block, a visible evidence/attribution block, 2–4
 * contextual internal links, and a single conversion CTA.
 */

const KIND_META = {
  tool: { label: "Free tool", icon: Wrench },
  guide: { label: "Evidence-based guide", icon: BookOpen },
  trust: { label: "Transparency", icon: ShieldCheck },
} as const;

function paragraph(p: string | string[]) {
  return (Array.isArray(p) ? p : [p]).map((para, i) => (
    <p key={i} className="mt-4 text-[15px] leading-relaxed text-[var(--foreground-muted)]">
      {para}
    </p>
  ));
}

export default function SeoLandingPage({ path }: { path: string }) {
  const entry = SEO_PAGES[path] as SeoPage | undefined;

  // Every path here is statically registered in App.tsx, so a miss means the
  // route table and the content map drifted — the seoContract test catches it
  // before build, but we still render something honest rather than crashing.
  if (!entry) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-black text-[var(--foreground)]">Page unavailable</h1>
        <p className="mt-3 text-sm text-[var(--foreground-muted)]">
          This page is being updated. Try the guide library instead.
        </p>
        <Link href="/guides" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[var(--brand-600)] px-5 text-sm font-semibold text-white">
          Browse all guides
        </Link>
      </main>
    );
  }

  const Kind = KIND_META[entry.kind as keyof typeof KIND_META] ?? KIND_META.guide;
  const KindIcon = Kind.icon;

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <PageSEO
        title={entry.title}
        description={entry.description}
        canonical={path}
        ogType={entry.kind === "guide" ? "article" : "website"}
        structuredData={buildStructuredData(path, entry)}
      />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <header className="border-b border-[var(--rgba-255-255-255-0_06)] bg-[radial-gradient(ellipse_at_50%_0%,_var(--rgba-124-58-237-0_14),_transparent_70%)]">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-600)]/30 bg-[var(--brand-600)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--brand-400)]">
            <KindIcon size={12} /> {Kind.label}
          </span>
          <h1 className="mt-5 text-balance text-3xl font-black leading-tight tracking-tight text-[var(--foreground)] sm:text-5xl">
            {entry.h1}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-[var(--foreground-muted)] sm:text-lg">
            {entry.lead}
          </p>

          {/* Answer-first block: stands alone if quoted out of context by an
              AI Overview or a featured snippet. */}
          <p className="mt-6 rounded-2xl border border-[var(--rgba-255-255-255-0_08)] bg-[var(--rgba-255-255-255-0_03)] p-5 text-[15px] leading-relaxed text-[var(--foreground)]">
            {entry.answerFirst}
          </p>

          <Link
            href={entry.cta.href}
            className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand-600)] px-6 text-sm font-bold text-white transition-colors hover:bg-[var(--brand-700)]"
          >
            {entry.cta.label} <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        {/* ── How-to steps, when the page has them ───────────── */}
        {entry.howTo && (
          <section className="mb-12" aria-labelledby="steps-heading">
            <h2 id="steps-heading" className="text-2xl font-black text-[var(--foreground)]">
              {entry.howTo.name}
            </h2>
            <ol className="mt-6 space-y-4">
              {entry.howTo.steps.map((step, i) => (
                <li key={step.name} className="flex gap-4 rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--brand-600)]/15 text-sm font-bold text-[var(--brand-400)]">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--foreground)]">{step.name}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--foreground-muted)]">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ── Body sections ──────────────────────────────────── */}
        {entry.sections.map((s, i) => (
          <section key={s.h} className="mb-10">
            {/* One in-feed ad after the third section — never first, so the
                page always opens on content. */}
            {i === 3 && <AdSlot name="seoPageInFeed" minHeight={120} />}
            <h2 className="text-2xl font-black text-[var(--foreground)]">{s.h}</h2>
            {paragraph(s.p)}
          </section>
        ))}

        {/* ── FAQ ────────────────────────────────────────────── */}
        {entry.faq && entry.faq.length > 0 && (
          <section className="mt-14" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-2xl font-black text-[var(--foreground)]">
              Frequently asked questions
            </h2>
            <dl className="mt-6 divide-y divide-[var(--rgba-255-255-255-0_06)] border-y border-[var(--rgba-255-255-255-0_06)]">
              {entry.faq.map(([q, a]) => (
                <div key={q} className="py-5">
                  <dt className="text-sm font-bold text-[var(--foreground)]">{q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{a}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* ── Visible evidence / attribution ─────────────────── */}
        {entry.sources && entry.sources.length > 0 && (
          <section className="mt-10 rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_02)] p-5" aria-labelledby="sources-heading">
            <h2 id="sources-heading" className="text-xs font-bold uppercase tracking-widest text-[var(--foreground-subtle)]">
              Sources and attribution
            </h2>
            <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-[var(--foreground-subtle)]">
              {entry.sources.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            {entry.lastReviewed && (
              <p className="mt-3 text-xs text-[var(--foreground-subtle)]">
                Last reviewed {entry.lastReviewed}. Corrections:{" "}
                <Link href="/contact" className="text-[var(--brand-400)] underline">tell us</Link>.
              </p>
            )}
          </section>
        )}

        {/* ── Contextual internal links (crawlable HTML anchors) ── */}
        <nav aria-label="Related pages" className="mt-12 border-t border-[var(--rgba-255-255-255-0_06)] pt-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--foreground-subtle)]">
            Keep reading
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {entry.related.map((pair) => {
              const [href, label] = String(pair).split("|");
              return (
                <li key={href}>
                  <Link href={href!} className="block rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] px-4 py-3 text-sm text-[var(--brand-400)] transition-colors hover:border-[var(--brand-600)]/40">
                    {label || href}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Closing CTA ────────────────────────────────────── */}
        <section className="mt-12 rounded-2xl bg-[var(--brand-soft)] p-7 text-center">
          <h2 className="text-xl font-bold text-[var(--foreground)]">{entry.cta.label}</h2>
          <p className="mt-2 text-sm text-[var(--foreground-muted)]">
            Free forever at the core. No credit card, no trial countdown.
          </p>
          <Link href={entry.cta.href} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand-600)] px-6 text-sm font-bold text-white">
            {entry.cta.label} <ArrowRight size={15} />
          </Link>
        </section>
      </div>
    </main>
  );
}

/**
 * Structured data for this page, mirroring what prerender.mjs emits.
 *
 * Deliberately excludes aggregateRating: Google's review-snippet policy bars
 * self-serving reviews, and we have no sourced rating to publish. See /evidence.
 */
function buildStructuredData(path: string, entry: SeoPage): object[] {
  const data: object[] = [];

  if (entry.kind === "guide") {
    data.push({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: entry.h1,
      description: entry.description,
      dateModified: entry.lastReviewed,
      author: { "@type": "Organization", name: "FocusArx", url: "https://www.focusarx.site" },
      publisher: {
        "@type": "Organization",
        name: "FocusArx",
        logo: { "@type": "ImageObject", url: "https://www.focusarx.site/logo.png" },
      },
      mainEntityOfPage: `https://www.focusarx.site${path}`,
    });
  }

  if (entry.software) {
    data.push({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: entry.software.name,
      applicationCategory: entry.software.category,
      operatingSystem: "Web",
      url: `https://www.focusarx.site${path}`,
      description: entry.software.description,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    });
  }

  if (entry.howTo) {
    data.push({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: entry.howTo.name,
      description: entry.answerFirst,
      step: entry.howTo.steps.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    });
  }

  if (entry.faq?.length) {
    data.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: entry.faq.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    });
  }

  return data;
}
