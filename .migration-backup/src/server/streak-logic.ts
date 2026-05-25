const dayKeyUtc = (d: Date) => d.toISOString().slice(0, 10);

type StreakFields = {
  currentStreak: number;
  longestStreak: number;
  totalStudyDays: number;
  lastStudyDate: Date | null;
};

export type StreakUpdate = StreakFields;

/** Increment streak when a focus session completes (once per UTC calendar day). */
export function applyFocusStreak(
  prev: StreakFields,
  now = new Date()
): StreakUpdate {
  const today = dayKeyUtc(now);
  const last = prev.lastStudyDate ? dayKeyUtc(prev.lastStudyDate) : null;

  if (last === today) {
    return {
      currentStreak: prev.currentStreak,
      longestStreak: prev.longestStreak,
      totalStudyDays: prev.totalStudyDays,
      lastStudyDate: prev.lastStudyDate ?? now,
    };
  }

  if (!last) {
    const current = 1;
    return {
      currentStreak: current,
      longestStreak: Math.max(prev.longestStreak, current),
      totalStudyDays: prev.totalStudyDays + 1,
      lastStudyDate: now,
    };
  }

  const y = new Date(now);
  y.setUTCDate(y.getUTCDate() - 1);
  const yesterday = dayKeyUtc(y);

  if (last === yesterday) {
    const current = prev.currentStreak + 1;
    return {
      currentStreak: current,
      longestStreak: Math.max(prev.longestStreak, current),
      totalStudyDays: prev.totalStudyDays + 1,
      lastStudyDate: now,
    };
  }

  const current = 1;
  return {
    currentStreak: current,
    longestStreak: Math.max(prev.longestStreak, current),
    totalStudyDays: prev.totalStudyDays + 1,
    lastStudyDate: now,
  };
}
