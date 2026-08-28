import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/Toast";

/**
 * Console hygiene across the public, crawler-visible pages.
 *
 * DevTools must be clean on page load. This renders each page inside the same
 * providers the app shell uses and fails on ANY console.error, console.warn or
 * uncaught exception — the categories that show up red/yellow in F12.
 */

type Entry = { level: "error" | "warn" | "uncaught"; text: string };

let entries: Entry[] = [];
const originals = { error: console.error, warn: console.warn };

function record(level: Entry["level"], args: unknown[]) {
  const text = args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === "string") return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    })
    .join(" ");
  entries.push({ level, text });
}

function onUncaught(e: ErrorEvent) { record("uncaught", [e.error ?? e.message]); }
function onRejection(e: PromiseRejectionEvent) { record("uncaught", [e.reason]); }

beforeEach(() => {
  entries = [];
  console.error = (...a: unknown[]) => record("error", a);
  console.warn = (...a: unknown[]) => record("warn", a);
  window.addEventListener("error", onUncaught as EventListener);
  window.addEventListener("unhandledrejection", onRejection as EventListener);
});

afterEach(() => {
  console.error = originals.error;
  console.warn = originals.warn;
  window.removeEventListener("error", onUncaught as EventListener);
  window.removeEventListener("unhandledrejection", onRejection as EventListener);
  cleanup();
});

function withProviders(node: React.ReactNode) {
  // retry:false keeps a failed background query from re-throwing after the
  // assertion window, which would surface as a spurious console error.
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  // Mirrors the provider stack App.tsx builds: QueryClient -> Auth -> Toast ->
  // Router. login/signup/study-rooms/break-free call useAuth(), which throws
  // outside AuthProvider, so omitting it produces a false failure rather than
  // a real console error.
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ToastProvider>
          <Router hook={memoryLocation({ path: "/" }).hook}>
            <Suspense fallback={null}>{node}</Suspense>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const PUBLIC_PAGES = [
  "about", "acceptable-use", "adhd-focus", "ai-policy", "breathe", "break-free",
  "comparison", "contact", "cookie-policy", "data-deletion", "deep-study-guide",
  "exam", "feynman-technique", "focus-guide", "focus-music", "guides", "landing",
  "leaderboard", "login", "pomodoro-guide", "pricing", "privacy",
  "science-of-deep-work", "search", "signup", "stop-procrastinating",
  "study-calculator", "study-method-quiz", "study-rooms", "study-techniques",
  "study-with-me", "support", "terms", "two-hour-study-method",
  "virtual-study-room",
];

const PAGES = PUBLIC_PAGES.map((name) => ({
  name,
  load: () => import(`@/pages/${name}`) as Promise<{ default: React.ComponentType }>,
}));

describe.each(PAGES)("$name page", ({ load }) => {
  it("mounts with a clean console", async () => {
    const mod = await load();
    const Page = mod.default;
    // act() is mandatory here: the pages suspend on lazy chunks, and React logs
    // "A suspended resource finished loading inside a test" if the resolution
    // happens outside act(). That message is a test-harness artifact and would
    // never appear in a browser, so it must not be counted as a console error.
    await act(async () => {
      render(withProviders(<Page />));
    });
    // Let effects, lazy boundaries and microtasks settle.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });

    const real = entries.filter((e) => !e.text.includes("was not wrapped in act("));
    const artifacts = entries.length - real.length;
    if (artifacts > 0) {
      originals.warn(`(ignored ${artifacts} act() harness artifact(s) — not browser output)`);
    }
    expect(
      real,
      `Console output during render:\n${real.map((e) => `  [${e.level}] ${e.text.slice(0, 400)}`).join("\n")}`,
    ).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════
// Source contract: keep the console clean on a healthy load
// ══════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname);

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name)) acc.push(full);
  }
  return acc;
}

describe("console output source contract", () => {
  it("no routine console.log / debug / info anywhere outside lib/logger.ts", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file);
      if (rel === path.join("lib", "logger.ts")) continue;
      fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (/console\.(log|debug|info)\(/.test(line)) offenders.push(`${rel}:${i + 1}`);
      });
    }
    expect(
      offenders,
      `Routine diagnostics must go through lib/logger.ts so a healthy page load\n` +
        `produces no DevTools output. Set localStorage["focusarx:debug"]="1" to see them:\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("console.warn / console.error are confined to genuine failure paths", () => {
    // These are the ONLY modules allowed to print unconditionally, and each one
    // represents a real failure a developer must see — never routine chatter.
    const ALLOWED = new Set([
      path.join("lib", "logger.ts"),
      path.join("components", "ErrorBoundary.tsx"),
      path.join("components", "camera", "FloatingCamera.tsx"),
      path.join("hooks", "useLocalStorage.ts"),
      path.join("pages", "messages.tsx"),
    ]);
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(SRC, file);
      if (ALLOWED.has(rel)) continue;
      fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (/console\.(warn|error)\(/.test(line)) offenders.push(`${rel}:${i + 1}`);
      });
    }
    expect(
      offenders,
      `Unconditional warn/error outside the allowlist. Routine fallbacks belong in\n` +
        `lib/logger.ts; if this is a genuine failure add the file to ALLOWED:\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("logger.error is never gated (real failures must always print)", () => {
    const s = fs.readFileSync(path.join(SRC, "lib", "logger.ts"), "utf8");
    const fn = s.slice(s.indexOf("error(...args: unknown[]): void"));
    expect(fn.slice(0, 200)).toContain("console.error(...args)");
    expect(fn.slice(0, 200), "logger.error must not check the debug flag").not.toContain("on()");
  });
});
