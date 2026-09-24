import { useEffect, useState } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { OPEN_VOICE_CAPTURE_EVENT } from "@/lib/voiceCapture";

/**
 * Mounts the voice capture dialog — but only once someone asks for it.
 *
 * The feature was fully written (`components/VoiceCapture.tsx`, the parser in
 * `api-server/src/lib/voiceCapture.ts`, the route) and completely unreachable:
 * the manager was never rendered anywhere, so the "open voice capture" event it
 * listens for had no listener, and the API it calls was never mounted. From the
 * outside that is not "unfinished", it is "missing" — which is exactly how it
 * was reported.
 *
 * Why not simply `<VoiceCaptureManager />` in the shell: it imports the dialog
 * primitives and loads a lazily-imported speech flow, i.e. weight the entry
 * chunk would pay for on every page load, and the entry chunk is budget-checked
 * at 55 kB gzip. So this wrapper listens for the event first and renders the
 * manager only after it has been requested.
 *
 * The subtlety (and the reason the naive version does nothing): the manager
 * subscribes to the event on mount, so an event that triggered the mount has
 * already been dispatched and missed. Effect order saves us — a child's effects
 * run before its parent's — so the parent re-dispatches the stored payload here,
 * after the manager is listening. `openVoiceCapture()` therefore works from
 * anywhere in the app, on the first press, on any page.
 */
const VoiceCaptureManager = lazyWithRetry(() => import("@/components/VoiceCapture").then((m) => ({ default: m.VoiceCaptureManager })));

export function VoiceCaptureMount() {
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState<CustomEvent<{ transcript?: string }> | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => {
      setArmed(true);
      setPending(event as CustomEvent<{ transcript?: string }>);
    };
    window.addEventListener(OPEN_VOICE_CAPTURE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_VOICE_CAPTURE_EVENT, onOpen);
  }, []);

  // Runs after the lazy manager's own effect, so the manager is subscribed by
  // the time this fires. `armed` only ever goes true, so this happens once.
  useEffect(() => {
    if (!armed || !pending) return;
    const replay = pending;
    setPending(null);
    window.dispatchEvent(replay);
  }, [armed, pending]);

  if (!armed) return null;
  return <VoiceCaptureManager />;
}
