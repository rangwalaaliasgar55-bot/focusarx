import { useState } from "react";
import { useAuth, getToken } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Gift, Copy, Check, Users, Coins, Zap, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

async function fetchMyCode() {
  const token = getToken();
  const res = await fetch("/api/referral/my-code", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<{ code: string; shareUrl: string; name: string }>;
}

async function applyCode(code: string) {
  const token = getToken();
  const res = await fetch("/api/referral/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed");
  return data;
}

export default function ReferralPage() {
  const { status } = useAuth();
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [applyResult, setApplyResult] = useState<{ coins: number; xp: number } | null>(null);
  const [applyError, setApplyError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["referral-code"],
    queryFn: fetchMyCode,
    enabled: status === "authenticated",
  });

  const applyMut = useMutation({
    mutationFn: applyCode,
    onSuccess: (d) => { setApplyResult(d); setInputCode(""); setApplyError(""); },
    onError: (e: any) => { setApplyError(e.message || "Failed to apply code"); },
  });

  const copyCode = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyUrl = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (status === "unauthenticated") {
    return (
      <div className="relative min-h-[100dvh] forge-bg-glow flex items-center justify-center">
        <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-8 text-center max-w-sm">
          <Gift size={32} className="text-[#A78BFA] mx-auto mb-4" />
          <p className="text-[var(--foreground)] font-semibold mb-2">Sign in to refer friends</p>
          <Link href="/login" className="mt-4 inline-block rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-6 py-2 text-sm font-medium text-white">Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <main className="relative z-10 mx-auto max-w-xl px-4 py-10">
        <PageTransition>
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#4B5563]">Grow together</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
              <Gift size={22} className="text-[#A78BFA]" /> Refer Friends
            </h1>
          </header>

          {/* Reward cards */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4 text-center backdrop-blur-xl">
              <Coins size={22} className="text-[#FFB800] mx-auto mb-2" />
              <p className="text-xl font-bold text-[#FFB800]">+200</p>
              <p className="text-xs text-[#6B7280]">Coins for joinee</p>
            </div>
            <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4 text-center backdrop-blur-xl">
              <Zap size={22} className="text-[#A78BFA] mx-auto mb-2" />
              <p className="text-xl font-bold text-[#A78BFA]">+500</p>
              <p className="text-xs text-[#6B7280]">XP for joinee</p>
            </div>
          </div>

          {/* Your referral code */}
          <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl mb-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#4B5563] mb-3">Your Referral Code</p>
            {isLoading ? (
              <div className="h-12 animate-pulse rounded-xl bg-[rgba(124,58,237,0.08)]" />
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 rounded-xl bg-[rgba(124,58,237,0.1)] border border-[rgba(124,58,237,0.3)] px-4 py-3 font-mono text-lg font-bold text-[#A78BFA] tracking-widest text-center">
                    {data?.code ?? "—"}
                  </div>
                  <button onClick={copyCode} className="rounded-xl bg-[rgba(124,58,237,0.15)] border border-[rgba(124,58,237,0.3)] p-3 text-[#A78BFA] hover:bg-[rgba(124,58,237,0.25)] transition-colors">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <button onClick={copyUrl} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(124,58,237,0.2)] py-2.5 text-sm text-[#94A3B8] hover:text-[#A78BFA] hover:border-[rgba(124,58,237,0.4)] transition-colors">
                  <ExternalLink size={13} /> Copy invite link
                </button>
              </>
            )}
          </div>

          {/* Apply a code */}
          <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl mb-6">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#4B5563] mb-3">Enter a Friend's Code</p>
            {applyResult ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl bg-[rgba(6,214,160,0.1)] border border-[rgba(6,214,160,0.3)] p-4 text-center">
                <p className="text-[#06D6A0] font-semibold mb-1">🎉 Bonus applied!</p>
                <p className="text-sm text-[#94A3B8]">+{applyResult.coins} coins • +{applyResult.xp} XP added to your account</p>
              </motion.div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="FAX-XXXXXX"
                    maxLength={10}
                    className="flex-1 rounded-xl border border-[rgba(124,58,237,0.2)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-sm font-mono text-[var(--foreground)] placeholder-[#4B5563] outline-none focus:border-[rgba(124,58,237,0.5)]"
                  />
                  <button
                    onClick={() => applyMut.mutate(inputCode)}
                    disabled={!inputCode.startsWith("FAX-") || applyMut.isPending}
                    className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40 hover:opacity-90">
                    {applyMut.isPending ? "…" : "Apply"}
                  </button>
                </div>
                {applyError && <p className="mt-2 text-xs text-red-400">{applyError}</p>}
              </>
            )}
          </div>

          {/* How it works */}
          <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4B5563] mb-4">How it works</p>
            <div className="space-y-3">
              {[
                { icon: "1️⃣", text: "Share your referral code or invite link with a friend" },
                { icon: "2️⃣", text: "They sign up for FocusArx and enter your code" },
                { icon: "3️⃣", text: "They receive 200 coins + 500 XP as a welcome bonus" },
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-base leading-none mt-0.5">{step.icon}</span>
                  <p className="text-sm text-[#94A3B8]">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
