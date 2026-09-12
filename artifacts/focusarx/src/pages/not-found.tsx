import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Compass, Search, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSEO } from "@/components/PageSEO";
import { PAGE } from "@/lib/animations";

/**
 * The client-rendered half of FocusArx's 404.
 *
 * Two documents answer an unknown URL, and they have to agree:
 *
 *   1. `dist/public/404.html` (scripts/prerender.mjs → `buildNotFoundPage`)
 *      is what the server returns, with a real **HTTP 404 status** and
 *      `noindex, nofollow`. vercel.json routes every path that is neither a
 *      file nor a known SPA route to it.
 *   2. This component is what a browser paints once React mounts on top of
 *      that document.
 *
 * Before (1) existed, the catch-all rewrote unknown paths to `/index.html`
 * with status **200** — the homepage prerender, homepage title and
 * `canonical: /`. Google indexed those junk URLs as homepage duplicates and
 * reported "Duplicate, Google chose different canonical". A 200 + canonical
 * pointing home is a soft-404, and no amount of client-side `noindex` fixes
 * it for a crawler that never runs JS or for the status code itself.
 *
 * So: the status and the robots directive live in the prerendered document;
 * this file owns the recovery experience — a search box and links to the
 * pages people actually want. Keep both in sync when routes move.
 */
const POPULAR_LINKS: Array<{ href: string; label: string; hint: string }> = [
  { href: "/pomodoro-timer", label: "Pomodoro timer", hint: "25/5 sprints, free" },
  { href: "/focus-timer", label: "Focus timer", hint: "Deep work sessions" },
  { href: "/study-timer", label: "Study timer", hint: "Timed study blocks" },
  { href: "/guides", label: "Study guides", hint: "Focus, recall, revision" },
  { href: "/exam", label: "Exam plans", hint: "JEE, NEET, UPSC and more" },
  { href: "/blog", label: "Blog", hint: "Short, sourced reads" },
];

export default function NotFound() {
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    // /search reads ?q= straight from the URL, so a hard navigation and this
    // client-side one land on exactly the same state.
    navigate(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  };

  return (
    <div className="relative min-h-screen overflow-hidden forge-bg-glow flex items-center justify-center px-4 py-12">
      <PageSEO
        title="Page not found"
        description="That FocusArx page does not exist. Search the site, or jump to the Pomodoro timer, study guides, exam plans and the blog."
        noindex
      />
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 z-[var(--z-base)]" aria-hidden>
        <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,var(--rgba-124-58-237-0_10),transparent_65%)] blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,var(--rgba-6-214-160-0_06),transparent_65%)] blur-3xl" />
      </div>

      <motion.div
        variants={PAGE}
        initial="initial"
        animate="animate"
        className="relative z-[var(--z-content)] w-full max-w-lg"
      >
        <div className="text-center">
          {/* 404 number */}
          <div className="relative mb-4 inline-block">
            <span
              className="font-metric text-[7rem] font-bold leading-none select-none sm:text-[8rem]"
              style={{
                background: "linear-gradient(135deg, var(--rgba-124-58-237-0_25), var(--rgba-167-139-250-0_15))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
              aria-hidden
            >
              404
            </span>
            {/* Floating icon overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-2xl)] bg-gradient-to-br from-[var(--brand-violet)] to-[var(--palette-4f46e5)] shadow-[var(--shadow-violet-lg)]">
                <Compass size={26} className="text-[var(--palette-white)]" aria-hidden />
              </div>
            </div>
          </div>

          <h1 className="text-h2 text-[var(--foreground)] mb-3">Page not found</h1>
          <p className="text-[var(--foreground-muted)] mb-6 leading-relaxed">
            Nothing lives at this address — it may have moved, or the link may have a typo.
            Search below, or pick up where the timers are.
          </p>
        </div>

        <form onSubmit={submitSearch} role="search" className="mb-6 flex gap-2">
          <label htmlFor="not-found-search" className="sr-only">
            Search FocusArx
          </label>
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)]"
              aria-hidden
            />
            <Input
              id="not-found-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try “pomodoro”, “JEE”, “deep work”"
              autoComplete="off"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="glow" className="shrink-0">
            Search
          </Button>
        </form>

        <div className="rounded-[var(--radius-2xl)] border border-[var(--card-border)] bg-[var(--surface)] p-2">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--foreground-muted)]">
            Popular pages
          </p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {POPULAR_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-baseline justify-between gap-2 rounded-[var(--radius-lg)] px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)]"
                >
                  <span className="text-sm font-medium text-[var(--foreground)]">{link.label}</span>
                  <span className="text-xs text-[var(--foreground-muted)]">{link.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/">
            <Button size="lg" variant="glow" className="w-full sm:w-auto">
              <Zap className="size-4" />
              Back to homepage
            </Button>
          </Link>
          <Button size="lg" variant="outline" onClick={() => window.history.back()} className="w-full sm:w-auto">
            <ArrowLeft className="size-4" />
            Go back
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
