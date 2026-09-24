/**
 * The premium weekly challenge.
 *
 * Premium's problem is not that it lacks features — it is that every feature it
 * has looks the same on the fiftieth day as on the first. A static perk list
 * cannot compete with a student's own novelty-seeking: the reason to open the
 * app tomorrow has to be *different* tomorrow.
 *
 * So premium gets a contract that changes every week: one target, chosen
 * deterministically from the ISO week (no cron, no scheduler, every serverless
 * instance agrees), with a token payout big enough to matter and small enough
 * that missing it is not a punishment. Determinism also means the challenge a
 * student sees on Monday is the one they are paid for on Sunday if the API is
 * redeployed mid-week.
 *
 * Pure functions only, so the rotation and the progress arithmetic are testable
 * without a database.
 */

export type ChallengeMetric = "minutes" | "sessions" | "days" | "quality" | "tasks";

export interface PremiumChallengeDef {
  id: string;
  title: string;
  description: string;
  metric: ChallengeMetric;
  /** What the metric must reach this week. */
  target: number;
  tokenReward: number;
  coinReward: number;
  xpReward: number;
}

export interface ChallengeStats {
  /** Focused minutes this week. */
  minutes: number;
  /** Completed focus sessions this week. */
  sessions: number;
  /** Distinct days with at least one session this week. */
  days: number;
  /** Sessions this week with a focus score of 80 or more. */
  quality: number;
  /** Tasks completed this week. */
  tasks: number;
}

/**
 * The pool. Targets are set so a normal week clears most of them: a challenge
 * that is out of reach is a weekly reminder that premium was a mistake.
 */
export const PREMIUM_CHALLENGES: PremiumChallengeDef[] = [
  { id: "deep-five", title: "Five deep blocks", description: "Complete 5 focus sessions this week.", metric: "sessions", target: 5, tokenReward: 250, coinReward: 500, xpReward: 800 },
  { id: "ten-hours", title: "Ten focused hours", description: "Accumulate 10 hours of focus this week.", metric: "minutes", target: 600, tokenReward: 400, coinReward: 900, xpReward: 1500 },
  { id: "five-days", title: "Five days on", description: "Focus on 5 different days this week.", metric: "days", target: 5, tokenReward: 300, coinReward: 600, xpReward: 1000 },
  { id: "clean-eight", title: "Eight clean sessions", description: "Finish 8 sessions with a focus score of 80 or better.", metric: "quality", target: 8, tokenReward: 350, coinReward: 700, xpReward: 1200 },
  { id: "sprint", title: "The sprint", description: "Complete 12 focus sessions this week.", metric: "sessions", target: 12, tokenReward: 450, coinReward: 1000, xpReward: 1800 },
  { id: "long-haul", title: "The long haul", description: "Accumulate 15 hours of focus this week.", metric: "minutes", target: 900, tokenReward: 500, coinReward: 1200, xpReward: 2200 },
  { id: "closer", title: "Close the loop", description: "Complete 10 tasks this week.", metric: "tasks", target: 10, tokenReward: 250, coinReward: 600, xpReward: 900 },
  { id: "steady-six", title: "Six days on", description: "Focus on 6 different days this week.", metric: "days", target: 6, tokenReward: 350, coinReward: 800, xpReward: 1300 },
  { id: "marathon", title: "One long block", description: "Accumulate 20 hours of focus this week.", metric: "minutes", target: 1200, tokenReward: 600, coinReward: 1500, xpReward: 2500 },
  { id: "quality-streak", title: "Quality streak", description: "Finish 12 sessions with a focus score of 80 or better.", metric: "quality", target: 12, tokenReward: 450, coinReward: 1100, xpReward: 1900 },
];

/**
 * ISO-week key (`2026-W39`) — the string the challenge and the payout are keyed
 * on, so a claim can never be paid twice for the same week.
 */
export function isoWeekKey(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Monday 00:00 UTC of the week `weekKey` names, for the countdown. */
export function weekWindow(now: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  const start = new Date(d.getTime() - (day - 1) * 86_400_000);
  return { start, end: new Date(start.getTime() + 7 * 86_400_000) };
}

/** Small deterministic hash — FNV-1a, good enough for picking one of ten. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** This week's challenge. The same week always yields the same challenge. */
export function premiumChallengeForWeek(weekKey: string): PremiumChallengeDef {
  const index = hash(weekKey) % PREMIUM_CHALLENGES.length;
  return PREMIUM_CHALLENGES[index]!;
}

export interface ChallengeProgress {
  challenge: PremiumChallengeDef;
  weekKey: string;
  current: number;
  target: number;
  percent: number;
  complete: boolean;
}

/** Progress for a challenge against a week's stats. Total for every input. */
export function challengeProgress(challenge: PremiumChallengeDef, stats: ChallengeStats, weekKey: string): ChallengeProgress {
  const raw = Number.isFinite(stats?.[challenge.metric]) ? stats[challenge.metric] : 0;
  const current = Math.max(0, Math.floor(raw));
  const target = Math.max(1, Math.floor(challenge.target));
  const percent = Math.min(100, Math.round((current / target) * 100));
  return { challenge, weekKey, current, target, percent, complete: current >= target };
}

/**
 * Idempotency key for this week's payout. One claim per user per week, whatever
 * happens to the clock: the week key is in the ledger row.
 */
export function premiumChallengeClaimKey(userId: string, weekKey: string): string {
  return `premium_challenge_${weekKey}_${userId}`;
}
