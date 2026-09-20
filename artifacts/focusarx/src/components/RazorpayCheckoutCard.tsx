import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Smartphone } from "lucide-react";
import { apiJson } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { trackSiteEvent } from "@/lib/site-analytics";

type Interval = "month" | "year";
type RazorpayResult = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayOptions = {
  key: string; amount: number; currency: string; name: string; description: string; order_id: string;
  handler: (result: RazorpayResult) => void; modal: { ondismiss: () => void }; theme: { color: string };
};
declare global { interface Window { Razorpay?: new (options: RazorpayOptions) => { open(): void }; } }

let loader: Promise<boolean> | null = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  loader ??= new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.async = true;
    script.onload = () => resolve(true); script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return loader;
}

export default function RazorpayCheckoutCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<Interval | null>(null);
  const config = useQuery({
    queryKey: ["razorpay-config"], retry: false, staleTime: 5 * 60_000,
    queryFn: () => apiJson<{ configured: boolean; keyId: string | null; amounts: Record<Interval, number>; currency: string }>("/api/premium/razorpay/config"),
  });
  if (!config.data?.configured || !config.data.keyId) return null;

  const checkout = async (interval: Interval) => {
    setBusy(interval);
    trackSiteEvent("checkout_started", { provider: "razorpay", interval });
    try {
      const ready = await loadRazorpay();
      if (!ready || !window.Razorpay) throw new Error("checkout unavailable");
      const order = await apiJson<{ orderId: string; amount: number; currency: string; keyId: string }>("/api/premium/razorpay/order", {
        method: "POST", body: JSON.stringify({ interval }),
      });
      const payment = new window.Razorpay({
        key: order.keyId, amount: order.amount, currency: order.currency, name: "FocusArx Pro",
        description: interval === "year" ? "Annual membership" : "Monthly membership", order_id: order.orderId,
        theme: { color: "#7c3aed" }, modal: { ondismiss: () => setBusy(null) },
        handler: (result) => {
          void apiJson<{ verified: boolean; replayed: boolean }>("/api/premium/razorpay/verify", {
            method: "POST", body: JSON.stringify({ ...result, interval }),
          }).then(async () => {
            await Promise.all([qc.invalidateQueries({ queryKey: ["premium-status"] }), qc.invalidateQueries({ queryKey: ["premium-ledger"] })]);
            trackSiteEvent("checkout_completed", { provider: "razorpay", interval });
            toast("Payment verified. FocusArx Pro is active.", "success"); setBusy(null);
          }).catch(() => { toast("Payment succeeded, but activation needs review. Contact support with your payment ID.", "error"); setBusy(null); });
        },
      });
      payment.open();
    } catch { toast("Could not start UPI checkout. Try again or use Focus Credits.", "error"); setBusy(null); }
  };

  return <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
    <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-strong)]"><Smartphone size={20} /></span><div><p className="text-sm font-bold">Pay with UPI in India</p><p className="text-xs text-[var(--foreground-muted)]">₹199 monthly or ₹1,499 yearly through Razorpay.</p></div></div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" disabled={busy !== null} onClick={() => void checkout("month")} className="min-h-11 rounded-full bg-[var(--surface-hover)] px-5 text-xs font-bold ring-1 ring-[var(--border-subtle)] hover:ring-[var(--brand-500)] disabled:opacity-60">{busy === "month" ? "Starting…" : "₹199 monthly"}</button>
      <button type="button" disabled={busy !== null} onClick={() => void checkout("year")} className="min-h-11 rounded-full bg-[var(--brand-600)] px-5 text-xs font-bold text-white disabled:opacity-60">{busy === "year" ? "Starting…" : "₹1,499 yearly"}</button>
    </div>
  </div>;
}
