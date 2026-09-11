// ══════════════════════════════════════════════════════════════════
// Exam cluster — lightweight derived data (no guide bodies)
// ══════════════════════════════════════════════════════════════════
// The exam guide *bodies* (sections + FAQ, ~15kb of prose each) live one file
// per exam in ./<slug>.mjs. The client pages load exactly the body they are
// rendering, one chunk per slug, instead of pulling all 23 guides into a
// single route chunk — a visitor to /exam/gre should not download the CTET
// guide.
//
// That leaves a real problem: several rendered links need *another* exam's
// display name (sibling links, the hub grid, the funnel breadcrumb). Importing
// the bodies to get a name is what caused the bloat in the first place, so the
// names live here as a tiny slug → name map, and `derive.test.mjs` asserts the
// map equals `exam?.name ?? h1` for every guide. Drift is a failing test, not
// a silent divergence between the prerendered HTML and the rendered page.
//
// Consumed by:
//   - ./index.mjs  (composes full guides for the prerenderer + tests)
//   - src/lib/examGuideLoader.ts (client: hub grid, sibling links)
//   - src/pages/exam.tsx, src/pages/exam-funnel.tsx (via the loader)

import { FUNNEL_ANGLES } from "../exam-funnel.mjs";

/**
 * Guide order. This is the order the hub lists exams and the order the
 * sibling-link rotation is computed from, so it must match
 * EXAM_GUIDE_SOURCES in ./index.mjs — asserted by derive.test.mjs.
 */
export const EXAM_SLUG_ORDER = [
  "jee-main",
  "jee-advanced",
  "neet-ug",
  "cbse-class-12",
  "cbse-class-10",
  "gate",
  "cat",
  "upsc-cse",
  "ssc-cgl",
  "nda",
  "ctet",
  "ibps-po",
  "bitsat",
  "kcet",
  "mht-cet",
  "wbjee",
  "cuet-ug",
  "clat",
  "ca-foundation",
  "gre",
  "gmat",
  "exam-anxiety",
  "last-minute-revision",
];

/**
 * Display name per slug — exactly `guide.exam?.name ?? guide.h1` for each
 * guide, including the two universal guides whose name is their headline.
 * Enforced by derive.test.mjs.
 */
export const EXAM_NAMES = {
  "jee-main": "JEE Main",
  "jee-advanced": "JEE Advanced",
  "neet-ug": "NEET UG",
  "cbse-class-12": "CBSE Class 12 Board Exams",
  "cbse-class-10": "CBSE Class 10 Board Exams",
  gate: "GATE",
  cat: "CAT (IIM Management Admission Test)",
  "upsc-cse": "UPSC Civil Services Examination",
  "ssc-cgl": "SSC CGL (Combined Graduate Level)",
  nda: "NDA & NA (National Defence Academy / Naval Academy)",
  ctet: "CTET (Central Teacher Eligibility Test)",
  "ibps-po": "IBPS PO/MT (Probationary Officer)",
  bitsat: "BITSAT",
  kcet: "KCET",
  "mht-cet": "MHT-CET",
  wbjee: "WBJEE",
  "cuet-ug": "CUET (UG)",
  clat: "CLAT",
  "ca-foundation": "CA Foundation",
  gre: "GRE General Test",
  gmat: "GMAT Focus Edition",
  "exam-anxiety": "Exam anxiety: what it is, and the 12 techniques that work",
  "last-minute-revision": "The last-minute revision protocol (72h / 48h / 24h)",
};

/** Display name for a slug, falling back to the slug itself. */
export function examDisplayName(slug) {
  return EXAM_NAMES[slug] ?? slug;
}

/**
 * The two universal guides have no exam factbox, so their display name is a
 * full headline ("Exam anxiety: what it is, and the 12 techniques that work").
 * That reads fine as "X study plan" and badly as "Pomodoro timer for X", which
 * is what FUNNEL_LABELS below gives them instead.
 */

/**
 * Short label for the funnel pages at /pomodoro-timer-for/:exam.
 *
 * `examDisplayName` is written for a guide body, where "NDA & NA (National
 * Defence Academy / Naval Academy)" is genuinely useful. In a 49-character
 * title it is fatal: the composed title got clamped and shipped reading
 * "Pomodoro timer for NDA & NA (National Defence" — a title cut mid-word is
 * worse than a plain one, both for click-through and for trust.
 *
 * So the funnel label drops parentheticals, and the handful of names that are
 * still too long get an explicit short form. Every result is asserted to fit
 * the title budget in examGuideLoader.test.ts, so a new exam cannot reintroduce
 * the truncation by arriving with a long name.
 */
