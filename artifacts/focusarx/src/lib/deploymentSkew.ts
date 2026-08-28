/**
 * Frontend deployment skew detection.
 *
 * This module detects when the loaded frontend assets belong to a different
 * deployment than the API server responding to requests. When a mismatch is
 * found, it:
 *
 * 1. Shows a non-destructive "update available" notification.
 * 2. Preserves unsaved form data in sessionStorage before refreshing.
 * 3. Performs a single safe refresh (with loop protection).
 * 4. Never automatically retries non-idempotent mutations.
 *
 * The detection is triggered from two sources:
 * - Response headers: every API response carries X-FocusArx-Deployment.
 * - 409 DEPLOYMENT_SKEW errors: the backend blocks mutations during skew.
 * - Periodic polling: /api/deployment is checked every 5 minutes + on focus.
 */

import { useEffect, useCallback, useState, useRef } from "react";

/** The deployment version this frontend was built with. */
export const FRONTEND_DEPLOYMENT_VERSION: string =
  (typeof __DEPLOYMENT_VERSION__ !== "undefined" ? __DEPLOYMENT_VERSION__ : null) ??
  import.meta.env.VITE_DEPLOYMENT_VERSION ??
  "dev-local";

// Global state — shared across all components using the hook.
let serverVersion: string | null = null;
let mismatchDetected = false;
let refreshAttempted = false;
let dismissed = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/**
 * Record the server version from a response header or API body.
 * If it differs from the frontend version, trigger mismatch handling.
 */
export function recordServerVersion(version: string | null | undefined): void {
  if (!version) return;
  if (serverVersion === version) return;
  serverVersion = version;

  if (version !== FRONTEND_DEPLOYMENT_VERSION && !mismatchDetected) {
    mismatchDetected = true;
    notify();

    console.warn(
      `[deploy-skew] Version mismatch detected: frontend=${FRONTEND_DEPLOYMENT_VERSION}, server=${version}. ` +
      `A new version of FocusArx has been deployed.`
    );
  }
}

/**
 * Check if a deployment mismatch has been detected.
 */
export function hasMismatch(): boolean {
  return mismatchDetected;
}

/**
 * Whether the user has dismissed the update notification.
 */
export function isDismissed(): boolean {
  return dismissed;
}

/**
 * Dismiss the update notification for this session.
 */
export function dismissMismatch(): void {
  dismissed = true;
  notify();
}

/**
 * Get the server version (if known).
 */
export function getServerVersion(): string | null {
  return serverVersion;
}

/**
 * Save critical form data to sessionStorage before a refresh.
 * This preserves unsaved work across the reload.
 */
function saveFormState(): void {
  try {
    const forms: Record<string, Record<string, string>> = {};
    document.querySelectorAll("form[data-preserve], [data-preserve-form]").forEach((form) => {
      const id = (form as HTMLElement).dataset.preserveForm || (form as HTMLFormElement).id || "form";
      const data: Record<string, string> = {};
      form.querySelectorAll("input, textarea, select").forEach((el) => {
        const input = el as HTMLInputElement;
        if (input.name && input.value) {
          data[input.name] = input.value;
        }
      });
      if (Object.keys(data).length > 0) {
        forms[id] = data;
      }
    });
    if (Object.keys(forms).length > 0) {
      sessionStorage.setItem("focusarx:preserved-forms", JSON.stringify(forms));
    }
  } catch {
    // sessionStorage may be unavailable — non-fatal
  }
}

/**
 * Restore preserved form data after a refresh.
 */
export function restoreFormState(): void {
  try {
    const raw = sessionStorage.getItem("focusarx:preserved-forms");
    if (!raw) return;
    sessionStorage.removeItem("focusarx:preserved-forms");
    const forms = JSON.parse(raw) as Record<string, Record<string, string>>;

    // Wait for React to mount and forms to render
    setTimeout(() => {
      Object.entries(forms).forEach(([id, data]) => {
        const form = document.querySelector(
          `[data-preserve-form="${id}"], form#${id}[data-preserve]`
        );
        if (!form) return;
        Object.entries(data).forEach(([name, value]) => {
          const input = form.querySelector(`[name="${name}"]`) as HTMLInputElement | null;
          if (input) {
            // Trigger React-compatible value setter
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype, "value"
            )?.set;
            if (nativeInputValueSetter) {
              nativeInputValueSetter.call(input, value);
              input.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }
        });
      });
    }, 500);
  } catch {
    // Non-fatal
  }
}

