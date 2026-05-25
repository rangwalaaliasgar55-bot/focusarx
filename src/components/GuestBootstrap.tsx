"use client";

import { signIn } from "next-auth/react";
import { useEffect, useRef } from "react";
import { STORAGE_KEYS } from "@/lib/constants";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function GuestBootstrap() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const run = async () => {
      let key = localStorage.getItem(STORAGE_KEYS.guestKey);
      if (!key) {
        key = crypto.randomUUID();
        localStorage.setItem(STORAGE_KEYS.guestKey, key);
      }

      const waits = [0, 400, 1200, 2500];
      for (let i = 0; i < waits.length; i++) {
        if (waits[i] > 0) await sleep(waits[i]);
        try {
          const result = await signIn("guest", {
            guestKey: key,
            redirect: false,
          });
          if (result?.ok) break;
        } catch {
          /* retry */
        }
      }
    };

    void run();
  }, []);

  return null;
}
