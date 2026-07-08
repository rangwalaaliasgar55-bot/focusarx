import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { Trash2, ArrowLeft, CheckCircle } from "lucide-react";
import { useState } from "react";
import { getToken } from "@/lib/auth";

export default function DataDeletionPage() {
  const [step, setStep] = useState<"idle" | "confirm" | "done" | "error">("idle");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch("/api/auth/session", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { setStep("error"); setLoading(false); return; }
      setStep("done");
    } catch {
      setStep("error");
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-[100dvh] forge-bg-glow">
      <main id="main-content" className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        <PageTransition>
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs text-[#4B5563] hover:text-[#A78BFA] transition-colors">
            <ArrowLeft size={13} /> Back to FocusArx
          </Link>

          <header className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(239,68,68,0.12)]">
                <Trash2 size={20} className="text-[#F87171]" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4B5563]">Legal</p>
                <h1 className="text-2xl font-bold text-[#E2E8F0]">Data Deletion Request</h1>
              </div>
            </div>
            <p className="text-xs text-[#4B5563]">Your right to be forgotten, explained clearly.</p>
          </header>

          <div className="space-y-6">
            <div className="rounded-2xl border border-[rgba(124,58,237,0.1)] bg-[rgba(16,23,50,0.4)] p-6">
              <h2 className="mb-3 text-base font-semibold text-[#E2E8F0]">What data we hold</h2>
              <div className="space-y-2 text-sm text-[#94A3B8]">
                <p>Your FocusArx account includes:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Account details (name, email, hashed password)</li>
                  <li>Focus session history and durations</li>
                  <li>Tasks, goals, and notes</li>
                  <li>XP, coins, badges, and leaderboard rankings</li>
                  <li>Daily readiness check-ins and distraction logs</li>
                  <li>AI roadmaps you've saved</li>
                  <li>Study streaks and gamification data</li>
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-[rgba(124,58,237,0.1)] bg-[rgba(16,23,50,0.4)] p-6">
              <h2 className="mb-3 text-base font-semibold text-[#E2E8F0]">How to delete your data</h2>
              <div className="space-y-4 text-sm text-[#94A3B8]">
                <p>You have two options:</p>

                <div className="rounded-xl border border-[rgba(124,58,237,0.15)] bg-[rgba(124,58,237,0.05)] p-4">
                  <p className="mb-1 font-medium text-[#E2E8F0]">Option 1 — Email request (recommended)</p>
                  <p>Send an email to <span className="text-[#A78BFA]">privacy@focusarx.app</span> with the subject line "Data Deletion Request" and your registered email address. We will process your request within 30 days and send a confirmation.</p>
                </div>

                <div className="rounded-xl border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.04)] p-4">
                  <p className="mb-2 font-medium text-[#E2E8F0]">Option 2 — Self-service deletion</p>
                  <p className="mb-4">If you are signed in, you can initiate immediate deletion below. <strong className="text-[#F87171]">This action is irreversible.</strong> All your data will be permanently removed.</p>

                  {step === "idle" && (
                    <button
                      onClick={() => setStep("confirm")}
                      className="rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.1)] px-5 py-2.5 text-sm font-semibold text-[#F87171] transition-all hover:bg-[rgba(239,68,68,0.2)]"
                    >
                      Request account deletion
                    </button>
                  )}

                  {step === "confirm" && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-[#F87171]">⚠️ Are you absolutely sure? This cannot be undone.</p>
                      <div className="flex gap-3">
                        <button
                          onClick={handleDelete}
                          disabled={loading}
                          className="rounded-xl bg-[#EF4444] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#DC2626] disabled:opacity-50"
                        >
                          {loading ? "Processing…" : "Yes, delete everything"}
                        </button>
                        <button
                          onClick={() => setStep("idle")}
                          className="rounded-xl border border-[rgba(124,58,237,0.2)] px-5 py-2.5 text-sm text-[#94A3B8] transition-all hover:text-[#E2E8F0]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {step === "done" && (
                    <div className="flex items-center gap-3 rounded-xl border border-[rgba(74,222,128,0.2)] bg-[rgba(74,222,128,0.08)] p-4">
                      <CheckCircle size={18} className="text-[#4ADE80]" />
                      <div>
                        <p className="text-sm font-semibold text-[#4ADE80]">Deletion request received</p>
                        <p className="text-xs text-[#94A3B8]">We'll process and confirm by email within 30 days.</p>
                      </div>
                    </div>
                  )}

                  {step === "error" && (
                    <p className="text-sm text-[#F87171]">Something went wrong. Please email us directly at privacy@focusarx.app</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[rgba(124,58,237,0.1)] bg-[rgba(16,23,50,0.4)] p-6">
              <h2 className="mb-3 text-base font-semibold text-[#E2E8F0]">After deletion</h2>
              <div className="space-y-2 text-sm text-[#94A3B8]">
                <p>Once processed, all personal data associated with your account is permanently deleted from our databases. Anonymised, aggregated data (e.g. "X total focus hours were logged on this day across all users") may be retained for product analytics, as it cannot be linked back to you.</p>
                <p>Backups are purged on a rolling 30-day cycle.</p>
              </div>
            </div>
          </div>

          <LegalFooter />
        </PageTransition>
      </main>
    </div>
  );
}

function LegalFooter() {
  const links = [
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/cookie-policy", label: "Cookies" },
    { href: "/acceptable-use", label: "Acceptable Use" },
    { href: "/ai-policy", label: "AI Policy" },
    { href: "/data-deletion", label: "Data Deletion" },
  ];
  return (
    <div className="mt-10 flex flex-wrap gap-3 border-t border-[rgba(124,58,237,0.1)] pt-6">
      {links.map(({ href, label }) => (
        <Link key={href} href={href} className="text-xs text-[#4B5563] hover:text-[#A78BFA] transition-colors">
          {label}
        </Link>
      ))}
    </div>
  );
}
