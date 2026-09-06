import { useState, useEffect } from "react";
import { LoadingState, MotionTab, SectionHeader, adminFetch } from "./AdminHelpers";
import type { AdminPanelProps } from "./AdminTypes";

export function AdminModerationPanel({ authHeaders }: AdminPanelProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [digestSending, setDigestSending] = useState(false);
  const [digestResult, setDigestResult] = useState<string | null>(null);

  useEffect(() => { loadQueue(); }, []);

  useEffect(() => {
    if (posts.length === 0) return;
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const first = posts[0];
      if (!first || actionId) return;
      if (event.key.toLowerCase() === "a") { event.preventDefault(); void moderatePost(first.id, "approve"); }
      if (event.key.toLowerCase() === "r") { event.preventDefault(); void moderatePost(first.id, "reject"); }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [actionId, posts]);

  async function loadQueue() {
    setLoading(true);
    try {
      const r = await adminFetch("/api/admin/moderation/queue", { headers: authHeaders(), credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setPosts(d.posts ?? []);
        setCount(d.flaggedCount ?? 0);
      }
    } finally { setLoading(false); }
  }

  async function moderatePost(postId: string, action: "approve" | "reject") {
    setActionId(postId);
    try {
      const r = await adminFetch(`/api/admin/moderation/${postId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ reason: "Removed by admin" }),
      });
      if (r.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setCount((c) => Math.max(0, c - 1));
      }
    } finally { setActionId(null); }
  }

  async function sendDigest() {
    setDigestSending(true); setDigestResult(null);
    try {
      const r = await adminFetch("/api/admin/moderation/digest", { method: "POST", headers: authHeaders(), credentials: "include" });
      const d = await r.json();
      if (r.ok) setDigestResult(d.sent ? `Digest emailed with ${d.flaggedCount} flagged post(s).` : (d.reason ?? "Nothing to send."));
      else setDigestResult("Error: " + (d.error ?? "Failed"));
    } catch (e: any) { setDigestResult("Error: " + e.message); }
    finally { setDigestSending(false); }
  }

  return (
    <MotionTab>
      <SectionHeader
        title="Content Moderation"
        sub={`${count} post${count !== 1 ? "s" : ""} awaiting review. AI flags suspicious content automatically; approve or remove here.`}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
        <button onClick={() => void loadQueue()}
          className="min-h-10 rounded-lg border border-[var(--border-strong)] px-3 text-xs font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        >↻ Refresh queue</button>
        <button onClick={() => void sendDigest()} disabled={digestSending}
          className="min-h-10 rounded-lg border border-[var(--card-border)] bg-[var(--brand-soft)] px-3 text-xs font-medium text-[var(--brand-strong)] disabled:opacity-50"
        >{digestSending ? "Sending…" : "Email digest"}</button>
        {digestResult && <span className="text-xs text-[var(--foreground-muted)]">{digestResult}</span>}
        <span className="ml-auto text-[0.6875rem] text-[var(--foreground-subtle)]">
          Shortcuts: <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5">A</kbd> approve · <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5">R</kbd> reject first item
        </span>
      </div>

      {loading ? (
        <LoadingState text="Loading moderation queue…" />
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-[var(--palette-emerald-800)]/60 bg-[var(--palette-emerald-900)]/20 p-10 text-center">
          <p className="text-lg">✅</p>
          <p className="mt-2 text-sm font-medium text-[var(--palette-emerald-300)]">All clear — no flagged content.</p>
          <p className="mt-1 text-xs text-[var(--palette-zinc-500)]">New posts are auto-moderated as they come in.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p, index) => (
            <div key={p.id} className="rounded-xl border border-[color-mix(in_srgb,var(--warning)_28%,transparent)] bg-[var(--warning-soft)] p-4 sm:p-5">
              <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="rounded-full border border-[color-mix(in_srgb,var(--warning)_26%,transparent)] bg-[var(--warning-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning)]">
                      {index === 0 ? "First in queue · " : ""}{p.moderationStatus}
                    </span>
                    <span className="text-[10px] text-[var(--palette-zinc-500)]">
                      {p.author?.name || p.author?.email || "Unknown"} · {p.type}
                    </span>
                    <span className="text-[10px] text-[var(--palette-zinc-600)]">
                      {new Date(p.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--palette-zinc-200)] whitespace-pre-wrap break-words">{p.content}</p>
                  {p.moderationReason && (
                    <p className="mt-2 text-xs text-[var(--palette-amber-500)]/80">Reason: {p.moderationReason}</p>
                  )}
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:flex-col">
                  <button onClick={() => void moderatePost(p.id, "approve")} disabled={actionId === p.id}
                    className="min-h-11 rounded-lg border border-[var(--success)] bg-[var(--success-soft)] px-4 text-xs font-semibold text-[var(--success)] disabled:opacity-50"
                  >Approve {index === 0 && <kbd className="ml-1 opacity-70">A</kbd>}</button>
                  <button onClick={() => void moderatePost(p.id, "reject")} disabled={actionId === p.id}
                    className="min-h-11 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] px-4 text-xs font-semibold text-[var(--danger)] disabled:opacity-50"
                  >Reject {index === 0 && <kbd className="ml-1 opacity-70">R</kbd>}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </MotionTab>
  );
}
