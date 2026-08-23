import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, Clock3, Play, Sparkles } from "lucide-react";
import { getToken } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { ErrorState } from "@/components/ErrorState";

async function api(path: string, init?: RequestInit) {
  const token = getToken();
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}

type Session = { id: string; durationSec: number; focusScore?: number; completedAt?: string; category?: string; focusTimeline?: string };
type Point = { ts: number; type: string };

export default function SessionReplayPage() {
  const [selected, setSelected] = useState<Session | null>(null);
  const [position, setPosition] = useState(0);
  const [caption, setCaption] = useState<string | null>(null);
  const query = useQuery<{ sessions: Session[] }>({ queryKey: ["session-replay"], queryFn: () => api("/api/session-replay") });
  const captionMutation = useMutation({ mutationFn: (id: string) => api(`/api/session-replay/${id}/caption`, { method: "POST" }), onSuccess: (data) => setCaption(data.caption) });
  const points = useMemo<Point[]>(() => { try { const value = JSON.parse(selected?.focusTimeline ?? "[]"); return Array.isArray(value) ? value : []; } catch { return []; } }, [selected]);
  const duration = selected?.durationSec ?? 1;
  const visible = points.filter((point) => point.ts <= position);

  if (query.isError) return <ErrorState title="Session replay unavailable" onRetry={() => void query.refetch()} />;
  return (
    <div className="page-container">
      <PageHeader eyebrow="Reflection" title="Session Replay" subtitle="Play back the attention timeline, pauses, and recovery moments from a completed block." icon={<Activity />} />
      <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
        <aside className="ui-panel max-h-[65vh] overflow-y-auto p-3" aria-label="Completed sessions">
          {query.isLoading ? <p className="p-4 text-sm text-[var(--foreground-muted)]">Loading sessions…</p> : query.data?.sessions.map((session) => (
            <button key={session.id} onClick={() => { setSelected(session); setPosition(0); setCaption(null); }} className={`mb-2 w-full rounded-xl border p-3 text-left ${selected?.id === session.id ? "border-[var(--brand-500)] bg-[var(--brand-soft)]" : "border-[var(--border)]"}`}>
              <p className="font-semibold">{session.category || "Focus session"}</p><p className="mt-1 text-xs text-[var(--foreground-subtle)]">{Math.round(session.durationSec / 60)} min · {session.completedAt ? new Date(session.completedAt).toLocaleDateString() : "Recent"}</p>
            </button>
          ))}
        </aside>
        <section className="ui-panel min-h-96 p-5">
          {!selected ? <div className="grid h-full place-items-center text-center"><div><Play className="mx-auto text-[var(--brand-500)]" /><p className="mt-3 font-semibold">Select a session to replay</p></div></div> : <>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{selected.category || "Focus session"}</h2><p className="text-sm text-[var(--foreground-muted)]">Focus score {selected.focusScore ?? "—"}</p></div><button onClick={() => captionMutation.mutate(selected.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand-600)] px-4 text-sm font-semibold text-white"><Sparkles size={15} /> AI recap</button></div>
            <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-5">
              <div className="relative h-16"><div className="absolute left-0 right-0 top-7 h-2 rounded-full bg-[var(--border)]" />{points.map((point, index) => <span key={`${point.ts}-${index}`} title={`${point.type} at ${Math.round(point.ts / 60)}m`} className={`absolute top-5 h-6 w-2 rounded-full ${point.type.includes("distraction") || point.type.includes("pause") ? "bg-[var(--danger)]" : "bg-[var(--success)]"}`} style={{ left: `${Math.min(100, point.ts / duration * 100)}%`, opacity: point.ts <= position ? 1 : .25 }} />)}</div>
              <input aria-label="Replay position" type="range" min={0} max={duration} value={position} onChange={(event) => setPosition(Number(event.target.value))} className="w-full" />
              <div className="mt-2 flex justify-between text-xs text-[var(--foreground-subtle)]"><span className="inline-flex gap-1"><Clock3 size={12} /> {Math.round(position / 60)}m</span><span>{visible.length} events played</span><span>{Math.round(duration / 60)}m</span></div>
            </div>
            {caption && <blockquote className="mt-5 rounded-2xl border border-[var(--brand-500)]/20 bg-[var(--brand-soft)] p-4 text-sm leading-relaxed">{caption}</blockquote>}
          </>}
        </section>
      </div>
    </div>
  );
}
