import { useSiteSettings } from "@/lib/site-settings";
import { useAuth } from "@/lib/auth";
import { isAdminUser } from "@/lib/auth";
import { Rocket } from "lucide-react";

/**
 * Shows a full-screen maintenance page when an admin has enabled maintenance
 * mode. Admins bypass it so they can still reach the admin panel to turn it
 * off. Public visitors + regular users see the maintenance message.
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const settings = useSiteSettings();
  const { data: session, status } = useAuth();
  const path = typeof window === "undefined" ? "/" : window.location.pathname;

  let rememberedAdmin: boolean;
  try {
    rememberedAdmin = window.localStorage.getItem("focusarx:admin-seen") === "1";
  } catch {
    rememberedAdmin = false;
  }

  // While auth is still resolving, wait — do not tell a signed-in admin that the
  // site is down for them, and never flash the maintenance screen on the way in.
  if (status === "loading" && settings.maintenanceMode) {
    if (rememberedAdmin) return <>{children}</>;
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--background)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--brand-600)]" />
      </div>
    );
  }

  if (!settings.maintenanceMode) return <>{children}</>;

  const admin = status === "authenticated" && isAdminUser(session?.user);
  if (admin) {
    // Remember the role locally. Maintenance mode is usually on *because*
    // something is broken; if the thing that broke is the auth check, a live
    // session cannot be obtained and the owner would be locked out of the only
    // screen that can switch maintenance off.
    try {
      window.localStorage.setItem("focusarx:admin-seen", "1");
    } catch {
      /* private mode: this visit still worked via the live check */
    }
  }

  // The control room is never gated, whatever the session says.
  if (admin || rememberedAdmin || path.startsWith("/admin") || path.startsWith("/login")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--background)] px-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--brand-600)]">
        <Rocket size={36} className="text-[var(--palette-white)]" />
      </div>
      <h1 className="text-3xl font-semibold text-[var(--palette-white)] sm:text-5xl">We\'re upgrading the ship</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--foreground-muted)]">
        {settings.maintenanceMessage}
      </p>
      <div className="mt-8 flex items-center gap-2 rounded-full border border-[var(--palette-white)]/10 bg-[var(--palette-white)]/5 px-4 py-2 text-xs text-[var(--foreground-muted)]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--palette-emerald-400)]" />
        Maintenance in progress
      </div>
      <a href="/login" className="mt-6 text-xs text-[var(--brand-400)] underline-offset-4 transition-colors hover:underline">
        Team member? Sign in
      </a>
    </div>
  );
}
