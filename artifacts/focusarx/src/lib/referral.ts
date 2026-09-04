/**
 * Referral capture → auto-apply (Phase 9.12 funnel fix).
 *
 * Share links carry `?ref=FAX-XXXXXXXX`, but nothing consumed it — referred
 * friends only got rewards by manually pasting the code. Now the code is
 * captured on arrival and auto-applied once, on the first authenticated
 * session. Idempotent server-side (409 when already applied).
 */

import { safeGet, safeRemove, safeSet } from "./safeStorage";
import { getToken } from "./auth";

const REF_KEY = "focusarx-ref-code";
const APPLIED_KEY = "focusarx-ref-applied";
const REF_RE = /^FAX-[A-F0-9]{8}$/;

/** Capture `?ref=` from the current URL (once per tab boot). */
export function captureReferralFromUrl(search: string): string | null {
  try {
    if (safeGet(APPLIED_KEY) === "1") return null;
    const code = (new URLSearchParams(search || "").get("ref") || "").trim().toUpperCase();
    if (!REF_RE.test(code)) return null;
    safeSet(REF_KEY, code);
    return code;
  } catch {
    return null;
  }
}

/** Apply a captured code once. Never throws; safe to call on every login. */
export async function tryApplyPendingReferral(): Promise<"applied" | "none" | "deferred"> {
  try {
    const code = safeGet(REF_KEY);
    if (!code || safeGet(APPLIED_KEY) === "1") return "none";
    if (!REF_RE.test(code)) {
      safeRemove(REF_KEY);
      return "none";
    }
    const token = getToken();
    if (!token) return "deferred";
    const res = await fetch("/api/referral/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code }),
    });
    if (res.ok || res.status === 409) {
      safeSet(APPLIED_KEY, "1");
      safeRemove(REF_KEY);
      return "applied";
    }
    if (res.status === 400) {
      // Invalid/own code — stop retrying, keep the UX quiet.
      safeSet(APPLIED_KEY, "1");
      safeRemove(REF_KEY);
      return "none";
    }
    return "deferred";
  } catch {
    return "deferred";
  }
}
