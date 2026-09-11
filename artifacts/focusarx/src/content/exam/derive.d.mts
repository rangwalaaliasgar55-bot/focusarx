// Type declarations for the lightweight derived exam-cluster data (./derive.mjs).
// The full guide shape lives in ./index.d.mts; this module never imports guide
// bodies, which is the whole point of splitting it out.

import type { ExamGuide, ExamHub } from "./index.mjs";

export const EXAM_SLUG_ORDER: string[];
export const EXAM_NAMES: Record<string, string>;
export function examDisplayName(slug: string): string;
/** Short label used by /pomodoro-timer-for/:exam titles ("CAT", "NDA & NA"). */
export function funnelLabel(slug: string): string;
/** Link label for /exam/:slug — "CAT study plan", "Beat exam anxiety". */
export function examPlanLabel(slug: string): string;
export function funnelTitle(slug: string): string;
export function funnelHeading(slug: string): string;
export function funnelDescription(slug: string): string;
export function withTimerPageLink(guide: ExamGuide): ExamGuide;
export function withSiblingLinks(guide: ExamGuide): ExamGuide;
export function decorateExamGuide(guide: ExamGuide): ExamGuide;
export const EXAM_HUB: ExamHub;
