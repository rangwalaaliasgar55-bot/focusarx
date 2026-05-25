/** Completed sessions — works before and after `status` column migration */
export const completedFocusSessionWhere = {
  mode: "focus" as const,
  completedAt: { not: null },
};

export function completedFocusSessionWhereForUser(userId: string) {
  return {
    userId,
    ...completedFocusSessionWhere,
  };
}
