import { useEffect } from "react";
import SeoLandingPage from "@/pages/seo-landing";
import { FocusTimerMobileFirst } from "@/components/mobile/FocusTimerMobileFirst";
import { dispatchFocusDeepLink } from "@/lib/focusDeepLink";
import { MINUTE_TIMER_DURATIONS } from "@/content/minute-timers.mjs";

/**
 * ══════════════════════════════════════════════════════════════════
 * X-minute timer page — one component, five routes
 * ══════════════════════════════════════════════════════════════════
 * `/5-minute-timer`, `/10-minute-timer`, `/15-minute-timer`,
 * `/30-minute-timer`, `/45-minute-timer`.
 *
 * The page *is* the timer: the countdown is pre-armed to that length the
 * moment the route mounts, so a visitor who searched "15 minute timer" lands
 * on a running 15-minute timer rather than on an article about one. All copy,
 * FAQ and structured data live in src/content/minute-timers.mjs — the same
 * module the build-time prerenderer reads — so the static HTML and the
 * rendered page can never disagree.
 *
 * Durations are registered explicitly in App.tsx (not via a `:param` route)
 * because every one of them is a separate indexed URL: static registration
 * keeps route ↔ sitemap ↔ prerender ↔ llms.txt provably in step, which is
 * what scripts/seo-validate.mjs and the api seoContract test check.
 */

function PresetTimer({ minutes }: { minutes: number }) {
  // Pre-arm the focus timer to this page's length. The event is the same one
  // `/focus?duration=N` deep links use, so one code path handles both.
  useEffect(() => {
    dispatchFocusDeepLink({
      durationSeconds: minutes * 60,
      task: null,
      src: null,
      armed: true,
    });
  }, [minutes]);

  return (
    <section
      className="mt-8"
      aria-label={`${minutes} minute countdown timer`}
      data-testid="minute-timer-app"
    >
      <FocusTimerMobileFirst />
    </section>
  );
}

export default function MinuteTimerPage({ minutes }: { minutes: number }) {
  const path = `/${minutes}-minute-timer`;
  // Defensive only: every published duration is statically routed, and an
  // unknown one would render SeoLandingPage's honest "page unavailable" state
  // instead of a timer armed to a length no content describes.
  const known = MINUTE_TIMER_DURATIONS.includes(minutes);

  return (
    <SeoLandingPage path={path} heroSlot={known ? <PresetTimer minutes={minutes} /> : undefined} />
  );
}
