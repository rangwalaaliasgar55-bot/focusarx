import Link from "next/link";
import { notFound } from "next/navigation";
import { RawJsonBlock } from "@/components/admin/RawJsonBlock";
import { TimelineInspector } from "@/components/admin/TimelineInspector";
import { parseFocusTimeline, parseSessionInsights } from "@/lib/dashboard-utils";
import { formatDateTime, formatDuration, maskEmail } from "@/lib/admin-utils";
import { getSessionForAdmin } from "@/server/focus-session-compat";

type Props = { params: Promise<{ sessionId: string }> };

export default async function AdminSessionDetailPage({ params }: Props) {
  const { sessionId } = await params;

  const session = await getSessionForAdmin(sessionId);
  if (!session) notFound();

  const timeline = parseFocusTimeline(session.focusTimeline);
  const insights = parseSessionInsights(session.sessionInsights);
  const duration =
    session.status === "active" ? session.activeSeconds : session.durationSec;

  const fields: { label: string; value: string | number | boolean | null }[] = [
    { label: "id", value: session.id },
    { label: "userId", value: session.userId },
    { label: "mode", value: session.mode },
    { label: "status", value: session.status },
    { label: "durationSec", value: session.durationSec },
    { label: "activeSeconds", value: session.activeSeconds },
    { label: "secondsLeft", value: session.secondsLeft },
    { label: "timerStatus", value: session.timerStatus },
    { label: "focusScore", value: session.focusScore },
    { label: "focusQuality", value: session.focusQuality },
    { label: "focusState", value: session.focusState },
    { label: "distractionCount", value: session.distractionCount },
    { label: "lastSeenFaceAt", value: formatDateTime(session.lastSeenFaceAt) },
    { label: "stabilityRating", value: session.stabilityRating },
    { label: "monitorEnabled", value: session.monitorEnabled },
    { label: "clientNonce", value: session.clientNonce },
    { label: "taskId", value: session.taskId },
    { label: "startedAt", value: formatDateTime(session.startedAt) },
    { label: "completedAt", value: formatDateTime(session.completedAt) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/admin/users/${session.userId}`}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          ← {session.user.name ?? "User"} sessions
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Session breakdown</h1>
        <p className="mt-1 font-mono text-xs text-zinc-600">{session.id}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard
          title="User"
          lines={[
            session.user.name ?? "Unnamed",
            maskEmail(session.user.email),
            session.user.isGuest ? "Guest" : "Registered",
          ]}
          href={`/admin/users/${session.userId}`}
        />
        <SummaryCard
          title="Tracking"
          lines={[
            `${session.mode} · ${session.status}`,
            formatDuration(duration),
            session.focusScore != null ? `Score ${session.focusScore}` : "No score",
          ]}
        />
        <SummaryCard
          title="Focus debug"
          lines={[
            `State: ${session.focusState ?? "—"}`,
            `Distractions: ${session.distractionCount}`,
            `Monitor: ${session.monitorEnabled ? "on" : "off"}`,
          ]}
        />
      </div>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
        <h2 className="text-sm font-semibold text-zinc-200">Timeline replay</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Visual map of focus vs distracted segments from stored JSON.
        </p>
        <div className="mt-4">
          <TimelineInspector timeline={timeline} durationSec={duration} />
        </div>
      </section>

      {insights && (
        <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
          <h2 className="text-sm font-semibold text-zinc-200">Session insights</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <InsightRow label="Summary" value={insights.summary} />
            <InsightRow label="Best focus" value={insights.bestFocusPeriod} />
            <InsightRow label="Worst distraction" value={insights.worstDistractionPeriod} />
            <InsightRow
              label="Interruptions"
              value={String(insights.totalInterruptions)}
            />
            <InsightRow label="Stability" value={insights.stabilityRating} />
          </dl>
        </section>
      )}

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
        <h2 className="text-sm font-semibold text-zinc-200">Prisma fields</h2>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          {fields.map((f) => (
            <div
              key={f.label}
              className="flex gap-2 rounded-lg bg-zinc-950/50 px-3 py-2 text-xs"
            >
              <dt className="shrink-0 font-mono text-zinc-500">{f.label}</dt>
              <dd className="break-all text-zinc-300">{String(f.value ?? "—")}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <RawJsonBlock label="Raw focusTimeline JSON" data={timeline ?? session.focusTimeline} />
        <RawJsonBlock label="Raw sessionInsights JSON" data={insights ?? session.sessionInsights} />
      </div>

      <RawJsonBlock label="Full session record (debug)" data={session} />
    </div>
  );
}

function SummaryCard({
  title,
  lines,
  href,
}: {
  title: string;
  lines: string[];
  href?: string;
}) {
  const inner = (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </p>
      <ul className="mt-2 space-y-1 text-sm text-zinc-300">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition hover:ring-1 hover:ring-zinc-700">
        {inner}
      </Link>
    );
  }
  return inner;
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-zinc-300">{value}</dd>
    </div>
  );
}
