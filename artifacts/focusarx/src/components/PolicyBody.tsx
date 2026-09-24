import { Link } from "wouter";
import { LEGAL_FOOTER_LINKS } from "@/content/policy-pages.mjs";

export interface PolicySection {
  h: string;
  p?: string | string[];
  bullets?: string[];
}

/**
 * The rendered form of a policy document.
 *
 * The sections come from `src/content/policy-pages.mjs` — the same array
 * `scripts/prerender-data.mjs` writes into the static HTML — so the document a
 * crawler reads and the document a visitor reads are one artefact rendered
 * twice, never two copies of the copy. That is what makes the depth gate in
 * `scripts/seo-validate.mjs` meaningful on these pages: it is measuring what
 * both audiences actually receive.
 */
export function PolicyBody({ sections }: { sections: PolicySection[] }) {
  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.h} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6">
          <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">{section.h}</h2>
          <div className="space-y-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
            {(Array.isArray(section.p) ? section.p : section.p ? [section.p] : []).map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
            {section.bullets?.length ? (
              <ul className="list-disc space-y-2 pl-5">
                {section.bullets.map((bullet) => (
                  <li key={bullet.slice(0, 40)}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}

/** The legal footer shared by every policy page. */
export function LegalFooter() {
  return (
    <div className="mt-10 flex flex-wrap gap-3 border-t border-[var(--border-subtle)] pt-6">
      {LEGAL_FOOTER_LINKS.map(({ href, label }) => (
        <Link key={href} href={href} className="text-xs text-[var(--foreground-subtle)] transition-colors hover:text-[var(--brand-400)]">
          {label}
        </Link>
      ))}
    </div>
  );
}
