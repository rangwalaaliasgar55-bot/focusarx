import Link from "next/link";
import { prisma } from "@/server/db";
import { formatDateTime, maskEmail } from "@/lib/admin-utils";
import { countActiveSessions } from "@/server/focus-session-compat";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      _count: { select: { focusSessions: true } },
      studyStreak: { select: { currentStreak: true } },
    },
  });

  const activeCount = await countActiveSessions();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Prisma is the source of truth — inspect every account and session below.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Total users" value={String(users.length)} />
        <MetricCard label="Guest accounts" value={String(users.filter((u) => u.isGuest).length)} />
        <MetricCard label="Active sessions" value={String(activeCount)} accent="rose" />
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800/80">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/80 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Sessions</th>
              <th className="px-4 py-3 font-medium">Streak</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-t border-zinc-800/60 transition hover:bg-zinc-900/40"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-200">
                    {user.name ?? "Unnamed"}
                  </p>
                  <p className="text-xs text-zinc-500">{maskEmail(user.email)}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-zinc-600">{user.id}</p>
                </td>
                <td className="px-4 py-3">
                  {user.isGuest ? (
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                      Guest
                    </span>
                  ) : (
                    <span className="rounded-full bg-sky-950 px-2 py-0.5 text-xs text-sky-400">
                      Registered
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-300">
                  {user._count.focusSessions}
                </td>
                <td className="px-4 py-3 text-zinc-300">
                  {user.studyStreak?.currentStreak ?? 0}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {formatDateTime(user.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-xs font-medium text-rose-400 hover:text-rose-300"
                  >
                    View sessions →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "rose";
}) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${accent === "rose" ? "text-rose-400" : "text-zinc-100"}`}
      >
        {value}
      </p>
    </div>
  );
}
