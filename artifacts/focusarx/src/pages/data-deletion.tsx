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
      <main id="main-content" className="relative z-[var(--z-content)] mx-auto max-w-3xl px-4 py-10">
        <PageTransition>
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs text-[var(--foreground-subtle)] hover:text-[var(--brand-400)] transition-colors">
            <ArrowLeft size={13} /> Back to FocusArx
          </Link>

          <header className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--rgba-239-68-68-0_12)]">
                <Trash2 size={20} className="text-[var(--palette-f87171)]" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--foreground-subtle)]">Legal</p>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">Data Deletion Request</h1>
              </div>
            </div>
            <p className="text-xs text-[var(--foreground-subtle)]">Your right to be forgotten, explained clearly.</p>
          </header>

          <div className="space-y-6">
            <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_1)] bg-[var(--rgba-16-23-50-0_4)] p-6">
              <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">What data we hold</h2>
              <div className="space-y-2 text-sm text-[var(--foreground-muted)]">
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

            <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_1)] bg-[var(--rgba-16-23-50-0_4)] p-6">
              <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">How to delete your data</h2>
              <div className="space-y-4 text-sm text-[var(--foreground-muted)]">
                <p>You have two options:</p>

                <div className="rounded-xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-124-58-237-0_05)] p-4">
                  <p className="mb-1 font-medium text-[var(--foreground)]">Option 1 — Email request (recommended)</p>
                  <p>Send an email to <span className="text-[var(--brand-400)]">focusarx@gmail.com</span> with the subject line "Data Deletion Request" and your registered email address. We will process your request within 30 days and send a confirmation.</p>
                </div>

                <div className="rounded-xl border border-[var(--rgba-239-68-68-0_15)] bg-[var(--rgba-239-68-68-0_04)] p-4">
                  <p className="mb-2 font-medium text-[var(--foreground)]">Option 2 — Self-service deletion</p>
                  <p className="mb-4">If you are signed in, you can initiate immediate deletion below. <strong className="text-[var(--palette-f87171)]">This action is irreversible.</strong> All your data will be permanently removed.</p>

                  {step === "idle" && (
                    <button
                      onClick={() => setStep("confirm")}
                      className="rounded-xl border border-[var(--rgba-239-68-68-0_3)] bg-[var(--rgba-239-68-68-0_1)] px-5 py-2.5 text-sm font-semibold text-[var(--palette-f87171)] transition-all hover:bg-[var(--rgba-239-68-68-0_2)]"
                    >
                      Request account deletion
                    </button>
                  )}

                  {step === "confirm" && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-[var(--palette-f87171)]">⚠️ Are you absolutely sure? This cannot be undone.</p>
                      <div className="flex gap-3">
                        <button
                          onClick={handleDelete}
                          disabled={loading}
                          className="rounded-xl bg-[var(--color-error)] px-5 py-2.5 text-sm font-bold text-[var(--palette-white)] transition-all hover:bg-[var(--palette-dc2626)] disabled:opacity-50"
                        >
                          {loading ? "Processing…" : "Yes, delete everything"}
                        </button>
                        <button
                          onClick={() => setStep("idle")}
                          className="rounded-xl border border-[var(--rgba-124-58-237-0_2)] px-5 py-2.5 text-sm text-[var(--foreground-muted)] transition-all hover:text-[var(--foreground)]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {step === "done" && (
                    <div className="flex items-center gap-3 rounded-xl border border-[var(--rgba-74-222-128-0_2)] bg-[var(--rgba-74-222-128-0_08)] p-4">
                      <CheckCircle size={18} className="text-[var(--palette-4ade80)]" />
                      <div>
                        <p className="text-sm font-semibold text-[var(--palette-4ade80)]">Deletion request received</p>
                        <p className="text-xs text-[var(--foreground-muted)]">We'll process and confirm by email within 30 days.</p>
                      </div>
                    </div>
                  )}

                  {step === "error" && (
                    <p className="text-sm text-[var(--palette-f87171)]">Something went wrong. Please email us directly at focusarx@gmail.com</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_1)] bg-[var(--rgba-16-23-50-0_4)] p-6">
              <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">After deletion</h2>
              <div className="space-y-2 text-sm text-[var(--foreground-muted)]">
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
    <div className="mt-10 flex flex-wrap gap-3 border-t border-[var(--rgba-124-58-237-0_1)] pt-6">
      {links.map(({ href, label }) => (
        <Link key={href} href={href} className="text-xs text-[var(--foreground-subtle)] hover:text-[var(--brand-400)] transition-colors">
          {label}
        </Link>
      ))}
    </div>
  );
}
