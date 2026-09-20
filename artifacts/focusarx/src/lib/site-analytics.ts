/**
 * Site analytics client — persistent visitor ID, session reuse, batched events.
 * Non-blocking: all network I/O is deferred and debounced.
 */

const VISITOR_KEY = "focusarx_visitor_id";
const VISITOR_COOKIE = "focusarx_vid";
const SESSION_KEY = "focusarx_analytics_session";
const LAST_PAGE_KEY = "focusarx_last_page_track";

const SESSION_IDLE_MS = 30 * 60 * 1000;
const PAGE_DEDUPE_MS = 30 * 1000;
const FLUSH_MS = 5000;
const MAX_BATCH = 10;

export type AnalyticsEventType =
  | "focus_session_started"
  | "task_created"
  | "roadmap_generated"
  | "ai_feature_used"
  | "user_logged_in"
  | "user_signed_up"
  | "device_context"
  | "page_view";

type PendingEvent = {
  eventId: string;
  eventType: AnalyticsEventType;
  eventData?: Record<string, unknown>;
};

let sessionId: string | null = null;
let lastActivity = 0;
const pendingEvents: PendingEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let linkedUserId: string | null = null;

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ?? null;
}

function setCookie(name: string, value: string) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax${secure}`;
}

/** Persistent anonymous visitor ID — localStorage + cookie backup. */
export function getOrCreateVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) id = readCookie(VISITOR_COOKIE);
  if (!id) {
    id = `foc_${crypto.randomUUID()}`;
    localStorage.setItem(VISITOR_KEY, id);
    setCookie(VISITOR_COOKIE, id);
  } else {
    localStorage.setItem(VISITOR_KEY, id);
    setCookie(VISITOR_COOKIE, id);
  }
  return id;
}

function loadSession(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id: string; lastActivity: number };
    if (Date.now() - parsed.lastActivity > SESSION_IDLE_MS) return null;
    lastActivity = parsed.lastActivity;
    return parsed.id;
  } catch {
    return null;
  }
}

function saveSession(id: string) {
  sessionId = id;
  lastActivity = Date.now();
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, lastActivity: lastActivity }));
}

async function sendPayload(body: Record<string, unknown>) {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = localStorage.getItem("focusarx-auth-token");
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch("/api/track", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      keepalive: true,
    });
    if (res.ok) {
      const json = await res.json() as { sessionId?: string };
      if (json.sessionId) saveSession(json.sessionId);
    }
  } catch {
    /* analytics must never break the app */
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_MS);
}

async function flush(page?: string) {
  const visitorId = getOrCreateVisitorId();
  const events = pendingEvents.splice(0, MAX_BATCH);
  const body: Record<string, unknown> = {
    visitorId,
    sessionId: sessionId ?? loadSession() ?? undefined,
    ...(linkedUserId ? { userId: linkedUserId } : {}),
    ...(page ? { page } : {}),
    ...(events.length ? { events } : {}),
  };
  if (!page && !events.length) return;
  await sendPayload(body);
}

/** Link anonymous visitor to authenticated user after login/signup. */
export function linkAnalyticsUser(userId: string) {
  linkedUserId = userId;
}

/** Track a product event (batched). */
export function trackSiteEvent(eventType: AnalyticsEventType, eventData?: Record<string, unknown>) {
  pendingEvents.push({
    eventId: `ev_${crypto.randomUUID()}`,
    eventType,
    eventData,
  });
  if (pendingEvents.length >= MAX_BATCH) void flush();
  else scheduleFlush();
}

/** Track page view with 30s dedupe per page. */
export function trackPageView(path: string) {
  const now = Date.now();
  try {
    const last = JSON.parse(localStorage.getItem(LAST_PAGE_KEY) ?? "{}") as { path?: string; at?: number };
    if (last.path === path && last.at && now - last.at < PAGE_DEDUPE_MS) return;
    localStorage.setItem(LAST_PAGE_KEY, JSON.stringify({ path, at: now }));
  } catch { /* ignore */ }

  const idle = now - lastActivity;
  if (!sessionId) sessionId = loadSession();
  if (sessionId && idle > SESSION_IDLE_MS) sessionId = null;

  void sendPayload({
    visitorId: getOrCreateVisitorId(),
    sessionId: sessionId ?? undefined,
    page: path,
    ...(linkedUserId ? { userId: linkedUserId } : {}),
  });
}

/** Initialize analytics after first paint — call once at app startup. */
export function initSiteAnalytics() {
  getOrCreateVisitorId();
  sessionId = loadSession();

  const onHide = () => {
    if (pendingEvents.length) {
      const visitorId = getOrCreateVisitorId();
      const blob = new Blob([JSON.stringify({
        visitorId,
        sessionId: sessionId ?? undefined,
        events: pendingEvents.splice(0, MAX_BATCH),
      })], { type: "application/json" });
      navigator.sendBeacon?.("/api/track", blob);
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onHide();
  });
}
