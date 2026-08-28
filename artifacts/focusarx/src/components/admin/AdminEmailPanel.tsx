import { useState, useEffect } from "react";
import { Send, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { SectionHeader, Badge, MotionTab, LoadingState } from "./AdminHelpers";
import type { AdminPanelProps } from "./AdminTypes";

export function AdminEmailPanel({ authHeaders }: AdminPanelProps) {
  const [template, setTemplate] = useState("welcome");
  const [audience, setAudience] = useState<"all" | "inactive" | "premium" | "selected">("all");
  const [customSubject, setCustomSubject] = useState("");
  const [customHtml, setCustomHtml] = useState("");
  const [blasting, setBlasting] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [templates, setTemplates] = useState<{ key: string; subject: string }[]>([]);

  useEffect(() => { loadLogs(); loadTemplates(); }, []);

  async function loadLogs() {
    setLogsLoading(true);
    try {
      const r = await fetch("/api/admin/email/logs", { headers: authHeaders(), credentials: "include" });
      if (r.ok) { const d = await r.json(); setLogs(d.logs ?? []); }
    } finally { setLogsLoading(false); }
  }

  async function loadTemplates() {
    try {
      const r = await fetch("/api/admin/email/templates", { headers: authHeaders(), credentials: "include" });
      if (r.ok) { const d = await r.json(); setTemplates(d.templates ?? []); }
    } catch { /* ignore */ }
  }

  async function sendBlast() {
    setBlasting(true); setResult(null); setError(null);
    try {
      const r = await fetch("/api/admin/email/blast", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({
          template,
          audience,
          customSubject: customSubject || undefined,
          customHtml: customHtml || undefined,
        }),
      });
      const d = await r.json();
      if (r.ok) { setResult(d); loadLogs(); }
      else setError(d.error ?? "Failed to send");
    } catch (e: any) { setError(e.message); }
    finally { setBlasting(false); }
  }

  const TEMPLATES = templates.length > 0 ? templates : [
    { key: "welcome", subject: "Welcome to FocusArx 🎯" },
    { key: "come_back", subject: "We miss you! Come back and focus 🔥" },
    { key: "streak_reminder", subject: "Don't break your streak! 🔥" },
    { key: "new_feature", subject: "New Features Available ✨" },
    { key: "weekly_report", subject: "Your Weekly Focus Report 📊" },
    { key: "monthly_wrapped", subject: "Your Monthly Focus Wrapped 🎁" },
    { key: "premium_promo", subject: "Unlock Premium 👑" },
  ];

  return (
    <MotionTab>
      <SectionHeader title="Email System" sub="Send email blasts to your users. Requires RESEND_API_KEY env var." />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">Send Email Blast</p>

          <div>
            <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Template</label>
            <select className="admin-input" value={template} onChange={e => setTemplate(e.target.value)}>
              {TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.key} — {t.subject}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Audience</label>
            <select className="admin-input" value={audience} onChange={e => setAudience(e.target.value as any)}>
              <option value="all">All registered users</option>
              <option value="inactive">Inactive users (7+ days)</option>
              <option value="premium">Premium users only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Custom Subject (optional)</label>
            <input className="admin-input" placeholder="Leave blank to use template subject" value={customSubject} onChange={e => setCustomSubject(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Custom HTML Body (optional)</label>
            <textarea className="admin-input resize-none font-mono text-xs" rows={4}
              placeholder="<h1>Hello!</h1><p>Your message here…</p>"
              value={customHtml} onChange={e => setCustomHtml(e.target.value)} />
          </div>

          <button onClick={() => void sendBlast()} disabled={blasting}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--palette-sky-700)] hover:bg-[var(--palette-sky-600)] px-4 py-2.5 text-sm font-medium text-[var(--palette-white)] disabled:opacity-50 transition"
          >
            {blasting ? <><RefreshCw size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send Email Blast</>}
          </button>

          {result && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--palette-emerald-800)]/50 bg-[var(--palette-emerald-950)]/30 px-4 py-3 text-[var(--palette-emerald-400)] text-sm">
              <CheckCircle size={14} /> Sent to {result.sent}/{result.total} users — {result.failed} failed
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--palette-red-800)]/50 bg-[var(--palette-red-950)]/30 px-4 py-3 text-[var(--palette-red-400)] text-sm">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div className="rounded-xl border border-[var(--palette-amber-800)]/30 bg-[var(--palette-amber-950)]/10 p-4">
            <div className="flex items-start gap-2 text-[var(--palette-amber-400)]">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <p className="text-[10px] text-[var(--palette-amber-500)] leading-relaxed">
                Emails require <code className="bg-[var(--palette-amber-950)] px-1 rounded">RESEND_API_KEY</code> to actually deliver. Max 500 recipients per blast.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">Recent Logs</p>
            <button onClick={() => loadLogs()} className="text-[10px] text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)] flex items-center gap-1">
              <RefreshCw size={10} /> Refresh
            </button>
          </div>
          {logsLoading ? (
            <LoadingState />
          ) : logs.length === 0 ? (
            <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/20 p-4 text-center text-xs text-[var(--palette-zinc-500)]">No emails sent yet.</div>
          ) : (
            <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 max-h-[500px] overflow-auto">
              <table className="min-w-[40rem] w-full text-left text-xs">
                <thead className="bg-[var(--palette-zinc-900)]/80 text-[var(--palette-zinc-500)] uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-medium">Recipient</th>
                    <th className="px-3 py-2 font-medium">Template</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--palette-zinc-800)]/50">
                  {logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-[var(--palette-zinc-900)]/30">
                      <td className="px-3 py-2 text-[var(--palette-zinc-300)] truncate max-w-[160px]">{log.recipientEmail}</td>
                      <td className="px-3 py-2 text-[var(--palette-zinc-500)]">{log.template}</td>
                      <td className="px-3 py-2">
                        <Badge label={log.status} color={log.status === "sent" ? "bg-[var(--palette-emerald-950)] text-[var(--palette-emerald-400)]" : log.status === "failed" ? "bg-[var(--palette-red-950)] text-[var(--palette-red-400)]" : "bg-[var(--palette-zinc-800)] text-[var(--palette-zinc-400)]"} />
                      </td>
                      <td className="px-3 py-2 text-[var(--palette-zinc-600)] text-[10px]">
                        {log.sentAt ? new Date(log.sentAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MotionTab>
  );
}
