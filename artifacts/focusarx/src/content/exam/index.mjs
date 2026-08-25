// ══════════════════════════════════════════════════════════════════
// FocusArx Exam Guide Library — cluster index
// ══════════════════════════════════════════════════════════════════
// Single source of truth for the /exam/* SEO cluster. Consumed by:
//   - the client (ExamGuidePage / ExamHubPage via @/content/exam/index.mjs)
//   - scripts/prerender-data.mjs (build-time static HTML for crawlers)
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
import { examAnxiety } from "./exam-anxiety.mjs";
import { lastMinuteRevision } from "./last-minute-revision.mjs";

import { EXAM_CORE_LINKS } from "./links.mjs";
export { EXAM_CORE_LINKS };
const _unused = [
  "/focus-guide|How to focus: the complete guide",
  "/pomodoro-guide|The Pomodoro technique, done right",
  "/study-techniques|Best study techniques, ranked by evidence",
  "/stop-procrastinating|How to stop procrastinating",
  "/study-calculator|Study time calculator",
];
void _unused;
export const EXAM_GUIDES = [
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
  examAnxiety,
  lastMinuteRevision,
];

export function findExamGuide(slug) {
  return EXAM_GUIDES.find((g) => g.slug === slug) || null;
}

export const EXAM_HUB = {
  slug: "exam",
  title: "Exam Prep Guides — JEE, NEET, UPSC, Boards & More | FocusArx",
  description:
    "Free, practical exam prep guides for JEE, NEET, UPSC, SSC, GATE, CAT, CBSE boards and NDA — study plans, focus routines, and last-minute revision strategies.",
  h1: "Exam prep, built around your focus",
  lead: "Every exam guide on this page is written for Indian students and follows one rule: a study plan only works if the focused hours actually happen. Each guide covers the exam format, a realistic preparation timeline, a daily focus routine, and the mistakes that quietly cost marks — plus a FAQ you can check in two minutes.",
  sections: [
    {
      h: "How these guides are different",
      p: "Most exam blogs tell you what to study. These guides tell you how to make studying happen: session length, break timing, recall-based revision, and the exact daily structure that turns a syllabus into marks. We link the science of attention (spaced repetition, active recall, the 25/5 rhythm) to each exam's real constraints — paper length, negative marking, section strategy.",
    },
    {
      h: "Pick your exam",
      p: "Engineering: JEE Main, JEE Advanced, GATE. Medical: NEET UG. Civil services and government: UPSC CSE, SSC CGL, NDA, IBPS PO/MT. Teaching: CTET. Schools: CBSE Class 10 and Class 12 boards. And two universal guides — beating exam anxiety and the last-minute revision protocol — that apply to every single exam on this list.",
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
      "They're maintained by the FocusArx team — a focus-science product team — and reviewed against the official exam patterns published by NTA, CBSE, IITs, UGC, SSC and IBPS. We update formats (questions, duration, marking) whenever authorities change them.",
    ],
    [
      "Can I use FocusArx with any of these exams?",
      "Yes. The timer works for 25-minute Pomodoro sprints, 90-minute deep blocks, and full 3-hour20 minute mock-paper simulations. Your focus score and streak track every session, so you can see whether your plan is actually being executed.",
    ],
  ],
  related: [],
};
