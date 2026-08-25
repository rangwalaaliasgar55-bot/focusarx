// GATE — exam guide (Workstream E, SEO cluster)
import { EXAM_CORE_LINKS } from "./links.mjs";

export const gate = {
  slug: "gate",
  title: "GATE Study Plan & Strategy (2027) | FocusArx",
  description:
    "GATE 2027 guide: exam pattern, normalised score explained, 6-month plan for working professionals, PYQ strategy, section timing, and the daily 2-hour routine that works with a job.",
  h1: "GATE: the working-professional's exam, planned like one",
  lead: "GATE is unique among Indian exams: most serious candidates are working engineers with 90-minute evenings, and the score is normalised across branches. This guide covers the pattern, how normalisation actually affects your study choices, a 6-month plan built around a job, the PYQ method, and the exam-day section strategy that protects your rank.",
  keywords: "gate study plan gate 2027 preparation gate strategy working professional pyq section strategy",
  exam: {
    name: "GATE",
    authority: "Rotational IIT/ISI (admissions + PSU recruitment)",
    mode: "CBT 3h — 65 questions, 100 marks, GA (15) + two subjects",
    frequency: "Once a year (usually February); score valid 3 years for admissions",
    tagline: "The exam that pays you to study — and punishes unnormalised effort",
  },
  sections: [
    {
      h: "The pattern, precisely",
      p: "GATE is 3 hours of 65 questions worth 100 marks: 15 marks of General Aptitude (verbal + quantitative) plus two subject papers, split into a 45-question Part A (one-paper format) — the current structure rolls your two subject papers into a single 3-hour CBT. Question types: 1-mark and 2-mark MCQs, 1-mark and 2-mark NATs (numerical answer type — no negative marking, which makes them the highest expected-value questions in the entire Indian exam calendar), and a small set of multiple-correct with full marks only for exact attempts and 1/4 negative on wrong single-correct. The scoring twist that changes strategy: GATE normalises across papers — your raw score is adjusted so that top performers in each branch are comparable (the 'top-10% rule' of normalisation). In plain terms: your target is not 70 marks, it's being in the top cohort of your branch — which means you should study to the branch's known high-yield clusters, not to an imagined average.",
    },
    {
      h: "What GATE is really testing",
      p: "Three layers: (1) the 15-mark GA — cheap, consistent, and where weak candidates give away 5+ marks; (2) the 'core 60%' — the 30–40 questions that repeat the same problem families year after year (every branch has its permanent high-yield chapters; in CSE it's GfK + Algorithms + DBMS + OS + COA + Networks; in EE it's Networks + Signals + Control + Machines; in ME it's SOM + Thermodynamics + Fluids + Manufacturing); (3) the 'differentiator 15%' — 5–8 questions designed to separate 700 from 900 ranks, usually one deep multi-concept problem per subject. GATE rewards breadth-with-depth: you don't need to be a 99-percentile expert in your branch, you need 85%+ on the core 60% and GA, and you must not panic on the differentiators. The exam is a distribution test, not a knowledge ceiling test — and distributions are predictable from PYQs.",
    },
    {
      h: "The 6-month plan (working-professional version)",
      p: "The plan assumes 2 focused hours on weekdays + 4–5 on weekends — about 900 hours total, which is sufficient for a serious first attempt. Months 1–2 — core syllabus rebuild: one chapter per 3–4 days, each chapter = concept pass + 50 PYQs (2015–2026) graded by difficulty, errors into a log. Months 3–4 — full PYQ sweep: every past paper's questions solved under time, chapter-by-chapter, with a 'year of last appearance' tag per question family (families that appear in 4+ of the last 10 years are mandatory; 2–3 years are high-yield; 0–1 years are last). Month 5 — mock season: 8–10 full 3-hour mocks (standard test-series + previous GATE papers), each analysed for 90 minutes; the NAT accuracy target is 80%+ (no negative marking — there is no strategic reason to miss them). Month 6 — final 30 days: formula + 1-page-per-subject sheets, 50-question mixed sets daily at exam pace, GA locked (13–15/15 target), mocks taper to one per week, sleep protected. The working-professional rules: the weekday block is fixed (6–8 AM beats the evening — the evening loses to fatigue and group chat), Sunday is a mock day, and a skipped weekday is made up by a Saturday half, never silently.",
    },
    {
      h: "The PYQ method (the entire GATE strategy in one paragraph)",
      p: "GATE's question bank is small and self-referential: the examiners' patterns repeat, and the 2015–2026 papers contain the majority of your exam's question families. The method: solve every PYQ twice — first pass under time (exam conditions), second pass as a 'family' (same concept, three variants, solved in 3 minutes). Build a one-page 'family map' per subject: each family, its last-appearance year, its difficulty trend, and your personal accuracy. Study the map, not the raw questions — the map tells you that your branch's Thermodynamics family 'open-system energy balance' has appeared in 8 of the last 10 years at 2 marks, which is worth more than any coaching lecture. Candidates who do the full two-pass PYQ sweep report the exam as 'recognizable' — that recognizability is the strategy working.",
    },
    {
      h: "Section strategy and the 3-hour budget",
      p: "The 3 hours, budgeted: 0–15 min read + GA decision (do GA last only if you're a fast finisher — most candidates do GA first, 15–20 minutes, and bank 13+); 15–105 min first pass (every 1-mark and every NAT you can solve in under 90 seconds, plus the confident 2-marks); 105–165 min second pass (the 2-mark MCQs that resisted, 3-minute cap, flag-and-move); 165–225 min NAT verification (recompute every NAT — a 2-mark NAT error is a 2% rank hit with no negative to offset it) + flagged returns; last 15 min answer-sheet check. The multiple-correct rule: attempt only with 2-confirmed-1-ruled-out; pure-guessing a multiple-correct under 1/4 negative is negative expected value. The NAT discipline is the working professional's edge: they're the only questions where 'not sure' still has zero penalty — 15 marks of pure upside.",
    },
    {
      h: "General Aptitude: the 15 marks everyone skips",
      p: "GA is the most consistent section in GATE and the most underprepared. The syllabus is small: verbal (sentence completion, critical reasoning, para-jumbles — 8–10 marks) and quantitative (percentages, ratios, work-time, speed-distance, data interpretation, basics of reasoning — 6–8 marks). The plan: 20 GA questions, 3 times a week, from PYQs only — 120 questions over 6 months, no extra material. The target is 13–15/15, and it's achievable with the volume most candidates skip because 'it's only 15 marks' — except at the 90th percentile, the 15 marks ARE the rank difference. The quantitative part doubles as exam-day warm-up: the first 10 minutes of GA are the easiest cognitive ramp into a 3-hour CBT, and candidates who skip GA start the paper cold.",
    },
    {
      h: "Mocks, analysis, and the error log",
      p: "8–10 full mocks in the final 8 weeks, always at the real exam time, always CBT if your centre will be CBT. The analysis protocol (90 minutes, same evening): column 1 — wrong, and the class (concept gap / calculation slip / misread / time trap); column 2 — correct but over 120 seconds (speed targets per family); column 3 — skipped that were solvable (the 'flag guilt' list — the most expensive column in GATE); column 4 — NAT errors (recomputed, cause logged). The weekly review reads the log as a map: the three families with the worst personal accuracy get a 45-minute focused set each. The log's final form is the last-10-days revision document — 30 pages of your own errors, worth more than any standard 'GATE in 30 days' book, because it's calibrated to you.",
    },
    {
      h: "Focus engineering for the 2-hour weekday block",
      p: "The working professional's entire GATE strategy lives in the 2-hour weekday block, so it deserves the full attention budget: 6–8 AM (before the commute — the evening is structurally lost to fatigue), phone in another room, one subject per block (alternating days: odd days subject 1, even days subject 2, GA on Wednesdays), and a 50+10+50 split with a real break (stand, water, no scroll). The block is tracked — a focus score per block, a weekly trend, and a focus DNA check: if your data shows the 6 AM block scoring 70% and the 'backup' 11 PM block scoring 40%, the data just told you where the marks live. The streak is the mechanism: 100 weekday blocks over 6 months is the whole plan, and the visible chain is what makes week 5's Tuesday happen. GATE toppers with jobs describe the same thing: 'I never studied more than my colleagues — I just never stopped.'",
    },
    {
      h: "Exam week and day protocol",
      p: "T−7 to exam: one-page sheets per subject, 50-question mixed sets at exam pace, sleep at 7 hours, and the kit (ID, the centre admits you'll need nothing else). Exam day: arrive 45 minutes early, a moderate tested breakfast, and the first 10 minutes = the full read-through with the family map active (the exam will feel familiar — that's the PYQ sweep showing up). Answer in the two-pass + NAT-verification order above; the 3-minute hard cap on any single question is the rule that protects your rank, because in a normalised score one stuck question costs you not just its 2 marks but the 3 marks behind it. If a question triggers the panic spiral: stand, 10 seconds, one fresh read of the stem only. You are not solving an Olympiad — you are maximizing marks-per-minute in a distribution you've already studied. That is the entire game, and it's a game with a known solution.",
    },
  ],
  faq: [
    [
      "How much time do I need for GATE if I'm working full-time?",
      "2 focused hours on weekdays + 4–5 on weekends, consistently for 6 months (~900 hours), is a serious first-attempt budget. The non-negotiables: a fixed weekday block (morning wins), one mock Sunday per week, and the full two-pass PYQ sweep.",
    ],
    [
      "How does GATE normalisation affect my strategy?",
      "Your raw score is adjusted against your branch's top cohort, so the target is percentile, not marks. Study the branch's known high-yield clusters (from PYQ frequency), maximise NAT accuracy (no negative marking), and bank GA — the percentile difference at the top is made of 2–3 marks, all of which are plan-able.",
    ],
    [
      "Are previous year questions enough for GATE?",
      "PYQs are the strategy's backbone but not the entire syllabus: use them to map question families and difficulty trends, then close any concept gaps with one standard book per subject. The two-pass PYQ method (timed, then as families) is worth more than any third-party question bank.",
    ],
    [
      "When should I take my first GATE mock?",
      "Around month 4–5, after the core syllabus pass, so the first mock measures you against the real distribution rather than demoralising you. Then 8–10 mocks in the final 8 weeks with 90-minute analyses each.",
    ],
    [
      "Is a 90+ percentile possible in a first attempt?",
      "Yes — the consistent profile is: 6 months of the 2-hour block, full two-pass PYQ sweep, 10+ analysed mocks, GA at 13+ out of 15, and NAT accuracy above 80%. None of it is talent; all of it is the log and the streak.",
    ],
  ],
  related: [
    "/exam/jee-advanced|JEE Advanced: the depth tier",
    "/exam/last-minute-revision|Last-minute revision protocol",
    "/exam/exam-anxiety|Beating exam anxiety",
    ...EXAM_CORE_LINKS,
  ],
};
