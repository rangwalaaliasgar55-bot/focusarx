import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { Trash2, ArrowLeft, CheckCircle } from "lucide-react";
import { useState } from "react";
import { getToken } from "@/lib/auth";
import { apiJson, errorMessage } from "@/lib/api";

export default function DataDeletionPage() {
  const [step, setStep] = useState<"idle" | "confirm" | "done" | "error" | "signed-out">("idle");
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [outcome, setOutcome] = useState<{ deleted?: boolean; scheduledFor?: string; daysRemaining?: number }>({});
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    try {
      // This used to call GET /api/auth/session and, on a 200, show "Deletion
      // request received" — without ever calling DELETE /api/auth/account. A
      // user exercising their right to erasure was told their request had been
      // received and nothing whatsoever happened. There was no request.
      const token = getToken();
      if (!token) {
        setStep("signed-out");
        return;
      }
      const result = await apiJson<{
        deleted?: boolean;
        scheduledFor?: string;
        daysRemaining?: number;
      }>("/api/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ password: password || undefined }),
      });
      setOutcome(result);
      setStep("done");
    } catch (err) {
      setError(errorMessage(err, "We could not process the request. Please try again, or email us."));
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh]">
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
                  <p className="mb-4">
                    If you are signed in, you can schedule deletion below. Your account is deactivated and{" "}
                    <strong className="text-[var(--foreground)]">kept for 30 days</strong>, during which you can
                    sign back in and cancel. After the 30 days your data is permanently removed. No action is
                    taken on the day you ask.
                  </p>

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
                      <p className="text-sm font-semibold text-[var(--palette-f87171)]">
                        ⚠️ You will be signed out and your account scheduled for removal in 30 days.
                      </p>
                      <div className="space-y-2">
                        <label htmlFor="deletion-password" className="block text-xs text-[var(--foreground-muted)]">
                          Confirm your password
                        </label>
                        <input
                          id="deletion-password"
                          type="password"
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full max-w-xs rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-16-23-50-0_6)] px-3 py-2 text-sm text-[var(--foreground)]"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleDelete}
                          disabled={loading}
                          className="rounded-xl bg-[var(--color-error)] px-5 py-2.5 text-sm font-bold text-[var(--palette-white)] transition-all hover:bg-[var(--palette-dc2626)] disabled:opacity-50"
                        >
                          {loading ? "Scheduling…" : "Schedule deletion"}
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
                        <p className="text-sm font-semibold text-[var(--palette-4ade80)]">Deletion scheduled</p>
                        <p className="text-xs text-[var(--foreground-muted)]">
                          {outcome.deleted
                            ? "Your data has been permanently removed."
                            : `Your account and data will be permanently removed on ${
                                outcome.scheduledFor
                                  ? new Date(outcome.scheduledFor).toLocaleDateString(undefined, {
                                      year: "numeric", month: "long", day: "numeric",
                                    })
                                  : "a date 30 days from now"
                              }. Sign in before then and press "Keep my account" to cancel — nothing has been removed yet.`}
                        </p>
                      </div>
                    </div>
                  )}

                  {step === "error" && (
                    <p role="alert" className="text-sm text-[var(--palette-f87171)]">
                      {error ?? "Something went wrong."} You can also email us directly at focusarx@gmail.com.
                    </p>
                  )}

                  {step === "signed-out" && (
                    <p className="text-sm text-[var(--foreground-muted)]">
                      You are not signed in, so we cannot verify which account to delete. Please{" "}
                      <Link href="/login" className="text-[var(--brand-400)] underline">sign in</Link> and try again,
                      or use the email option above.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_1)] bg-[var(--rgba-16-23-50-0_4)] p-6">
              <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">After deletion</h2>
              <div className="space-y-2 text-sm text-[var(--foreground-muted)]">
                <p>Thirty days after your request, all personal data associated with your account is permanently deleted from our databases. Until then it is retained so that the decision can be reversed. Anonymised, aggregated data (e.g. "X total focus hours were logged on this day across all users") may be retained for product analytics, as it cannot be linked back to you.</p>
                <p>Backups are purged on a rolling 30-day cycle, counted from the end of the grace period.</p>
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
    { href: "/accessibility", label: "Accessibility" },
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
