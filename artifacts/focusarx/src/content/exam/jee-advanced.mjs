// JEE Advanced — exam guide (Workstream E, SEO cluster)
import { EXAM_CORE_LINKS } from "./links.mjs";

export const jeeAdvanced = {
  slug: "jee-advanced",
  title: "JEE Advanced Study Plan & Strategy (2027) | FocusArx",
  description:
    "JEE Advanced 2027 guide: paper pattern, how it differs from JEE Main, a 12-week post-Main plan, problem strategy, mock discipline, and exam-day tactics for the 2 papers.",
  h1: "JEE Advanced: how the top 1% actually prepare",
  lead: "JEE Advanced is a different animal from JEE Main — fewer, deeper, stranger questions, and negative marking that bites harder. This guide covers the pattern, the mental shift required, a 12-week plan after JEE Main, and the problem-solving discipline that separates the top 1000 from the top 10000.",
  keywords: "jee advanced preparation jee advanced study plan jee advanced strategy jee advanced 2027 tips mocks",
  exam: {
    name: "JEE Advanced",
    "authority": "Rotating IIT (one IIT conducts, all IITs accept)",
    mode: "2 papers × 3h, ~60–70 questions incl. NTA, integer & matrix-match, −1/3 negative",
    frequency: "Once a year (May), top ~2.5 lakh from JEE Main",
    tagline: "Where IIT branches are decided — depth over speed",
  },
  sections: [
    {
      h: "The pattern, precisely",
      p: "JEE Advanced is two papers, each 3 hours long, held a week apart. The combined format mixes multiple-correct (with full marks only for completely correct attempts), integer numerical answers (no negative marking — a deliberate scoring gift), matrix-match, paragraph/caselet, and single-correct MCQs. Negative marking is 1/3 for wrong MCQs, which is gentler than JEE Main's 1/4 but still decisive at the top. The total question load per paper is lower than JEE Main, but the average question demands 3–4 times the thinking. The official result is a composite: JEE Advanced (75%) + best JEE Main (25%), so a strong Main score is an insurance policy you already paid for — don't ignore the weightage.",
    },
    {
      h: "The mental shift from Main to Advanced",
      p: "JEE Main rewards pattern recognition; JEE Advanced rewards comfortable uncertainty. In Main, you recognize a question type and execute. In Advanced, you get a question you've never seen and must decompose it into pieces you do know — and do that in under 4 minutes. The training change is therefore in your problem diet: fewer standard repetitions, more 'stranger' problems (older IIT JEE papers, good international-style problems, JEE Advanced PYQs 2013–2026). When you work a stranger problem, the rule is 15 minutes of honest struggle before touching the solution, and a written 'how did I get unstuck' note. That note is the actual learning event. Students who only practice recognition-level problems plateau at a 95+ Main percentile and stall at the Advanced gate — not for lack of syllabus, but for lack of struggle exposure.",
    },
    {
      h: "The 12-week plan after JEE Main",
      p: "Weeks 1–2 — autopsy: take your Main errors and rebuild the three weakest pillars (for most students: Calculus + Mechanics + Organic mechanisms). Weeks 3–6 — Advanced diet: two 'stranger sets' per subject per week (15–20 problems each, mixed difficulty, including 2–3 genuinely hard problems per set), every problem followed by the unstuck-note habit. Weeks 7–10 — PYQ deep runs: 2013–2026 Advanced papers, one per two days, at full 3 hours, with a 90-minute analysis the next morning; begin a 'question-tag' system (mechanics-rotation, calculus-approximation, organic-reaction-type) so your error log becomes a map. Weeks 11–12 — exam shape: two mocks per week (previous Advanced papers double as the best mocks in existence), formula sheet pruned to one page per subject, sleep locked. The arc is: repair → deepen → map → simulate. Skipping the repair phase is the most common top-decile mistake — Main gaps surface in Advanced as time loss.",
    },
    {
      h: "Problem strategy under −1/3",
      p: "With 1/3 negative marking and a 3-hour paper, your optimal attempt discipline is: never guess single-correct MCQs with zero elimination (expected value is negative), always attempt integer questions you're 70%+ sure of (no negative + guaranteed partial certainty), and in multiple-correct, attempt only when you can lock at least two and rule out at least one — the '2-in-1-out' rule. Time allocation per paper: roughly 90 seconds per 'easy-recognize' question, 4 minutes per medium, 6–7 for a hard you intend to solve, and a hard-cap: if a question hasn't yielded a first line after 3 minutes, flag it and move — the flag system exists, and the top 100 use it more than the top 10000. The last 15 minutes are for flags and integer verification, never for new questions.",
    },
    {
      h: "The two-paper strategy",
      p: "Paper 1 and Paper 2 are not equally important to you — they are equally important to everyone, and both feed the same rank list. Plan both papers like a single 6-hour event with a week of recovery between. The realistic schedule: finish Paper 1 by 3 PM, decompress hard for 48 hours (no problems, no solutions — you've earned it), then enter Paper 2 week with the mock cadence restored. Between the papers, do a 60-minute 'what Paper 1 taught me' review of your own error log only — not new syllabus. Students who cram in the gap week arrive at Paper 2 fatigued and their second-paper scores tell the story.",
    },
    {
      h: "Subject notes for the depth tier",
      p: "Mathematics: Calculus is the spine — expect a problem that connects an integral, a limit, and an application; practice 'chain' problems, not isolated ones. Vectors 3D and Conics remain high-yield. Coordinate geometry + trigonometry identity fluency are free marks. Physics: Mechanics (especially rolling, COM, SHM coupled with calculus) and Electromagnetism (circuits with capacitors/dielectrics, magnetism conceptual) carry the most depth. Modern physics stays the easiest 15–20. Chemistry: Organic mechanisms at the 'why' level (not just arrow-pushing), GOC as the master key, and Physical Chemistry numericals that hide a unit trap. The common thread: Advanced asks 'explain the step after the step' — practice writing the reasoning, not just the answer.",
    },
    {
      h: "Coaching vs self-study (the honest split)",
      p: "The top-1000 profile on this question is mixed, and the honest split is this: what coaching genuinely adds is the stranger-problem pipeline (the curated hard sets the self-studier can't assemble as well), the analysis feedback on your solutions (the 'why your method was 4 minutes slower' note), and the structure of the 12 weeks (the plan above, enforced). What it does not add is the unstuck-note habit, the error log, the sleep, or the 20–30 analysed mocks — those are yours to run either way, and the candidates who fail inside good coaching are the ones who consumed the pipeline and skipped the log. The self-study version works if you have the 2013–2026 paper bank, one strong problem source per subject, a weekly peer to exchange solutions with, and the discipline to run the 12-week plan without a monitor. The decision rule: take coaching for the pipeline and feedback you can't self-assemble, and non-negotiate the log, the mocks, and the sleep — they're the same in both paths, and they're where the rank is actually made.",
    },
    {
      h: "Focus discipline for long, hard sets",
      p: "Advanced training is attention-heavy in a different way: a single problem can demand 15 minutes of sustained concentration, and that kind of depth is impossible on a frayed attention. The rhythm that works: 45-minute 'depth blocks' (one or two hard problems, full notes, no interruptions) alternating with 25-minute 'speed blocks' (timed standard sets). Depth blocks go in your peak window — check your focus DNA; for most JEE toppers it's the morning. Keep a 'struggle log' alongside the error log: date, problem, minutes-to-unstuck, and the trigger that unlocked it. After 12 weeks the log shows your personal difficulty frontier moving outward — that movement is the whole game, and it is visible, which is exactly why you should track it instead of guessing.",
    },
    {
      h: "Exam day: the 3-hour protocol",
      p: "First 10 minutes: full scan, no solving — tag every question as fast/medium/flag. Then the first pass: every fast and medium in order, 90–120 seconds each, integer questions with partial certainty get attempted. Second pass: the mediums that resisted, 3–4 minutes each, 3-minute hard cap with flagging. Third pass (last 25 minutes): flags and verification — recompute integer answers, check MCQ elimination logic. Never open a new hard question in the last 20 minutes; its expected value under time pressure is negative even without negative marking. Hydrate at the allowed breaks, breathe (two slow inhale-exhale cycles) before any flagged return, and if a question triggers a panic spiral, the protocol is: stand, 10 seconds, water, sit, one fresh read of the question stem only. Panic is a state, not a verdict.",
    },
    {
      h: "What the data says about the top ranks",
      p: "Interviews and published patterns from top-1000 students share a boring, consistent profile: they started struggling with hard problems a full year early; they did 20–30 analysed Advanced-paper mocks, not 5; their error log outlived their courses; they protected 7–7.5 hours of sleep through both exam weeks; and they treated the week between papers as recovery, not a final cram. None of these are secrets, and none are comfortable — that is precisely why most candidates skip them and why the ones who don't compound the advantage into a 5-figure rank. The top of JEE Advanced is not a talent league; it is a discipline league with a talent entry fee, and the discipline is learnable, week by week, with a timer and a logbook.",
    },
  ],
  faq: [
    [
      "Is JEE Advanced harder than JEE Main?",
      "Yes — in depth, not in syllabus. The syllabus overlaps heavily, but Advanced questions demand multi-concept decomposition, longer reasoning chains, and unusual twists. A 99+ JEE Main percentile does not guarantee a good Advanced rank; the skill gap is problem depth, not knowledge.",
    ],
    [
      "How many mocks should I attempt for JEE Advanced?",
      "20–30 full-length, exam-timed papers, prioritising JEE Advanced PYQs (they are the highest-quality mocks that exist). Two per week in the final 6–8 weeks, each followed by a 90-minute analysis with an error log.",
    ],
    [
      "Should I drop a year for JEE Advanced?",
      "Only with a written 12-month plan, a reason (a quantified gap, not a rank disappointment), and external accountability. A structured dropper year with 6+ focused hours daily and a mock cadence outperforms an unstructured one. Without the plan, the anxiety of a second attempt usually costs more than the extra months gain.",
    ],
    [
      "Which subjects matter most for a top rank?",
      "Mathematics and Physics determine the ceiling — most top ranks score 70%+ in both. Chemistry is the stabilizer: a strong GOC + Organic base keeps your total safe on papers where Maths goes off-track.",
    ],
    [
      "How do I handle the week between Paper 1 and Paper 2?",
      "Decompress fully for 48 hours — no problems, no solutions, no 'just one more set'. Then a 60-minute review of your error log, resume the mock cadence, and protect sleep. Arriving at Paper 2 fresh is worth more than any last-minute content.",
    ],
  ],
  related: [
    "/exam/jee-main|JEE Main: the complete study plan",
    "/exam/gate|GATE: the post-degree engineering exam",
    "/exam/last-minute-revision|Last-minute revision protocol",
    ...EXAM_CORE_LINKS,
  ],
};
