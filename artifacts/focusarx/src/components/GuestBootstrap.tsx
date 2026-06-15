import { useEffect, useRef } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import { useAuth, setToken } from "@/lib/auth";
import { useLocation } from "wouter";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const NO_GUEST_PATHS = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback", "/onboarding", "/admin"];

export function GuestBootstrap() {
  const { status, refresh } = useAuth();
  const [location] = useLocation();
  const ran = useRef(false);

  useEffect(() => {
    if (NO_GUEST_PATHS.some((p) => location.startsWith(p))) return;
    if (ran.current) return;
    if (status !== "unauthenticated") return;
    ran.current = true;

    const run = async () => {
      let key = localStorage.getItem(STORAGE_KEYS.guestKey);
      if (!key) {
        key = crypto.randomUUID();
        localStorage.setItem(STORAGE_KEYS.guestKey, key);
      }

      const waits = [0, 400, 1200, 2500];
      for (let i = 0; i < waits.length; i++) {
        if (waits[i]! > 0) await sleep(waits[i]!);
        try {
          const res = await fetch("/api/auth/guest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ guestKey: key }),
          });
          if (res.ok) {
            const data = await res.json() as { token?: string };
            if (data.token) {
              setToken(data.token);
              await refresh();
              break;
            }
          }
        } catch {
          /* retry */
        }
      }
    };

    void run();
  }, [status, refresh, location]);

  return null;
}
