import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket";

/**
 * Screen-reader announcements (audit L5): an aria-live region that turns
 * gamification socket events into polite announcements so achievement
 * unlocks, streak milestones and level-ups are not visual-only.
 */
export default function LiveAnnouncer() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const announce = (message: string) => {
      const el = ref.current;
      if (!el) return;
      // Reassigning the text content re-triggers screen readers.
      el.textContent = "";
      window.setTimeout(() => { el.textContent = message; }, 50);
    };

    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) announce(detail);
    };
    window.addEventListener("focusarx:announce", onEvent);

    const sock = getSocket();
    const cleanups: Array<() => void> = [];
    if (sock) {
      const bind = (event: string, format: (data: any) => string) => {
        const handler = (data: any) => announce(format(data));
        sock.on(event, handler);
        cleanups.push(() => { sock.off(event, handler); });
      };
      bind("achievement:unlock", (d) => `Achievement unlocked: ${d?.badge?.name ?? "new badge"}.`);
      bind("streak:milestone", (d) => `Streak milestone reached: ${d?.days ?? "?"} days.`);
      bind("user:levelup", (d) => `Level up! You reached level ${d?.newLevel ?? d?.level ?? ""}.`);
    }

    return () => {
      window.removeEventListener("focusarx:announce", onEvent);
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className="sr-only"
    />
  );
}
