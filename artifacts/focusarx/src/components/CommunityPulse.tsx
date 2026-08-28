import { useEffect, useState } from "react";
import { Users } from "lucide-react";

/**
 * Honest community pulse (A4). The only public counter that mixes humans and
 * community pulse — no fabricated totals. "50,000+ learners" style fabrications
 * are gone by design (honesty guardrail #8).
 */
export interface CommunityPulse {
  membersLabel: string;
  membersTotal: number;
  aiRivals: number;
  realMembers: number;
  realStudiersThisWeek: number;
  studiersLabel: string;
}

export function useCommunityPulse(): CommunityPulse | null {
  const [pulse, setPulse] = useState<CommunityPulse | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/site/community-pulse", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CommunityPulse | null) => { if (live && d) setPulse(d); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);
  return pulse;
}

export default function CommunityPulse({ className = "" }: { className?: string }) {
  const pulse = useCommunityPulse();
  if (!pulse) return null;
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-[var(--foreground-subtle)] ${className}`}
      aria-label="Community size"
    >
      <span className="inline-flex items-center gap-1.5">
        <Users size={13} className="text-[var(--brand-strong)]" />
        {pulse.membersLabel}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Users size={13} className="text-[var(--brand-strong)]" />
        {pulse.realStudiersThisWeek.toLocaleString("en-US")} active this week
      </span>
    </div>
  );
}
