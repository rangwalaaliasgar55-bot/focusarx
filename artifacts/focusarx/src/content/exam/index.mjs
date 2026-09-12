// ══════════════════════════════════════════════════════════════════
// FocusArx Exam Guide Library — cluster index
// ══════════════════════════════════════════════════════════════════
// Single source of truth for the /exam/* SEO cluster, used by:
//   - scripts/prerender-data.mjs (build-time static HTML for crawlers)
//   - the contract tests (api-server seoContract + derive.test.mjs)
//
// The *client* pages do not import this module. Importing it pulls every guide
// body into one chunk (~88kb gzip for 23 guides), so src/pages/exam.tsx and
// src/pages/exam-funnel.tsx load guide bodies one slug at a time through
// src/lib/examGuideLoader.ts and take the shared names, order and hub copy from
// ./derive.mjs. Both paths compose guides through decorateExamGuide(), which is
// what keeps the prerendered HTML and the rendered page identical — asserted by
// derive.test.mjs rather than by hope.
//
// Keep titles <= ~60 chars, descriptions <= ~160 chars.

import { jeeMain } from "./jee-main.mjs";
import { jeeAdvanced } from "./jee-advanced.mjs";
import { neetUg } from "./neet-ug.mjs";
import { cbseClass12 } from "./cbse-class-12.mjs";
import { cbseClass10 } from "./cbse-class-10.mjs";
import { gate } from "./gate.mjs";
import { cat } from "./cat.mjs";
import { upscCse } from "./upsc-cse.mjs";
import { sscCgl } from "./ssc-cgl.mjs";
import { nda } from "./nda.mjs";
import { ctet } from "./ctet.mjs";
import { ibpsPo } from "./ibps-po.mjs";
// Workstream 7b: state, professional and international exams. Same template,
// same cluster — adding one here registers its guide page, its funnel page,
// its hub link and its prerender entry in one edit (plus derive.mjs + the api
// sitemap slug list, which the contract tests check against each other).
import { bitsat } from "./bitsat.mjs";
import { kcet } from "./kcet.mjs";
import { mhtCet } from "./mht-cet.mjs";
import { wbjee } from "./wbjee.mjs";
import { cuetUg } from "./cuet-ug.mjs";
import { clat } from "./clat.mjs";
import { caFoundation } from "./ca-foundation.mjs";
import { gre } from "./gre.mjs";
import { gmat } from "./gmat.mjs";
import { examAnxiety } from "./exam-anxiety.mjs";
import { lastMinuteRevision } from "./last-minute-revision.mjs";

import { EXAM_CORE_LINKS } from "./links.mjs";
import {
  EXAM_HUB,
  EXAM_NAMES,
  EXAM_SLUG_ORDER,
  decorateExamGuide,
  examDisplayName,
} from "./derive.mjs";

export { EXAM_CORE_LINKS, EXAM_HUB, EXAM_NAMES, EXAM_SLUG_ORDER, examDisplayName };

const _unused = [
  "/focus-guide|How to focus: the complete guide",
  "/pomodoro-guide|The Pomodoro technique, done right",
  "/study-techniques|Best study techniques, ranked by evidence",
  "/stop-procrastinating|How to stop procrastinating",
  "/study-calculator|Study time calculator",
];
void _unused;

const EXAM_GUIDE_SOURCES = [
  jeeMain,
  jeeAdvanced,
  neetUg,
  cbseClass12,
  cbseClass10,
  gate,
  cat,
  upscCse,
  sscCgl,
  nda,
  ctet,
  ibpsPo,
  bitsat,
  kcet,
  mhtCet,
  wbjee,
  cuetUg,
  clat,
  caFoundation,
  gre,
  gmat,
  examAnxiety,
  lastMinuteRevision,
];

/**
 * Every guide, decorated with its timer-page link and two sibling links.
 *
 * The decoration is imported from ./derive.mjs and applied to a single guide at
 * a time, so the client loader can reproduce this exact object from one
 * dynamically imported guide file — no second implementation to drift.
 */
export const EXAM_GUIDES = EXAM_GUIDE_SOURCES.map(decorateExamGuide);

export function findExamGuide(slug) {
  return EXAM_GUIDES.find((g) => g.slug === slug) || null;
}
