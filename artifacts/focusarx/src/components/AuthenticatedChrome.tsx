import { useEffect, useState, type ReactNode } from "react";
import AppShell from "@/components/AppShell";
import AppDialogs from "@/components/AppDialogs";
import DailyRewardBanner from "@/components/DailyRewardBanner";
import { DeploymentUpdateBanner } from "@/components/DeploymentUpdateBanner";
import FloatingTimer from "@/components/FloatingTimer";
import { InAppBrowserPill } from "@/components/InAppBrowserPill";
import LiveAnnouncer from "@/components/LiveAnnouncer";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import { DropBanner } from "@/components/DropBanner";
import PageBackground from "@/components/PageBackground";
import SeasonalBanner from "@/components/SeasonalBanner";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { getToken, useAuth } from "@/lib/auth";

/**
 * Authenticated-only application chrome.
 *
 * This boundary is intentionally a lazy import from App.tsx. Navigation,
 * dashboards, socket.io, focus effects, and their animation dependencies are
 * valuable after sign-in, but should not inflate a public landing-page visit.
 */
function SocketInitializer() {
  const { data: session, status } = useAuth();

  useEffect(() => {
    if (status !== "authenticated") return;
    // The cookie-backed socket ticket is requested only for a verified member.
    void connectSocket(getToken() ?? undefined);
    return () => disconnectSocket();
  }, [status, session?.user?.id]);

  return null;
}

export default function AuthenticatedChrome({ children }: { children: ReactNode }) {
  const [isFocusing, setIsFocusing] = useState(false);

  useEffect(() => {
    const start = () => setIsFocusing(true);
    const stop = () => setIsFocusing(false);
    window.addEventListener("fx:focus-start", start);
    window.addEventListener("fx:focus-stop", stop);
    return () => {
      window.removeEventListener("fx:focus-start", start);
      window.removeEventListener("fx:focus-stop", stop);
    };
  }, []);

  return (
    <>
      <SocketInitializer />
      <PageBackground isFocusing={isFocusing} />
      <DeploymentUpdateBanner />
      <div className="px-3 pt-2 sm:px-5"><SeasonalBanner /></div>
      <DailyRewardBanner />
      {/* Drops are public hype *and* authenticated rewards. The public copy is
          deferred in App.tsx; this is the signed-in one, mounted app-wide so an
          admin-created drop is visible on every route rather than only on Focus
          and Community. It sat at the app root before the chrome was split out
          of App.tsx, and the merge is where it would have quietly vanished. */}
      <div className="px-3 pt-2 sm:px-5"><DropBanner /></div>
      <FloatingTimer />
      <LiveAnnouncer />
      <InAppBrowserPill />
      <AppDialogs>
        <MaintenanceGate>
          <AppShell>{children}</AppShell>
        </MaintenanceGate>
      </AppDialogs>
    </>
  );
}
