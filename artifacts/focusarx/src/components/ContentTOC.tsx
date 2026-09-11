import { headingAnchors } from "@/lib/heading-id.mjs";

/**
 * Jump-link table of contents for long-form pages.
 *
 * Three jobs, in order of importance:
 *  1. A reader on a 2,000-word exam guide can get to "Section strategy" without
 *     scrolling — which is the difference between reading it and abandoning it.
 *  2. Every heading is a candidate featured-snippet target, and an anchor to it
 *     means the answer is one click from the top of the page.
 *  3. It makes the page's structure crawlable as internal fragment links, so a
 *     crawler sees the sections rather than inferring them.
 *
 * The ids come from `headingAnchors()` in src/lib/heading-id.mjs — the same
 * function scripts/prerender.mjs uses when it writes the static body — so an
 * anchor in the prerendered HTML and the heading a hydrated page renders always
 * match. Anchors are plain `<a href="#id">`: wouter only intercepts `<Link>`, so
 * the browser handles the fragment natively and no client router state changes.
 *
 * Scrolling is CSS (`scroll-behavior`) with a `prefers-reduced-motion` opt-out,
 * not JS, so a jump link costs no runtime and respects the user's setting.
 */
export function ContentTOC({
  headings,
  label = "On this page",
  className = "",
}: {
  /** Heading text, in document order. */
  headings: string[];
  /** Accessible name for the nav landmark. */
  label?: string;
  className?: string;
}) {
  // One heading is not a table of contents.
  if (headings.length < 2) return null;
  const items = headingAnchors(headings);

  return (
    <nav
      aria-label={label}
      className={`rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
        {label}
      </p>
      <ol className="mt-3 grid gap-1 sm:grid-cols-2">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="flex min-h-[36px] items-baseline gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--brand-strong)] focus-visible:bg-[var(--surface-raised)]"
            >
              <span className="text-xs tabular-nums text-[var(--foreground-subtle)]">{i + 1}</span>
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
