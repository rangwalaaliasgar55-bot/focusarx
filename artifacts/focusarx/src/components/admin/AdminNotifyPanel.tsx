import { useState } from "react";
import { Send, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { SectionHeader, MotionTab } from "./AdminHelpers";
import type { AdminPanelProps } from "./AdminTypes";

export function AdminNotifyPanel({ authHeaders }: AdminPanelProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("system");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!title || !message) return;
    setSending(true); setResult(null); setError(null);
    try {
      const r = await fetch("/api/admin/cms/notify-all", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, message, type }),
      });
      const d = await r.json();
      if (r.ok) { setResult(d); setTitle(""); setMessage(""); }
      else setError(d.error ?? "Failed");
    } finally { setSending(false); }
  }

  const QUICK_TEMPLATES = [
    { title: "Welcome Back!", message: "We've been working hard on new features. Check out what's new in FocusArx!", type: "announcement" },
    { title: "🎁 Special Reward", message: "As a thank you for being part of FocusArx, you've received a bonus today. Keep up the great work!", type: "reward" },
    { title: "⚡ Weekly Challenge", message: "This week's challenge is live! Complete 5 focus sessions today and earn bonus XP.", type: "mission" },
    { title: "🔧 Maintenance Notice", message: "We'll be performing maintenance tonight. The app will be back up within 30 minutes.", type: "system" },
  ];

  return (
    <MotionTab>
      <SectionHeader title="Notification Blast" sub="Send a platform-wide notification to all registered users." />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">Compose Message</p>

          <div>
            <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Notification Type</label>
            <select className="admin-input" value={type} onChange={e => setType(e.target.value)}>
              <option value="system">System</option>
              <option value="announcement">Announcement</option>
              <option value="reward">Reward</option>
              <option value="mission">Mission</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Title</label>
            <input className="admin-input" placeholder="e.g. New Feature Alert!" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Message</label>
            <textarea className="admin-input resize-none" rows={4} placeholder="Your message to all users…" value={message} onChange={e => setMessage(e.target.value)} />
          </div>

          <button onClick={() => void send()} disabled={sending || !title || !message}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--palette-violet-700)] hover:bg-[var(--palette-violet-600)] px-4 py-2.5 text-sm font-medium text-[var(--palette-white)] disabled:opacity-50 transition"
          >
            {sending ? <><RefreshCw size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send to All Users</>}
          </button>

          {result && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--palette-emerald-800)]/50 bg-[var(--palette-emerald-950)]/30 px-4 py-3 text-[var(--palette-emerald-400)] text-sm">
              <CheckCircle size={14} /> Sent to {result.sent} users successfully!
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--palette-red-800)]/50 bg-[var(--palette-red-950)]/30 px-4 py-3 text-[var(--palette-red-400)] text-sm">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)] mb-3">Quick Templates</p>
            <div className="space-y-2">
              {QUICK_TEMPLATES.map(t => (
                <button key={t.title} onClick={() => { setTitle(t.title); setMessage(t.message); setType(t.type); }}
                  className="w-full text-left rounded-lg border border-[var(--palette-zinc-800)] px-3 py-2.5 hover:border-[var(--palette-zinc-600)] hover:bg-[var(--palette-zinc-800)]/50 transition"
                >
                  <p className="text-xs font-medium text-[var(--palette-zinc-300)]">{t.title}</p>
                  <p className="text-[10px] text-[var(--palette-zinc-500)] mt-0.5 line-clamp-1">{t.message}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--palette-amber-800)]/30 bg-[var(--palette-amber-950)]/10 p-4">
            <div className="flex items-start gap-2 text-[var(--palette-amber-400)]">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold">Important</p>
                <p className="text-[10px] text-[var(--palette-amber-500)] mt-1 leading-relaxed">
                  This sends an in-app notification to all registered users. Use sparingly. Guests do not receive notifications.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MotionTab>
  );
}