const FUNNEL_LABELS = {
  "exam-anxiety": "exam anxiety",
  "last-minute-revision": "last-minute revision",
  "upsc-cse": "UPSC CSE",
  "cuet-ug": "CUET UG",
  "cbse-class-12": "CBSE Class 12",
  "cbse-class-10": "CBSE Class 10",
};

/** "CAT (IIM Management Admission Test)" → "CAT". */
export function funnelLabel(slug) {
  if (FUNNEL_LABELS[slug]) return FUNNEL_LABELS[slug];
  return examDisplayName(slug)
    .replace(/\s*\([^)]*\)/g, "")
    .trim();
}

/**
 * Label for a link to /exam/:slug — "CAT study plan", not
 * "CAT (IIM Management Admission Test) study plan".
 *
 * The hub used to build these from the full display name, which produced link
 * text like "The last-minute revision protocol (72h / 48h / 24h) study plan" —
 * a phrase nobody would write, wrapping to three lines in a link grid.
 */
const PLAN_LABELS = {
  "exam-anxiety": "Beat exam anxiety",
  "last-minute-revision": "Last-minute revision protocol",
};

export function examPlanLabel(slug) {
  if (PLAN_LABELS[slug]) return PLAN_LABELS[slug];
  return `${funnelLabel(slug)} study plan`;
}

/** <title> for the funnel page — fits the budget without clamping. */
export function funnelTitle(slug) {
  return `Pomodoro timer for ${funnelLabel(slug)} (2026)`;
}

/** H1 and last breadcrumb crumb for the funnel page. */
export function funnelHeading(slug) {
  return `Pomodoro timer for ${funnelLabel(slug)}`;
}

/**
 * Meta description for the funnel page: the promise, then the exam's own angle,
 * then the friction remover. Built from the first sentence of the angle so the
 * result fits 160 characters by construction — a description clamped mid-list
 * ("…formula sheets, error.") reads as a broken page in the SERP.
 */
export function funnelDescription(slug) {
  const funnel = FUNNEL_ANGLES[slug] ?? {};
  const promise = `Free Pomodoro timer for ${funnelLabel(slug)}.`;
  const closer = "No account needed to start.";

  // The angle's first sentence is the specific thing worth putting in a SERP
  // snippet — but only when it survives intact. Seven of them do not, and
  // clamping one produces "…where every question is worth.", which reads like a
  // broken page. Those get a hand-written `pitch` in exam-funnel.mjs instead.
  const body =
    funnel.pitch ??
    String(funnel.angle ?? "")
      .split(/(?<=\.)\s/)
      .map((part) => part.trim())
      .filter(Boolean)[0] ??
    "";

  return [promise, body, closer].filter(Boolean).join(" ");
}

/**
 * Link a guide to its own dedicated timer page, when it has one.
 *
 * `/pomodoro-timer-for/<exam>` used to be reachable only by typing the URL, so
 * all of them were orphans. Doing it here (derived from FUNNEL_ANGLES) keeps
 * the client page and the prerendered HTML in step.
 */
export function withTimerPageLink(guide) {
  if (!FUNNEL_ANGLES[guide.slug]) return guide;
  const link = `/pomodoro-timer-for/${guide.slug}|${funnelHeading(guide.slug)}`;
  const related = guide.related || [];
  if (related.some((pair) => String(pair).startsWith(`/pomodoro-timer-for/${guide.slug}|`))) {
    return guide;
  }
  return { ...guide, related: [...related, link] };
}

/**
 * Rotate two sibling exam guides into a guide's related list, deterministically
 * by position, so exams nobody hand-picked still get inbound links.
 */
