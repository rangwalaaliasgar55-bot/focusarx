import { Link } from "wouter";
import { PageSEO } from "@/components/PageSEO";

/**
 * Public changelog (Phase 4.6). One idea per screen: what shipped, newest
 * first. Content mirrors CHANGELOG.md at the repo root.
 */
export default function ChangelogPage() {
  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-16 sm:px-6">
      <PageSEO
        title="Changelog"
        description="What shipped in FocusArx lately: timer reliability fixes, streaks in your timezone, the /focus app and Instagram funnel."
      />
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">
        FocusArx
      </p>
      <h1 className="text-h1 mt-2">Changelog</h1>
      <p className="text-body mt-3 max-w-2xl text-[var(--foreground-muted)]">
        What shipped lately, newest first. Short sentences. No hype.
      </p>

      <section className="mt-10" aria-labelledby="unreleased">
        <h2 id="unreleased" className="text-h3">Unreleased</h2>
        <h3 className="text-h4 mt-6">Fixed</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] text-[var(--foreground-muted)]">
          <li>Guest timer sessions survive refresh, back-swipe, close and sleep.</li>
          <li>One tab runs the timer at a time; the other explains itself.</li>
          <li>Streaks use your timezone. Adopting one never resets progress.</li>
          <li>Completion chime plays after the autoplay-policy fix.</li>
          <li>No more raw 100vh layouts; legacy viewport fallbacks added.</li>
        </ul>
        <h3 className="text-h4 mt-6">Added</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] text-[var(--foreground-muted)]">
          <li><Link href="/focus" className="underline">/focus</Link>: public focus app with ?duration and ?task links.</li>
          <li>Device quality tiers with a manual override in Settings.</li>
          <li>One guidance pill inside Instagram and TikTok browsers.</li>
          <li>3D hero sleeps when the tab is hidden.</li>
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="v1">
        <h2 id="v1" className="text-h3">Version 1.0 and earlier</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] text-[var(--foreground-muted)]">
          <li>Apple-style interface pass and scroll motion.</li>
          <li>Prerendered SEO pages, sitemap segments, exam guides.</li>
          <li>Server-verified sessions with idempotent completion.</li>
          <li>Guest accounts, rotating refresh tokens, rate limits.</li>
          <li>Server-only AI with budgets and graceful fallbacks.</li>
          <li>Installable PWA shell with a versioned service worker.</li>
        </ul>
      </section>

      <div className="mt-12">
        <Link
          href="/focus"
          className="inline-flex min-h-[44px] items-center rounded-full bg-[var(--brand-600)] px-6 font-semibold text-white"
        >
          Start a focus session
        </Link>
      </div>
    </div>
  );
}
