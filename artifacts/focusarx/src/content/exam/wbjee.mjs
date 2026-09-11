// WBJEE — West Bengal Joint Entrance Examination guide (Workstream 7b, SEO cluster)
import { EXAM_CORE_LINKS } from "./links.mjs";

export const wbjee = {
  slug: "wbjee",
  title: "WBJEE Study Plan & Category-3 Strategy (2026) | FocusArx",
  description:
    "WBJEE guide: two papers in one day, Category 1/2/3 marking explained, −1/4 negative marking, half the score in Mathematics, Jadavpur cutoffs and a daily practice plan.",
  h1: "WBJEE: one day, two papers, three question categories",
  lead: "WBJEE is the state exam that decides Jadavpur University and most West Bengal engineering seats, and it has a marking scheme unlike the national papers: three question categories with different penalties, half the total score sitting in Mathematics, and everything finished in a single day. This guide covers the pattern, how to handle Category 3 without bleeding marks, the two-paper day budget, and a preparation plan built around negative marking.",
  keywords: "wbjee study plan wbjee 2026 preparation wbjee exam pattern wbjee category 3 negative marking jadavpur university cutoff wbjee mathematics paper 1 paper 2",
  exam: {
    name: "WBJEE",
    authority: "West Bengal Joint Entrance Examinations Board (WBJEEB)",
    mode: "Offline OMR, one day — Paper 1 Mathematics (75 questions, 100 marks, 2 hours) and Paper 2 Physics + Chemistry (80 questions, 100 marks, 2 hours)",
    frequency: "Once a year (usually April or May)",
    tagline: "The state paper with three marking rules and one very long day",
  },
  sections: [
    {
      h: "The pattern, precisely",
      p: "Two papers on one day, both offline on OMR. Paper 1 is Mathematics: 75 questions worth 100 marks in 2 hours. Paper 2 combines Physics (40 questions, 60 marks) and Chemistry (40 questions, 40 marks) into a single 2-hour paper of 100 marks. There is no calculator. Across both papers Mathematics is half the total score, which is the most important structural fact about this exam. Confirm the year's composition and the cutoff dates from the current WBJEEB bulletin — the Board has revised category counts and timings before, and this plan assumes you re-read it.",
    },
    {
      h: "The three question categories",
      p: "Category 1 questions are single-correct and carry 1 mark; Category 2 are single-correct and carry 2 marks; Category 3 have more than one correct option and carry 2 marks. Category 1 and 2 wrong answers cost a quarter of the question's marks as a penalty. Category 3 is the trap: you get the full 2 marks only if you mark every correct option and no incorrect one, and marking any wrong option costs the penalty. There is no partial credit for marking some of the right options, which turns Category 3 into a decision problem rather than a knowledge problem.",
    },
    {
      h: "How to play Category 3",
      p: "Attempt a Category 3 question only when you can positively confirm every option you are marking and positively rule out at least one you are not. If you can confirm two options and are unsure about a third, leaving it blank scores zero while marking the third risks the penalty — and with no partial credit the expected value of a coin-flip third option is negative. Practise Category 3 separately from the rest: 10 questions a day, marking which options you confirmed versus guessed, until your confirmed-only accuracy is high enough that skipping feels boring rather than frightening.",
    },
    {
      h: "Negative marking arithmetic",
      p: "At −1/4 on a 1-mark question, four wrong answers cost one mark; at −1/4 on a 2-mark question, two wrong answers cost one. Eliminating two of four options makes guessing clearly positive for Category 1 and 2 — attempt those. Eliminating one makes it marginally positive on 1-mark questions and roughly break-even on 2-mark ones. Eliminating nothing makes it a loss. Write this rule on your practice sheet and enforce it in mocks, because under time pressure the instinct is to attempt everything, and WBJEE is the paper where that instinct is most expensive.",
    },
    {
      h: "Why Mathematics decides the rank",
      p: "With 100 of the 200 marks in Mathematics and a large pool of candidates strong in Physics and Chemistry, the Mathematics paper is where ranks separate. It also has the tightest time budget: 75 questions in 120 minutes is about 96 seconds each, and Mathematics questions rarely resolve in under a minute when they involve algebra or coordinate geometry. If you are allocating marginal hours between subjects, put them in Mathematics first — the same improvement there is worth double what it is worth in Chemistry.",
    },
    {
      h: "The four-month plan",
      p: "Month one: Class 12 syllabus for all three subjects from your board textbook, with a 25-question timed objective set per chapter. Month two: Class 11 completion plus the first full-length WBJEE paper as a diagnostic — do not skip the diagnostic, because it tells you whether your problem is concept, speed or the category rules. Month three: previous-year WBJEE papers by chapter, every Category 3 question re-solved with an explicit confirmed-or-guessed note, and a weekly mixed 75-question Mathematics set under 2-hour timing. Month four: eight full two-paper days, each with a same-evening error log, plus formula and standard-result sheets revised daily for fifteen minutes.",
    },
    {
      h: "The two-paper day budget",
      p: "Paper 1 (Mathematics): 5 minutes scanning, 70 minutes on the questions you can solve confidently, 30 minutes on the ones that need work with a 3-minute hard cap each, 15 minutes clearing blanks where you can eliminate two options and checking OMR alignment. Paper 2 (Physics then Chemistry, or the reverse — pick one order and always use it): Physics carries more marks per question, so most candidates do Physics first while fresh, then Chemistry, then a final pass. Between the two papers, eat, walk and do not compare answers with anyone; the day is long enough that carry-over anxiety costs real marks.",
    },
    {
      h: "Focus engineering for one very long day",
      p: "WBJEE asks for four hours of examination plus travel, in a single day — a different challenge from exams spread over a week. Train the shape, not just the content: two full timed papers in one day, at the real start time, twice before the exam. Log your accuracy in the last 30 minutes of each paper separately from the first 30, because that is where the fatigue shows and where careless Category 3 mistakes happen. If your late-paper accuracy drops noticeably, add breathing work at the mid-point of practice papers until it stops.",
    },
    {
      h: "The mistakes that cost WBJEE ranks",
      p: "Attempting every Category 3 question because it 'feels' like free marks, spreading hours evenly across three subjects when half the paper is Mathematics, preparing from JEE-Advanced-level problems and meeting a faster, shallower paper, never practising the two-paper day shape, and ignoring the elimination rule so that guessing becomes a tax instead of a tool. The quietest one is OMR discipline: 155 answers across two papers is enough to shift a row and lose a run of marks you actually earned.",
    },
  ],
  faq: [
    [
      "What is the WBJEE negative marking?",
      "Category 1 and Category 2 wrong answers cost a quarter of that question's marks. Category 3 pays the full 2 marks only if you mark every correct option and no incorrect one, with the same quarter penalty if you mark a wrong option — and no partial credit.",
    ],
    [
      "Should I attempt Category 3 questions?",
      "Only when you can confirm every option you mark and rule out at least one you do not. With no partial credit, guessing a third uncertain option has negative expected value, so a disciplined skip scores better than a hopeful mark.",
    ],
    [
      "How much of WBJEE is Mathematics?",
      "Paper 1 is Mathematics alone — 75 questions worth 100 of the 200 total marks. It is half the exam and has the tightest time budget, so marginal study hours belong there first.",
    ],
    [
      "Is WBJEE enough for Jadavpur University?",
      "WBJEE is the main route to Jadavpur and most West Bengal engineering colleges, though some institutions and courses also accept JEE Main. Check the current WBJEEB and university notices for the year's seat matrix and which scores each college accepts.",
    ],
    [
      "How should I prepare for WBJEE alongside boards?",
      "The syllabus overlaps heavily with the West Bengal board and NCERT Class 11-12. Study the board content once, then add a timed objective set per chapter in WBJEE format, and rehearse two full papers in one day during the final month.",
    ],
  ],
  related: [
    "/exam/jee-main|JEE Main study plan",
    "/exam/kcet|KCET study plan",
    "/exam/mht-cet|MHT-CET study plan",
    "/exam/exam-anxiety|Beating exam anxiety",
    ...EXAM_CORE_LINKS,
  ],
};
