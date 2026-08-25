// CAT — exam guide (Workstream E, SEO cluster)
import { EXAM_CORE_LINKS } from "./links.mjs";

export const cat = {
  slug: "cat",
  title: "CAT Study Plan & Mock Strategy (2027) | FocusArx",
  description:
    "CAT 2027 guide: pattern with sectional adaptivity, percentile benchmarks, a 6-month plan for working professionals, the 40-mock protocol, and section-wise DILR/QA/VARC strategy.",
  h1: "CAT: the 2-hour exam that rewards a 6-month system",
  lead: "CAT is 2 hours long but 6 months deep: sectional adaptivity, a 66-question paper, and a percentile ladder where 99% is a different league than 95%. This guide covers the current pattern, what percentiles actually buy, a working-professional plan, the 40-mock protocol, and the section strategies that move you up the ladder.",
  keywords: "cat study plan cat 2027 cat mock strategy cat percentile dilr varc qa working professional cat preparation",
  exam: {
    name: "CAT (IIM Management Admission Test)",
    authority: "Rotating IIM (IIM-A/B/C + IIMs; 20+ IIMs accept the score)",
    mode: "CBT, 2h — VARC + DILR + QA, ~66 questions, sectional adaptivity (2 levels)",
    frequency: "Once a year (November); score valid 12–24 months (IIM-specific)",
    tagline: "2 hours of exam, 6 months of system — the percentile is the product",
  },
  sections: [
    {
      h: "The pattern, precisely",
      p: "CAT is a 2-hour CBT of three sections — VARC (Verbal Ability & Reading Comprehension), DILR (Data Interpretation & Logical Reasoning), and QA (Quantitative Ability) — totalling around 66 questions with 20 minutes per section (plus a short break between sections). Since the 2025 redesign the exam uses sectional adaptivity: you get a Level 1 set first, and your performance selects a Level 2 set (harder, worth more) or a second Level 1 for the next section; each section's score is normalised to the harder set's difficulty. Marking: correct answers carry section-specific weights (Level 2 worth more), and there's no negative marking on most question types in the current design — but the time is the only true negative. The strategic consequence of adaptivity: your first 8–10 questions in each section are not 'questions', they are a placement test — speed and accuracy there decide which version of the exam you actually sit.",
    },
    {
      h: "What percentiles actually buy",
      p: "The honest ladder: 99+ — all IIMs' A-list in reach, strong profile still matters for finals; 97–99 — IIMs with a good work-experience/academics profile, plus the new-gen B-schools' core list; 94–97 — new-gen B-schools (SPJIMR, IIM Indore/Tiruchirappalli/FoST etc.) and good private schools; 90–94 — the wider private B-school ladder. The percentile is computed per section-weighted total against the cohort — which is why a 99 in QA with a 70 in VARC caps your total, while balanced 90s compound into a 97+. The planning implication: the marginal mark at 99 is worth 10× the marginal mark at 85, so the plan must protect your ceiling section (usually DILR or QA) while dragging the floor section (usually VARC) above 85. Most failed CAT years are floor-section failures, not ceiling failures.",
    },
    {
      h: "The 6-month plan (working-professional version)",
      p: "The budget: 2 hours on weekday evenings + 5–6 on weekends ≈ 800 hours, which is the standard serious first-attempt budget. Months 1–2 — foundations: QA (arithmetic, algebra, geometry — the 70% core), DILR set-types (one family per week: teaming, scheduling, Venn, linear/linear arrangements, tables), VARC (RC daily + vocabulary in context, not lists). Months 3–4 — adaptivity training: sectional mocks (20 minutes, timed) 3× per week per section; DILR families completed (12–15 types); QA '100-problem sets' per topic. Month 5 — full-mock season: 25–30 full CAT mocks (the CAT is 80% mock game — the exam is the 25th mock, not the first), each analysed for 2 hours, with the 'first-10 placement' tracked as a metric. Month 6 — final 6 weeks: mocks taper to 3/week, error log only, section openers rehearsed (your fixed first 8 questions per section), sleep protected. The working-professional rules: the weekday block is protected like a client meeting (calendar it, 6:30–8:30 PM or the early-morning slot — pick one and never renegotiate), Saturday = 2 full mocks + analysis, Sunday = DILR family + VARC RC + rest.",
    },
    {
      h: "The 40-mock protocol (the core of CAT strategy)",
      p: "CAT is the one Indian exam where mocks ARE the syllabus — the question families, the time pressure, and the adaptivity response are all mock-shaped. The protocol: 35–45 full mocks over 5 months (test-series mocks + previous CAT papers where available), always at the real exam time, always CBT. Per mock, a 2-hour analysis with five fixed outputs: (1) section scores vs your trend (the trend line, not the score, is the metric — a 3-month trend tells you more than any single score); (2) the first-10 accuracy and time per section (your placement performance — if you're getting Level 1 in a section you target for Level 2, the opener strategy is broken); (3) DILR family log (which family, how many minutes, solved/abandoned — the family you've abandoned 3 times is the family you stop attempting); (4) QA error class (concept / calculation / time); (5) the 3-mark 'stupid list' (marks lost to reading errors, option slips — the list that's usually 8–12 marks per mock and the easiest to kill). The 40th mock feels like the 1st. That's the protocol working.",
    },
    {
      h: "Section strategy: VARC",
      p: "VARC's structure: 3–4 RC passages (the 15–18 mark engine) + vocabulary-in-context + sentence correction/para-jumbles. The RC method: read the passage ONCE, fully (3 minutes), then the questions — rereading passages is how 12 minutes vanish; answer in the passage's order; eliminate 2 options on every question before choosing (the '2-elimination rule' keeps accuracy above 80% even on hard sets). Vocabulary: 30 words a day IN CONTEXT (sentences from editorials, not A-Z lists) for 3 months — CAT tests usage, not definition. The opener: start with the shortest passage (time to read < 90 seconds) — the first 3 questions of VARC decide your Level 2 probability. Target: 85+ percentile with 75%+ RC accuracy; a 99 VARC is rare and not the game — a safe 88 VARC with a 99 DILR is the 99-total profile.",
    },
    {
      h: "Section strategy: DILR",
      p: "DILR is CAT's ceiling section and its most emotional one — 4–5 sets, and you will not solve all of them, and that's by design. The family map (12–15 types: teaming & grouping, scheduling/timetable, linear + circular arrangements, Venn diagrams, tables + calculations, games & tournaments, puzzles, floor problems) is trained one family per week in months 1–3 until each family has a 90-second 'can I solve this?' decision rule. The 20-minute budget: 8–10 minutes scanning all sets, choosing 2–3 to attempt by the 90-second rule, then 10 minutes of deep work on the chosen sets, 2 minutes of verification. The abandonment discipline is the skill: a set you abandon in 90 seconds costs 4 minutes; a set you 'try harder' on costs 15 and yields nothing. The 99-DILR profile is 2.5 sets solved at 85%+ accuracy, not 4 sets at 50%. The mock log tells you exactly which families your 90-second rule is failing on — train those, retire the rest.",
    },
    {
      h: "Section strategy: QA",
      p: "QA's 20 minutes hold ~22 questions; the 70% core is Arithmetic (percentages, ratios, averages, mixtures, time-work-distance), Algebra (quadratics, functions, inequalities, progressions), and Geometry (triangles, circles, coordinate) — together worth ~70% of marks. The method: 100-problem sets per topic in months 1–2 (speed built to the 60–90 second standard question), then PYQ-pattern drills. The opener: 2–3 guaranteed-fast questions (arithmetic one-liners) to secure the Level 2 placement, then the confident middle, and the 'flag and skip' discipline on anything past 90 seconds. Calculation hygiene is the hidden 5 marks: practice 2-minute mental shortcuts for percentages and ratios until they're reflex — a 10-second shortcut per question is 3–4 minutes per section, which is a question. Target: 90+ percentile with 70%+ accuracy on attempted; the 99-QA profile is 18/22 attempted at 85%+.",
    },
    {
      h: "The 2-hour architecture (exam day)",
      p: "The fixed architecture, rehearsed in all 40 mocks: VARC (0:00–0:20) — shortest passage first, 2-elimination rule, no rereading; break (3–4 min, water, stand, no phone, breathe); DILR (0:25–0:45) — 90-second set selection, 2–3 sets deep, abandon cleanly; QA (0:50–1:10) — fast openers first, 90-second cap, last 3 minutes = verification of the 5 most error-prone answers. Between sections, the 30-second reset (eyes closed, two slow breaths) — the section break is a performance tool, not a pause. The adaptivity feedback: if VARC placed you Level 2, DILR's Level 2 is already loaded — the sections are independent, so a bad VARC never ruins DILR, and the exam is won by the candidate who treats each 20 minutes as a fresh 20. Last 5 minutes of the paper: review the flagged answers, trust the first instinct on the unsure ones (the data on CAT is that the first-choice accuracy on flagged questions is ~75% — changing answers usually loses).",
    },
    {
      h: "The working professional's focus system",
      p: "The 2-hour evening block is the entire plan, so it's engineered like one: fixed slot (calendar, non-negotiable, 6:30–8:30 PM or the 6 AM variant — the evening slot loses to dinner + family + fatigue, the morning slot wins on consistency), phone in another room, one section per block (Mon/Wed/Fri QA, Tue/Thu DILR, VARC folded into the weekend), and a 50+10+50 split. Track it: a focus score per block, the weekly trend, and the streak as the visible chain — the week-16 Tuesday is won by the chain, not the motivation. The weekend architecture: Saturday morning 2 full mocks back-to-back (real exam days are two mocks with a 2-hour gap in your life — train it), afternoon 2 hours of analysis; Sunday DILR family + RC + full rest in the evening. The 40 mocks, 800 hours, and the log are the system; the percentile is what the system prints. CAT toppers with 4-year work experience describe the same boring truth: they didn't study harder than the freshers — they studied more consistently, and the mocks made the difference visible, week by week.",
    },
  ],
  faq: [
    [
      "What is a good CAT score for the IIMs?",
      "99+ percentile puts all IIMs in reach (profile still matters); 97–99 with strong work experience reaches the IIM core; 94–97 is the new-gen B-school band. Because sections are weighted, a balanced 90+ in all three beats a 99 in one and 70 in the others.",
    ],
    [
      "How many CAT mocks should I take?",
      "35–45 full mocks over 5 months, each analysed for 2 hours with fixed outputs (trend, first-10 placement, DILR family log, QA error class, stupid list). CAT is 80% mock game — the exam is your 25th mock, not your first.",
    ],
    [
      "Can I crack CAT as a working professional?",
      "Yes — the standard budget is 2 focused hours on weekdays + 5–6 on weekends for 6 months (~800 hours). The non-negotiables: a fixed protected block, 2 back-to-back mocks every Saturday, and the DILR family map trained early.",
    ],
    [
      "How does sectional adaptivity change my strategy?",
      "Your first 8–10 questions per section are a placement test — speed and accuracy there select the harder (more valuable) set. Open every section with your fastest, most certain question types; the adaptivity reward is a structural 10–15% score boost you can plan for.",
    ],
    [
      "Is a 99+ percentile possible in a first attempt?",
      "Yes — the consistent profile: 6 months of 800 hours, 40+ analysed mocks, DILR trained to the 90-second rule, VARC at 75%+ RC accuracy, and QA's 70% core at speed. It's a system outcome, not a talent outcome.",
    ],
  ],
  related: [
    "/exam/gate|GATE: the working-professional's exam",
    "/exam/last-minute-revision|Last-minute revision protocol",
    "/exam/exam-anxiety|Beating exam anxiety",
    ...EXAM_CORE_LINKS,
  ],
};
