import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { formatDateTime, formatDuration, maskEmail } from "@/lib/admin-utils";
import { listUserSessionsForAdmin } from "@/server/focus-session-compat";

type Props = { params: Promise<{ userId: string }> };

export default async function AdminUserSessionsPage({ params }: Props) {
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      studyStreak: true,
      _count: { select: { focusSessions: true, tasks: true } },
    },
  });

  if (!user) notFound();

  const sessions = await listUserSessionsForAdmin(userId);

  const completedFocus = sessions.filter(
    (s) => s.mode === "focus" && s.status === "completed"
  );
  const totalFocusSec = completedFocus.reduce((a, s) => a + s.durationSec, 0);
  const scored = completedFocus.filter((s) => s.focusScore != null);
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((a, s) => a + (s.focusScore ?? 0), 0) / scored.length)
      : null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← All users
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">{user.name ?? "User"}</h1>
        <p className="text-sm text-zinc-500">{maskEmail(user.email)}</p>
        <p className="mt-1 font-mono text-[10px] text-zinc-600">{user.id}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <MiniStat label="Sessions" value={String(user._count.focusSessions)} />
        <MiniStat label="Focus time" value={formatDuration(totalFocusSec)} />
        <MiniStat label="Avg focus score" value={avgScore != null ? `${avgScore}` : "—"} />
        <MiniStat label="Streak" value={String(user.studyStreak?.currentStreak ?? 0)} />
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800/80">
        <div className="border-b border-zinc-800/80 bg-zinc-900/50 px-4 py-3">
          <h2 className="text-sm font-medium text-zinc-300">All sessions</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Mode</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Duration</th>
              <th className="px-4 py-2 font-medium">Score</th>
              <th className="px-4 py-2 font-medium">Focus state</th>
              <th className="px-4 py-2 font-medium">Started</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No sessions yet
                </td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-zinc-800/60 hover:bg-zinc-900/40"
                >
                  <td className="px-4 py-3 capitalize text-zinc-300">{s.mode}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    {s.status === "active"
                      ? `${s.activeSeconds}s active`
                      : formatDuration(s.durationSec)}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{s.focusScore ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{s.focusState ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {formatDateTime(s.startedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/sessions/${s.id}`}
                      className="text-xs font-medium text-rose-400 hover:text-rose-300"
                    >
                      Inspect →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-3 py-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${
        active
          ? "bg-rose-950 text-rose-400 ring-1 ring-rose-500/30"
          : "bg-zinc-800 text-zinc-400"
      }`}
    >
      {status}
    </span>
  );
}
