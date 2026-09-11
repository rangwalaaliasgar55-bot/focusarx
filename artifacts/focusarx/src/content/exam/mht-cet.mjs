// MHT-CET — Maharashtra Common Entrance Test guide (Workstream 7b, SEO cluster)
import { EXAM_CORE_LINKS } from "./links.mjs";

export const mhtCet = {
  slug: "mht-cet",
  title: "MHT-CET Study Plan & Percentile Strategy (2026) | FocusArx",
  description:
    "MHT-CET guide: Mathematics two papers at 2 marks each, Physics-Chemistry combined paper, 80/20 Class 12-11 weightage, no negative marking, shift normalisation and a daily plan.",
  h1: "MHT-CET: two Maths papers, one normalised percentile",
  lead: "MHT-CET is Maharashtra's state entrance exam, and it is structured differently from anything national: Mathematics is split into two papers where every question is worth double, Physics and Chemistry share one paper, the syllabus is weighted 80% Class 12 and 20% Class 11, and scores are normalised across shifts. This guide covers the pattern, what the weighting means for your timetable, how normalisation changes the target, and a daily routine that fits around HSC boards.",
  keywords: "mht cet study plan mht cet 2026 preparation mht cet exam pattern mht cet percentile mht cet maths paper 1 paper 2 mht cet normalisation maharashtra cet",
  exam: {
    name: "MHT-CET",
    authority: "State Common Entrance Test Cell, Maharashtra",
    mode: "Computer-based, two sessions a day — Mathematics Paper 1 and Paper 2 (50 questions each, 2 marks per question) plus a combined Physics-Chemistry paper (100 questions, 1 mark each); no negative marking",
    frequency: "Once a year for Class 12 candidates (April-May), with an additional attempt for Class 11 students in some years",
    tagline: "The state paper where Maths is worth double and every shift is curved",
  },
  sections: [
    {
      h: "The pattern, precisely",
      p: "For the PCM group there are three papers: Mathematics Paper 1 (50 questions, 1 hour), Mathematics Paper 2 (50 questions, 1 hour), and a single Physics-Chemistry paper (100 questions — 50 Physics, 50 Chemistry — in 2 hours). Mathematics questions carry 2 marks each and Physics-Chemistry questions carry 1 mark each, so Mathematics is 200 of the 300 total marks. The PCB group swaps in a Biology paper on the same doubling logic. There is no negative marking in any paper. Shifts are held across several days, and scores are normalised, so check the current CET Cell brochure for the year's exact composition before you build a timetable around it.",
    },
    {
      h: "What the 2-mark Maths rule means for your plan",
      p: "Two thirds of your score sits in one subject. A candidate who is strong in Physics and Chemistry but average in Mathematics cannot compensate, and a candidate who is excellent at Mathematics can absorb a weaker Chemistry. That asymmetry should drive your hour allocation rather than your liking: if Mathematics is your weakest subject, it is also your highest-return one, because every mark there counts twice. Split the two Maths papers in practice too — Paper 1 and Paper 2 are separate 1-hour sittings, and the fatigue profile of two back-to-back hour-long papers is different from one two-hour paper.",
    },
    {
      h: "The 80/20 syllabus weighting",
      p: "The CET Cell weights the Class 12 (HSC) syllabus at 80% and Class 11 at 20% for the standard attempt. That single fact reorders a preparation plan: finish and consolidate Class 12 first, because it is four fifths of the paper and it is also what your boards examine, then sweep Class 11 in the remaining weeks rather than interleaving both from day one. Class 11 still matters — 20% of a 300-mark paper is 60 marks, which is more than the gap between two colleges in counselling — but it is a second pass, not a parallel track.",
    },
    {
      h: "How normalisation changes your target",
      p: "Because the exam runs in multiple shifts of different difficulty, raw marks are converted into a normalised percentile that compares you with the candidates who wrote your shift. You cannot control which shift you get, so the only lever is your relative standing within it: the aim is to be clearly above the median of your own paper rather than to hit an absolute mark. Practically, that means preparing for a wide difficulty range — easy questions answered fast and accurately matter as much as the hard ones, because a shift that is easy for everyone punishes careless errors hardest.",
    },
    {
      h: "The four-month plan around HSC boards",
      p: "Month one: complete Class 12 Mathematics chapter by chapter with 30 timed objective questions per chapter, and keep Physics and Chemistry moving with board-oriented notes plus a short MCQ set each. Month two: finish the remaining Class 12 syllabus and start the HSC board writing practice, since boards and CET share the content. Month three: Class 11 sweep — one chapter every two days with 25 MCQs, prioritising the chapters that reappear in Class 12 (mechanics for Physics, mole concept and bonding for Chemistry, algebra and trigonometry for Mathematics). Month four: full-length mocks in the two-papers-per-day shape, one error log, and a final fortnight of formula sheets and mixed 50-question sets at exam pace.",
    },
    {
      h: "Speed without a calculator",
      p: "MHT-CET is a computer-based exam with no calculator, and 100 Mathematics questions across two hours plus 100 Physics-Chemistry questions in two more means the binding constraint is arithmetic throughput, not conceptual difficulty. Train the specific skills: quick decimal and fraction conversion, approximation before exact calculation, standard results memorised (trigonometric values, log rules, common integrals and derivatives), and reading a graph without recomputing it. Twenty minutes a day of pure arithmetic drills for six weeks does more for your CET score than an extra chapter of theory.",
    },
    {
      h: "Mocks, shifts and the error log",
      p: "Run eight to ten full mocks in the final six weeks, always in the real shape: two 1-hour Mathematics papers with a break, then a 2-hour Physics-Chemistry paper. Log every error in four columns — concept gap, calculation slip, misread, time trap — and count the last two separately from the first, because slips and misreads are fixed by process (re-read the question, sanity-check the magnitude) while concept gaps are fixed by study. If your log shows more slips than gaps, your problem is pacing, and the fix is fewer questions attempted carelessly rather than more revision.",
    },
    {
      h: "Focus engineering for a two-paper day",
      p: "A CET day is roughly four hours of examination with a gap in between, which is longer than JEE's single sitting and needs its own stamina training. Rehearse the full shape twice before the real exam, including the mid-day break: eat something you have eaten before, walk, and do not discuss answers. Between papers, reset deliberately — ten slow breaths or a two-minute breathing exercise lowers the carry-over of a bad paper into the next one far better than reviewing what went wrong.",
    },
    {
      h: "The mistakes that cost MHT-CET percentiles",
      p: "Treating Mathematics as one subject among three instead of two thirds of the score, studying Class 11 and Class 12 in parallel from day one and finishing neither, practising with a calculator and then meeting an arithmetic wall on screen, never rehearsing the two-paper day shape, and preparing only for hard questions when a normalised curve rewards accuracy on the easy ones most of all.",
    },
  ],
  faq: [
    [
      "Is there negative marking in MHT-CET?",
      "No. Every paper awards marks for correct answers without penalising wrong ones, so you should attempt every question — solve properly in the first pass, then clear all remaining blanks by elimination before time is called.",
    ],
    [
      "Why is Mathematics worth double?",
      "Mathematics Paper 1 and Paper 2 each carry 50 questions at 2 marks, giving 200 of the 300 total marks, while the combined Physics-Chemistry paper is 100 questions at 1 mark. If Mathematics is your weakest subject it is also your highest-return one, since every mark there counts twice.",
    ],
    [
      "How much of MHT-CET is from Class 11?",
      "The standard weighting is roughly 80% Class 12 (HSC) and 20% Class 11. Finish Class 12 first — it is both the larger share and what your boards examine — then sweep Class 11 in the final weeks.",
    ],
    [
      "Can I prepare for MHT-CET and HSC boards together?",
      "Yes, and you should: the syllabus overlaps heavily. The difference is format, so add a timed objective set after every chapter you study for boards, and rehearse the two-papers-a-day shape in the final month.",
    ],
    [
      "What does normalisation mean for my score?",
      "Raw marks are converted into a percentile relative to the candidates in your shift, because shifts differ in difficulty. You cannot pick your shift, so prepare across a wide difficulty range — accuracy on easy questions matters as much as solving hard ones.",
    ],
  ],
  related: [
    "/exam/jee-main|JEE Main study plan",
    "/exam/bitsat|BITSAT speed strategy",
    "/exam/cbse-class-12|CBSE Class 12 board strategy",
    "/exam/exam-anxiety|Beating exam anxiety",
    ...EXAM_CORE_LINKS,
  ],
};
