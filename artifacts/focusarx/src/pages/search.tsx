import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Search as SearchIcon, Timer, BookOpen, Calculator, Info } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

import { SEARCH_INDEX, searchEntries, type SearchEntry } from "@/lib/searchIndex";

/** Sections that group the unfiltered list. */
const SECTION_ICONS: Record<SearchEntry["section"], React.ReactNode> = {
  Guides: <BookOpen size={14} />,
  Tools: <Calculator size={14} />,
  Features: <Timer size={14} />,
  Company: <Info size={14} />,
};

export default function SearchPage() {
  const [location] = useLocation();
  // The URL is the source, and typed text is an override. Copying `?q=` into state
  // inside an effect mounted the page twice — once with an empty box, once with the
  // query — and re-synced a value the location object already carries.
  const urlQuery = useMemo(() => {
    // wouter's location is the path; the query still lives on window.location. Read
    // both so the memo legitimately depends on navigation instead of a stale ref.
    const search = location.includes("?") ? `?${location.split("?").slice(1).join("?")}` : window.location.search;
    return new URLSearchParams(search).get("q") ?? "";
  }, [location]);
  const [typed, setTyped] = useState<string | null>(null);
  const query = typed ?? urlQuery;

  // Scoring lives in `lib/searchIndex.ts` so it is testable without rendering,
  // and so the index itself is covered by `searchIndex.test.ts` — which fails
  // when a route is added and neither indexed nor explicitly excluded.
  const results = useMemo(() => searchEntries(query), [query]);

  return (
    <div className="min-h-screen bg-[var(--muted)] text-[var(--foreground)]">
      <PageSEO {...PAGE_SEO.search} />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--brand-600)]/30 bg-[var(--brand-600)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--brand-400)]">
          <SearchIcon size={12} /> Search FocusArx
        </div>
        <h1 className="mb-3 text-3xl font-semibold text-[var(--foreground)] sm:text-4xl">Find what you need</h1>
        <p className="mb-6 text-[var(--foreground-muted)]">Search every guide, tool, and feature — from Pomodoro technique to ADHD focus strategies.</p>

        <div className="relative mb-8">
          <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Try 'pomodoro', 'adhd', 'procrastination'…"
            aria-label="Search FocusArx guides and tools"
            className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] py-4 pl-11 pr-4 text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-muted)] focus:border-[var(--brand-600)]/50"
          />
        </div>

        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--foreground-muted)]">
          {query.trim()
            ? `${results.length} result${results.length === 1 ? "" : "s"} for “${query.trim()}”`
            : `${SEARCH_INDEX.length} pages`}
        </p>

        <div className="space-y-3">
          {results.map((r) => (
            <Link
              key={r.path}
              href={r.path}
              className="group block rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-5 transition-all hover:border-[var(--brand-600)]/40 hover:bg-[var(--rgba-124-58-237-0_06)]"
            >
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--brand-400)]">
                {SECTION_ICONS[r.section]} {r.section}
              </div>
              <p className="mt-1 font-bold text-[var(--foreground)] group-hover:text-[var(--brand-400)]">{r.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--foreground-muted)]">{r.description}</p>
            </Link>
          ))}
          {results.length === 0 && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-8 text-center">
              <p className="font-bold text-[var(--foreground)]">No results for “{query}”</p>
              <p className="mt-1 text-sm text-[var(--foreground-muted)]">Try “focus”, “study”, “pomodoro”, or browse the <Link href="/guides" className="text-[var(--brand-400)] hover:underline">full guide library</Link>.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
