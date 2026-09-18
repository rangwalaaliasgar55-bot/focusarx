import { useEffect } from "react";
import { Link } from "wouter";
import { PageSEO } from "@/components/PageSEO";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ContentTOC } from "@/components/ContentTOC";
import { AuthorBlock } from "@/components/AuthorBlock";
import { resolveAuthor } from "@/content/authors.mjs";
import { EDITIONS, SWITCHER_EDITIONS } from "@/content/locales.mjs";
import { localeRouteEntries } from "@/content/locale-pages.mjs";
import { citationParts } from "@/lib/citations.mjs";
import { headingId } from "@/lib/heading-id.mjs";
import { Globe } from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * ══════════════════════════════════════════════════════════════════
 * Localized edition page (India, US, Hindi, Spanish, Brazilian PT)
 * ══════════════════════════════════════════════════════════════════
 * Renders the copy in src/content/locale-pages.mjs — the SAME copy the
 * build-time prerenderer writes into dist/public/<edition>/index.html. That
 * symmetry is not optional: the prerenderer injects static content into #root
 * for crawlers that never execute JavaScript and React then replaces it, so if
 * the two disagreed, crawlers would be served content real visitors never see.
 * One content source makes the drift impossible rather than merely unlikely.
 *
 * Why this exists at all is in docs/GSC_INDEXING.md and at the top of
 * src/content/locales.mjs: the product is India-first in its code (21 of 23
 * exam guides are Indian exams, the AI coach's system prompt is written for
 * Indian aspirants, IST is the default calendar) while the site presented one
 * American-English homepage to every market, with four hreflang alternates
 * that all resolved to the same URL.
 */

const BASE_URL = (import.meta.env.VITE_APP_URL || "https://www.focusarx.site").replace(/\/+$/, "");

const ENTRIES = new Map(localeRouteEntries().map((e) => [e.path, e]));

type EditionEntry = ReturnType<typeof localeRouteEntries>[number];

function paragraph(p: string | string[]) {
  return (Array.isArray(p) ? p : [p]).map((para, i) => (
    <p key={i} className="mt-4 text-[15px] leading-relaxed text-[var(--foreground-muted)]">
      {para}
    </p>
  ));
}

/**
 * Edition switcher — the client-rendered twin of the one
 * scripts/prerender.mjs writes into every static document. Same five
 * destinations, same source of truth, so a crawler and a visitor are offered
 * the same set.
 */
function EditionSwitcher({ currentPath, currentEdition }: { currentPath: string; currentEdition: string }) {
  return (
    <nav
      aria-label="Choose your country or language"
      className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--brand-500)]/25 bg-[var(--brand-500)]/5 px-4 py-3"
    >
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.09em] text-[var(--foreground-muted)]">
        <Globe size={13} aria-hidden="true" /> Edition
      </span>
      {SWITCHER_EDITIONS.map((ed) => {
        const target = ed.path.replace(/\/$/, "") || "/";
        const isCurrent = target === currentPath;
        return isCurrent ? (
          <span
            key={ed.key}
            aria-current="true"
            className="rounded-full bg-[var(--brand-500)] px-3 py-1 text-[13px] font-semibold text-[var(--background)]"
          >
            {ed.label}
          </span>
        ) : (
          <Link
            key={ed.key}
            href={target}
            onClick={() =>
              track("edition_switcher_click", { from_edition: currentEdition, to_edition: ed.key })
            }
            className="rounded-full border border-[var(--brand-500)]/30 px-3 py-1 text-[13px] text-[var(--foreground)] transition-colors hover:bg-[var(--brand-500)]/15"
          >
            {ed.label}
          </Link>
        );
      })}
    </nav>
  );
}

function structuredDataFor(path: string, entry: EditionEntry): object[] {
  const url = `${BASE_URL}${path}`;
  const data: object[] = [];

  if (entry.software) {
    data.push({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: entry.software.name,
      applicationCategory: entry.software.category,
      operatingSystem: "Web",
      url,
      // Declared so a search engine does not have to infer the language of a
      // localized edition from its bytes.
      inLanguage: entry.lang,
      description: entry.software.description,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    });
  }

  if (entry.faq?.length) {
    data.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      // The FAQ block below renders these same pairs into the visible page:
      // structured data must describe content the reader can actually see.
      mainEntity: entry.faq.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    });
  }

  return data;
}

