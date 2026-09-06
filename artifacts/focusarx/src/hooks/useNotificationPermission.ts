
import { useCallback, useState } from "react";

type PermissionState = NotificationPermission | "unsupported" | "prompt";

export function useNotificationPermission() {
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof window === "undefined") return "unsupported";
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission as PermissionState;
  });

  const [showSoftPrompt, setShowSoftPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("focusarx-notif-soft-dismissed") === "1";
  });


  // Decide if we should show soft prompt: user has completed at least 1 focus session and hasn't granted/denied
  const maybeShowSoftPrompt = useCallback(() => {
    if (permission !== "default") return;
    if (dismissed) return;
    if (!("Notification" in window)) return;
    // Check if user has completed sessions (from localStorage heuristic)
    const completed = localStorage.getItem("focusarx-sessions-completed");
    if (completed && parseInt(completed, 10) >= 1) {
      setShowSoftPrompt(true);
    }
  }, [permission, dismissed]);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return "unsupported" as PermissionState;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      setShowSoftPrompt(false);
      return result as PermissionState;
    } catch {
      return permission;
    }
  }, [permission]);

  const dismissSoftPrompt = useCallback(() => {
    setShowSoftPrompt(false);
    setDismissed(true);
    localStorage.setItem("focusarx-notif-soft-dismissed", "1");
  }, []);

  const trackSessionCompleted = useCallback(() => {
    const key = "focusarx-sessions-completed";
    const current = parseInt(localStorage.getItem(key) || "0", 10);
    localStorage.setItem(key, String(current + 1));
    // After 1st completion, show soft prompt next time
    if (current + 1 >= 1 && permission === "default" && !dismissed) {
      // Delay showing to not interrupt celebration
      setTimeout(() => setShowSoftPrompt(true), 2000);
    }
  }, [permission, dismissed]);

  return {
    permission,
    isSupported: permission !== "unsupported",
    isGranted: permission === "granted",
    isDenied: permission === "denied",
    isDefault: permission === "default",
    showSoftPrompt,
    dismissed,
    requestPermission,
    dismissSoftPrompt,
    maybeShowSoftPrompt,
    trackSessionCompleted,
  };
}
