import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/Toast";
import { PromptProvider } from "@/components/ui/PromptDialog";
import { SessionRecoveryProvider } from "@/components/SessionRecoveryContext";
import { MaintenanceGate } from "@/components/MaintenanceGate";

import LandingPage from "@/pages/landing";
import FocusPage from "@/pages/focus";
import DashboardPage from "@/pages/dashboard";
import LeaderboardPage from "@/pages/leaderboard";
import StudyRoomsPage from "@/pages/study-rooms";
import QuestsPage from "@/pages/quests";
import MarketplacePage from "@/pages/marketplace";
import ProfilePage from "@/pages/profile";
import PricingPage from "@/pages/pricing";
import OnboardingPage from "@/pages/onboarding";
import AchievementsPage from "@/pages/achievements";
import AnalyticsPage from "@/pages/analytics";
import SupportPage from "@/pages/support";
import ChangelogPage from "@/pages/changelog";

/**
 * Student walkthrough.
 *
 * Mounts each interface the way a signed-out student reaches it and reports what
 * is actually on the screen: how much has rendered, whether it is still in a
 * loading or empty state after a second, and anything logged to the console. The
 * point is to catch the pages where a first-time visitor sees nothing to do —
 * which is invisible in unit tests, because every unit passes.
 */

type Report = {
  page: string;
  chars: number;
  verdict: "content" | "thin" | "empty" | "crash";
  h: string;
  first: string;
  console: string[];
};

const reports: Report[] = [];
const log = console.log;
let console_: string[] = [];
const orig = { error: console.error, warn: console.warn };

function withProviders(node: React.ReactNode, path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 }, mutations: { retry: false } } });
  const { hook } = memoryLocation({ path });
  return (
    <QueryClientProvider client={client}>
      <Router hook={hook}>
        <AuthProvider>
          <ToastProvider>
            <PromptProvider>
              <SessionRecoveryProvider>
                <MaintenanceGate>{node}</MaintenanceGate>
              </SessionRecoveryProvider>
            </PromptProvider>
          </ToastProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

async function walk(name: string, path: string, Page: React.ComponentType, waitMs = 350) {
  console_ = [];
  let crashed = false;
  try {
    render(withProviders(<Page />, path));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await new Promise((r) => setTimeout(r, waitMs)); });
  } catch {
    crashed = true;
  }
  const text = (document.body.textContent ?? "").replace(/\s+/g, " ").trim();
  const h = Array.from(document.querySelectorAll("h1,h2")).map((e) => e.textContent?.trim()).filter(Boolean).slice(0, 3).join(" | ");
  const loading = /\bLoading\b|Loading…|\.\.\.$/.test(text.slice(0, 400));
  reports.push({
    page: name,
    chars: text.length,
    verdict: crashed ? "crash" : text.length < 140 ? "empty" : loading && text.length < 400 ? "thin" : "content",
    h: h.slice(0, 90),
    first: text.slice(0, 110),
    console: console_.slice(0, 3),
  });
  cleanup();
}

beforeEach(() => {
  console_ = [];
  console.error = (...a: unknown[]) => { console_.push(`error: ${a.map(String).join(" ").slice(0, 160)}`); };
  console.warn = (...a: unknown[]) => { console_.push(`warn: ${a.map(String).join(" ").slice(0, 160)}`); };
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

afterEach(() => {
  console.error = orig.error; console.warn = orig.warn;
  cleanup();
  vi.unstubAllGlobals();
});

describe("student walkthrough", () => {
  it("walks every interface a signed-out student can reach", async () => {
    await walk("Landing (guest /)", "/", LandingPage, 500);
    await walk("Focus (/focus?duration=25&src=ig)", "/focus", FocusPage, 700);
    await walk("Dashboard (signed out)", "/dashboard", DashboardPage);
    await walk("Leaderboard", "/leaderboard", LeaderboardPage, 500);
    await walk("Study rooms", "/study-rooms", StudyRoomsPage, 500);
    await walk("Quests", "/quests", QuestsPage);
    await walk("Marketplace", "/marketplace", MarketplacePage);
    await walk("Profile", "/profile", ProfilePage, 500);
    await walk("Pricing", "/pricing", PricingPage, 400);
    await walk("Onboarding", "/onboarding", OnboardingPage, 400);
    await walk("Achievements", "/achievements", AchievementsPage);
    await walk("Analytics", "/analytics", AnalyticsPage);
    await walk("Support", "/support", SupportPage, 400);
    await walk("Changelog", "/changelog", ChangelogPage, 400);

    log("=== STUDENT WALKTHROUGH ===");
    for (const r of reports) {
      log(`${r.verdict.toUpperCase().padEnd(8)} ${r.page.padEnd(34)} chars=${String(r.chars).padStart(5)}  h="${r.h}"`);
      log(`         first: ${r.first}`);
      if (r.console.length) log(`         console: ${JSON.stringify(r.console)}`);
    }
    expect(reports.length).toBeGreaterThan(10);
  }, 60000);
});