/**
 * Perform a safe refresh to pick up the new deployment.
 * Only refreshes once — subsequent calls are no-ops to prevent loops.
 */
export function safeRefresh(): void {
  if (refreshAttempted) {
    console.warn("[deploy-skew] Refresh already attempted — ignoring to prevent loops.");
    return;
  }
  refreshAttempted = true;

  // Save form data before refreshing
  saveFormState();

  // Clear the service worker cache to ensure fresh assets
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "CLEAR_CACHE" });
  }

  // Perform a hard reload (bypasses browser cache)
  // window.location.reload() with the cache-busting parameter
  const url = new URL(window.location.href);
  url.searchParams.set("_v", Date.now().toString());
  window.location.replace(url.toString());
}

/**
 * Reset the refresh guard (for testing purposes).
 */
export function resetRefreshGuard(): void {
  refreshAttempted = false;
}

/**
 * React hook that subscribes to deployment skew events.
 * Returns the current mismatch state and a dismiss function.
 */
export function useDeploymentSkew() {
  const [state, setState] = useState({
    mismatch: mismatchDetected && !dismissed,
    serverVersion,
    frontendVersion: FRONTEND_DEPLOYMENT_VERSION,
  });

  useEffect(() => {
    const handler = () => {
      setState({
        mismatch: mismatchDetected && !dismissed,
        serverVersion,
        frontendVersion: FRONTEND_DEPLOYMENT_VERSION,
      });
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const dismiss = useCallback(() => {
    dismissMismatch();
  }, []);

  const refresh = useCallback(() => {
    safeRefresh();
  }, []);

  return { ...state, dismiss, refresh };
}

/**
 * Hook that polls the deployment endpoint and checks response headers
 * to detect version skew. Mount once in the app root.
 */
export function useDeploymentSkewDetector() {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);

  const checkDeployment = useCallback(async () => {
    if (!mounted.current) return;
    try {
      const res = await fetch("/api/deployment", {
        method: "GET",
        credentials: "omit",
        headers: { "X-FocusArx-Deployment": FRONTEND_DEPLOYMENT_VERSION },
      });
      if (res.ok) {
        const data = await res.json();
        recordServerVersion(data.version);
      }
      // Also check response header
      const headerVersion = res.headers.get("X-FocusArx-Deployment");
      if (headerVersion) {
        recordServerVersion(headerVersion);
      }
    } catch {
      // Network error — skip, will retry on next poll
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    // Initial check after 5 seconds (don't block initial load)
    const initialTimer = setTimeout(checkDeployment, 5000);

    // Poll every 5 minutes
    pollRef.current = setInterval(checkDeployment, 5 * 60 * 1000);

    // Check on window focus (user may return after a deployment)
    const focusHandler = () => checkDeployment();
    window.addEventListener("focus", focusHandler);

    // Listen for 409 DEPLOYMENT_SKEW errors from the global API error handler
    const skewHandler = (event: CustomEvent) => {
      const detail = event.detail as { status?: number; code?: string; serverVersion?: string };
      if (detail?.code === "DEPLOYMENT_SKEW" || detail?.status === 409) {
        if (detail.serverVersion) {
          recordServerVersion(detail.serverVersion);
        } else {
          mismatchDetected = true;
          notify();
        }
      }
    };
    window.addEventListener("focusarx:deployment-skew", skewHandler as EventListener);

    // Restore preserved form data on mount (after a skew-triggered refresh)
    restoreFormState();

    return () => {
      mounted.current = false;
      clearTimeout(initialTimer);
      if (pollRef.current) clearInterval(pollRef.current);
      window.removeEventListener("focus", focusHandler);
      window.removeEventListener("focusarx:deployment-skew", skewHandler as EventListener);
    };
  }, [checkDeployment]);
}

// Type declaration for __DEPLOYMENT_VERSION__ injected at build time.
declare const __DEPLOYMENT_VERSION__: string | undefined;
