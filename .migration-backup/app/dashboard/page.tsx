import Link from "next/link";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";
import { PageTransition } from "@/components/PageTransition";
import { SessionCard, type DashboardSession } from "@/components/dashboard/SessionCard";
import { parseFocusTimeline, parseSessionInsights } from "@/lib/dashboard-utils";
import { completedFocusSessionWhereForUser } from "@/server/focus-session-filters";
import { isSchemaMismatchError } from "@/server/prisma-errors";

async function listFocusSessionsFull(
  args: Omit<Parameters<typeof prisma.focusSession.findMany>[0], "select">
) {
  return prisma.focusSession.findMany({
    ...args,
    select: {
      id: true,
      mode: true,
      durationSec: true,
      completedAt: true,
      focusScore: true,
      focusQuality: true,
      stabilityRating: true,
      focusTimeline: true,
      sessionInsights: true,
    },
  });
}

async function listFocusSessionsBasic(
  args: Omit<Parameters<typeof prisma.focusSession.findMany>[0], "select">
) {
  return prisma.focusSession.findMany({
    ...args,
    select: {
      id: true,
      mode: true,
      durationSec: true,
      completedAt: true,
    },
  });
}

async function listTodayMetrics(
  where: NonNullable<Parameters<typeof prisma.focusSession.findMany>[0]>["where"]
) {
  try {
    return await prisma.focusSession.findMany({
      where,
      select: { durationSec: true, focusScore: true, stabilityRating: true },
    });
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
  }

  try {
    return await prisma.focusSession.findMany({
      where,
      select: { durationSec: true, focusScore: true },
    });
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
  }

  return prisma.focusSession.findMany({
    where,
    select: { durationSec: true },
  });
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);

  const todayWhere = {
    userId,
    mode: "focus" as const,
    completedAt: { gte: todayStart, lt: todayEnd },
  };

  const completedWhere = completedFocusSessionWhereForUser(userId);

  let recentSessions:
    | Awaited<ReturnType<typeof listFocusSessionsFull>>
    | Awaited<ReturnType<typeof listFocusSessionsBasic>>;
  try {
    recentSessions = await listFocusSessionsFull({
      where: completedWhere,
      orderBy: { completedAt: "desc" },
      take: 8,
    });
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    recentSessions = await listFocusSessionsBasic({
      where: completedWhere,
      orderBy: { completedAt: "desc" },
      take: 8,
    });
  }

  let focusSessionsToday: Awaited<ReturnType<typeof listTodayMetrics>>;
  let weeklySessions: { completedAt: Date | null; durationSec: number }[];

  try {
    [focusSessionsToday, weeklySessions] = await Promise.all([
      listTodayMetrics(todayWhere),
      prisma.focusSession.findMany({
        where: {
          userId,
          mode: "focus",
          completedAt: { gte: weekStart, not: null },
        },
        select: { completedAt: true, durationSec: true },
      }),
    ]);
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    focusSessionsToday = await listTodayMetrics(todayWhere);
    weeklySessions = await prisma.focusSession.findMany({
      where: { userId, mode: "focus", completedAt: { gte: weekStart } },
      select: { completedAt: true, durationSec: true },
    });
  }

  const [streak, completedTasks] = await Promise.all([
    prisma.studyStreak.findUnique({ where: { userId } }),
    prisma.task.count({ where: { userId, completed: true } }),
  ]);

  const totalStudyMinutesToday = focusSessionsToday.reduce(
    (a, s) => a + Math.round(s.durationSec / 60),
    0
  );

  const scoredToday = focusSessionsToday.filter(
    (s): s is { durationSec: number; focusScore: number } =>
      "focusScore" in s && typeof s.focusScore === "number"
  );
  const avgFocusScore =
    scoredToday.length > 0
      ? Math.round(
          scoredToday.reduce((a, s) => a + s.focusScore, 0) / scoredToday.length
        )
      : null;

  const stabilityCounts = { high: 0, medium: 0, low: 0 };
  focusSessionsToday.forEach((s) => {
    if (!("stabilityRating" in s) || !s.stabilityRating) return;
    const rating = s.stabilityRating as string;
    if (rating === "High Stability") stabilityCounts.high++;
    else if (rating === "Medium Stability") stabilityCounts.medium++;
    else if (rating === "Low Stability") stabilityCounts.low++;
  });
  const dominantStability =
    stabilityCounts.high >= stabilityCounts.medium &&
    stabilityCounts.high >= stabilityCounts.low
      ? "High Stability"
      : stabilityCounts.medium >= stabilityCounts.low
        ? "Medium Stability"
        : focusSessionsToday.length > 0
          ? "Low Stability"
          : "—";

  const currentStreak = streak?.currentStreak ?? 0;

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    return {
      day: days[d.getUTCDay()],
      date: d.toISOString().split("T")[0],
      minutes: 0,
    };
  });

  weeklySessions.forEach((s) => {
    if (!s.completedAt) return;
    const dateStr = s.completedAt.toISOString().split("T")[0];
    const chartEntry = chartData.find((c) => c.date === dateStr);
    if (chartEntry) {
      chartEntry.minutes += Math.round(s.durationSec / 60);
    }
  });

  const maxMinutes = Math.max(1, ...chartData.map((d) => d.minutes));

  const sessionCards: DashboardSession[] = recentSessions
    .filter((s): s is typeof s & { completedAt: Date } => s.completedAt != null)
    .map((s) => ({
    id: s.id,
    mode: s.mode,
    durationSec: s.durationSec,
    completedAt: s.completedAt as Date,
    focusScore: "focusScore" in s ? (s.focusScore as number | null) : null,
    focusQuality: "focusQuality" in s ? (s.focusQuality as string | null) : null,
    stabilityRating:
      "stabilityRating" in s ? (s.stabilityRating as string | null) : null,
    focusTimeline:
      "focusTimeline" in s && s.focusTimeline
        ? parseFocusTimeline(s.focusTimeline as string)
        : null,
    sessionInsights:
      "sessionInsights" in s && s.sessionInsights
        ? parseSessionInsights(s.sessionInsights as string)
        : null,
  }));

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        <div className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15),transparent_68%)] blur-2xl" />
        <div className="absolute -right-24 top-1/3 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.12),transparent_65%)] blur-2xl" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center px-4 pb-16 pt-12 sm:max-w-xl sm:pt-16">
        <PageTransition>
          <header className="mb-10 w-full text-center">
            <nav className="mb-6 flex justify-center gap-4 text-xs font-medium text-zinc-500">
              <Link href="/" className="transition-colors hover:text-zinc-200">
                Timer
              </Link>
              <span className="text-zinc-200">Dashboard</span>
              <Link href="/roadmap" className="transition-colors hover:text-zinc-200">
                AI roadmap
              </Link>
            </nav>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
              Your progress
            </p>
            <h1 className="mt-2 bg-gradient-to-br from-zinc-100 via-zinc-200 to-zinc-500 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl">
              Dashboard
            </h1>
          </header>

          <section className="w-full space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <OverviewCard label="Study today" value={`${totalStudyMinutesToday}m`} />
              <OverviewCard
                label="Avg focus"
                value={avgFocusScore != null ? `${avgFocusScore}` : "—"}
              />
              <OverviewCard
                label="Stability"
                value={dominantStability.split(" ")[0]}
                sub={dominantStability}
              />
              <OverviewCard label="Sessions" value={`${focusSessionsToday.length}`} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <OverviewCard label="Day streak" value={`${currentStreak}`} />
              <OverviewCard label="Tasks done" value={`${completedTasks}`} />
            </div>

            <div className="rounded-[1.75rem] border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-xl backdrop-blur-xl">
              <h2 className="mb-8 text-center text-sm font-medium text-zinc-400">
                Weekly focus (minutes from tracked time)
              </h2>
              {maxMinutes <= 1 && focusSessionsToday.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-zinc-500">
                  <p className="text-sm">No focus time this week yet.</p>
                  <Link href="/" className="text-xs text-rose-400 hover:text-rose-300">
                    Start your first session →
                  </Link>
                </div>
              ) : (
                <div className="flex h-48 items-end justify-between gap-3 px-2">
                  {chartData.map((d) => (
                    <div key={d.date} className="flex flex-1 flex-col items-center gap-3">
                      <div
                        className="w-full max-w-[24px] rounded-full bg-rose-400/80 transition-colors hover:bg-rose-400"
                        style={{
                          height: `${Math.max(8, (d.minutes / maxMinutes) * 100)}%`,
                        }}
                        title={`${d.minutes} mins`}
                      />
                      <span className="text-[10px] font-medium text-zinc-500">{d.day}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-medium text-zinc-400">Recent sessions</h2>
              {sessionCards.length === 0 ? (
                <p className="text-center text-sm text-zinc-500">
                  Complete a focus block to see insights.
                </p>
              ) : (
                sessionCards.map((s) => <SessionCard key={s.id} session={s} />)
              )}
            </div>
          </section>
        </PageTransition>
      </main>
    </div>
  );
}

function OverviewCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--card-border)] bg-[var(--card)] p-4 text-center shadow-lg backdrop-blur-xl transition-transform hover:-translate-y-0.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-100 sm:text-2xl">{value}</div>
      {sub && <p className="mt-0.5 text-[9px] text-zinc-500">{sub}</p>}
    </div>
  );
}
