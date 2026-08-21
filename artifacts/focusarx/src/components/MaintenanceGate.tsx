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

  if (!settings.maintenanceMode) return <>{children}</>;

  const isAdmin = status === "authenticated" && isAdminUser(session?.user);

  if (isAdmin) return <>{children}</>;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#030308] px-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#7C3AED] to-[#F472B6] shadow-[0_0_60px_rgba(124,58,237,0.4)]">
        <Rocket size={36} className="text-white" />
      </div>
      <h1 className="text-3xl font-black text-white sm:text-5xl">We're upgrading the ship</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-[#94A3B8]">
        {settings.maintenanceMessage}
      </p>
      <div className="mt-8 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-[#94A3B8]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        Maintenance in progress
      </div>
    </div>
  );
}