export function withSiblingLinks(guide) {
  const index = EXAM_SLUG_ORDER.indexOf(guide.slug);
  if (index < 0) return guide;
  const siblings = EXAM_SLUG_ORDER.filter((slug) => slug !== guide.slug);
  if (siblings.length === 0) return guide;
  const picks = [siblings[index % siblings.length], siblings[(index + 5) % siblings.length]];
  const existing = new Set((guide.related || []).map((pair) => String(pair).split("|")[0]));
  const added = picks
    .filter(Boolean)
    .map((slug) => `/exam/${slug}|${examDisplayName(slug)} study plan`)
    .filter((pair) => {
      const href = pair.split("|")[0];
      if (existing.has(href)) return false;
      existing.add(href);
      return true;
    });
  if (added.length === 0) return guide;
  return { ...guide, related: [...(guide.related || []), ...added] };
}

/** Both derivations, in the order the prerenderer has always applied them. */
export function decorateExamGuide(guide) {
  return withSiblingLinks(withTimerPageLink(guide));
}

/**
 * The /exam hub page copy. Its `related` list is derived from the slug order
 * and the funnel map, so adding a guide in one place updates the hub, the
 * sitemap-facing manifest and the internal links together.
 */
export const EXAM_HUB = {
  slug: "exam",
  title: "23 exam prep guides: JEE, NEET, UPSC (2026)",
  description:
    "Free exam prep guides for JEE, NEET, UPSC, GATE, CAT, BITSAT, KCET, MHT-CET, WBJEE, CUET, CLAT, CA Foundation, GRE, GMAT and CBSE boards — 23 study plans.",
  h1: "Exam prep, built around your focus",
  lead: "Every exam guide on this page is written for Indian students and follows one rule: a study plan only works if the focused hours actually happen. Each guide covers the exam format, a realistic preparation timeline, a daily focus routine, and the mistakes that quietly cost marks — plus a FAQ you can check in two minutes.",
  sections: [
    {
      h: "How these guides are different",
      p: "Most exam blogs tell you what to study. These guides tell you how to make studying happen: session length, break timing, recall-based revision, and the exact daily structure that turns a syllabus into marks. We link the science of attention (spaced repetition, active recall, the 25/5 rhythm) to each exam's real constraints — paper length, negative marking, section strategy.",
    },
    {
      h: "Pick your exam",
      p: "Engineering: JEE Main, JEE Advanced, GATE, BITSAT, and the state papers KCET, MHT-CET and WBJEE. Medical: NEET UG. Civil services and government: UPSC CSE, SSC CGL, NDA, IBPS PO/MT. Teaching: CTET. Law: CLAT. Commerce and professional: CA Foundation, CAT, CUET (UG). Schools: CBSE Class 10 and Class 12 boards. Studying abroad: GRE and GMAT. And two universal guides — beating exam anxiety and the last-minute revision protocol — that apply to every single exam on this list.",
    },
    {
      h: "One system, every exam",
      p: "Underneath the exam-specific detail, every guide uses the same engine: 50–90 minute deep-work blocks on the hardest subject first, active recall instead of rereading, daily 10-minute end-of-day review, and one full-length mock per week timed exactly like the real paper. FocusArx's free timer, focus DNA, and study rooms exist to make that engine run on an ordinary, distracted day.",
    },
  ],
  faq: [
    [
      "Are these guides really free?",
      "Yes. Every exam guide here is free, with no sign-up wall. FocusArx is free forever for the core timer and tools; the guides are ours to give away.",
    ],
    [
      "Which guide should I start with?",
      "Start with the page for your exact exam. If you're within two weeks of the exam, read 'Last-Minute Revision Protocol' first — it applies to every paper, whatever the subject.",
    ],
    [
      "Who writes these guides?",
      "They're maintained by the FocusArx team — a focus-science product team — and reviewed against the official exam patterns published by NTA, CBSE, IITs, UGC, SSC, IBPS, ICAI, ETS and GMAC. We update formats (questions, duration, marking) whenever authorities change them.",
    ],
    [
      "Can I use FocusArx with any of these exams?",
      "Yes. The timer works for 25-minute Pomodoro sprints, 90-minute deep blocks, and full 3-hour20 minute mock-paper simulations. Your focus score and streak track every session, so you can see whether your plan is actually being executed.",
    ],
  ],
  related: EXAM_SLUG_ORDER.flatMap((slug) => [
    `/exam/${slug}|${examPlanLabel(slug)}`,
    ...(FUNNEL_ANGLES[slug] ? [`/pomodoro-timer-for/${slug}|${funnelHeading(slug)}`] : []),
  ]),
};
