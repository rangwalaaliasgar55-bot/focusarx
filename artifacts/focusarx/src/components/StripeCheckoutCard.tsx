/**
 * Card checkout (Stripe, env-gated).
 *
 * Renders nothing until the owner configures Stripe server-side
 * (`/premium/stripe/config`). When live, Monthly/Yearly buttons create a
 * Checkout Session and hand off to Stripe. Token unlocks below are
 * unchanged — cards are an alternative, never a replacement.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { apiJson } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function StripeCheckoutCard() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<"month" | "year" | null>(null);

  const config = useQuery({
    queryKey: ["stripe-config"],
    queryFn: () => apiJson<{ configured: boolean }>("/api/premium/stripe/config"),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!config.data?.configured) return null;

  const checkout = async (interval: "month" | "year") => {
    setBusy(interval);
    try {
      const res = await apiJson<{ url: string }>("/api/premium/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ interval }),
      });
      if (res.url) window.location.href = res.url;
      else toast("Could not start checkout.", "error");
    } catch {
      toast("Could not start checkout.", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
          <CreditCard size={20} />
        </span>
        <div>
          <p className="text-sm font-bold">Pay by card</p>
          <p className="text-xs text-[var(--foreground-muted)]">Pro, billed monthly or yearly. Same perks as token unlocks.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["month", "year"] as const).map((interval) => (
          <button
            key={interval}
            type="button"
            disabled={busy !== null}
            onClick={() => void checkout(interval)}
            className="min-h-[44px] rounded-full bg-[var(--surface-hover)] px-5 text-xs font-bold text-[var(--foreground)] ring-1 ring-[var(--border-subtle)] transition-colors hover:ring-[var(--brand-500)] disabled:opacity-60"
          >
            {busy === interval ? "Starting…" : interval === "month" ? "Pro Monthly" : "Pro Yearly (save 2 months)"}
          </button>
        ))}
      </div>
    </div>
  );
}