export function LocaleEditionPage({ path }: { path: string }) {
  const entry = ENTRIES.get(path);

  // Which market this document serves. Declared before the not-found return
  // below because React runs hooks in a fixed order on every render — a hook
  // after an early return changes that order and breaks the component. The
  // guard is inside the effect instead.
  useEffect(() => {
    if (!entry) return;
    track("edition_page_view", { edition: entry.editionKey, variant: path });
  }, [entry, path]);

  // A path with no written edition is a programming error, not a soft 404:
  // every route registered in App.tsx has a matching entry, and the build
  // fails (seo-validate) if a prerendered URL has no content behind it.
  if (!entry) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Edition not available</h1>
        <p className="mt-3 text-[var(--foreground-muted)]">
          <Link href="/" className="text-[var(--brand-400)] underline">
            Go to the FocusArx homepage
          </Link>
        </p>
      </main>
    );
  }

  const edition = EDITIONS.find((e) => e.key === entry.editionKey);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-10">
      <PageSEO
        title={entry.title}
        description={entry.description}
        canonical={path}
        breadcrumbLabel={entry.h1}
        structuredData={structuredDataFor(path, entry)}
      />

      <Breadcrumbs path={path} title={entry.h1} />

      <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">{entry.h1}</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-[var(--foreground-muted)]">{entry.lead}</p>

      <EditionSwitcher currentPath={path} currentEdition={entry.editionKey} />

      <AuthorBlock author={resolveAuthor(undefined)} lastReviewed={entry.lastReviewed} />

      <ContentTOC headings={entry.sections.map((s) => s.h)} />

      {entry.sections.map((section) => (
        <section key={section.h} className="mt-10">
          <h2 id={headingId(section.h)} className="text-xl font-semibold tracking-tight">
            {section.h}
          </h2>
          {section.p ? paragraph(section.p) : null}
          {section.bullets?.length ? (
            <ul className="mt-4 space-y-2">
              {section.bullets.map((b) => (
                <li
                  key={b}
                  className="flex gap-2 text-[15px] leading-relaxed text-[var(--foreground-muted)]"
                >
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-400)]" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      {entry.faq?.length ? (
        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">
            {entry.editionKey === "hi"
              ? "अक्सर पूछे जाने वाले सवाल"
              : entry.editionKey === "es"
                ? "Preguntas frecuentes"
                : entry.editionKey === "pt-br"
                  ? "Perguntas frequentes"
                  : "Frequently asked questions"}
          </h2>
          <dl className="mt-5 space-y-5">
            {entry.faq.map(([q, a]) => (
              <div key={q}>
                <dt className="font-medium">{q}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-[var(--foreground-muted)]">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {entry.sources?.length ? (
        <section className="mt-10 rounded-xl border border-[var(--border)] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            {entry.editionKey === "hi" ? "स्रोत" : entry.editionKey === "es" ? "Fuentes" : entry.editionKey === "pt-br" ? "Fontes" : "Sources and attribution"}
          </h2>
          <ul className="mt-3 space-y-1.5 text-[14px]">
            {entry.sources.map((src) => {
              const { text, url } = citationParts(src);
              return (
                <li key={src}>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--brand-400)] underline"
                    >
                      {text}
                    </a>
                  ) : (
                    text
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {entry.related?.length ? (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            {entry.editionKey === "hi" ? "आगे पढ़ें" : entry.editionKey === "es" ? "Sigue leyendo" : entry.editionKey === "pt-br" ? "Continue lendo" : "Keep reading"}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {entry.related.map((pair) => {
              const [href, label] = String(pair).split("|");
              return (
                <li key={href}>
                  <Link
                    href={href ?? "/"}
                    className="inline-block rounded-lg border border-[var(--border)] px-3 py-1.5 text-[14px] transition-colors hover:border-[var(--brand-500)]/40"
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="mt-12">
        <Link
          href={entry.cta.href}
          onClick={() =>
            track("cta_click", { placement: "edition_closing", href: entry.cta.href, edition: entry.editionKey })
          }
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-500)] px-6 py-3 font-semibold text-[var(--background)] transition-opacity hover:opacity-90"
        >
          {entry.cta.label}
        </Link>
        <p className="mt-3 text-[13px] text-[var(--foreground-muted)]">
          {edition?.market}
        </p>
      </div>
    </main>
  );
}

export default LocaleEditionPage;
