
import { useEffect, useState } from "react";

export type NetworkStatus = "online" | "offline" | "slow";

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>(() => {
    if (typeof navigator === "undefined") return "online";
    return navigator.onLine ? "online" : "offline";
  });
  const [effectiveType, setEffectiveType] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setStatus("online");
    const handleOffline = () => setStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check connection effective type for slow detection
    const nav = navigator as Navigator & {
      connection?: { effectiveType?: string; addEventListener?: (t: string, l: () => void) => void; removeEventListener?: (t: string, l: () => void) => void };
      mozConnection?: { effectiveType?: string; addEventListener?: (t: string, l: () => void) => void; removeEventListener?: (t: string, l: () => void) => void };
      webkitConnection?: { effectiveType?: string; addEventListener?: (t: string, l: () => void) => void; removeEventListener?: (t: string, l: () => void) => void };
    };
    const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
    if (conn) {
      const updateEffective = () => {
        setEffectiveType(conn.effectiveType || null);
        // 2g or slow-2g considered slow
        if (conn.effectiveType === "2g" || conn.effectiveType === "slow-2g") {
          setStatus("slow");
        }
      };
      updateEffective();
      conn.addEventListener?.("change", updateEffective);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        conn.removeEventListener?.("change", updateEffective);
      };
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { status, effectiveType, isOnline: status !== "offline", isOffline: status === "offline", isSlow: status === "slow" };
}
