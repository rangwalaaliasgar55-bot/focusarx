// ══════════════════════════════════════════════════════════════════
// Exam funnel angles — one genuinely unique angle + suggested slice per
// exam for /pomodoro-timer-for/:exam. Extend by adding a slug entry;
// everything downstream derives from EXAM_GUIDES + this map.
// ══════════════════════════════════════════════════════════════════

export const FUNNEL_ANGLES = {
  "jee-main": {
    angle:
      "JEE Main punishes guessing and rewards 90-second retrieval speed. Train it the way the paper tests it: timed 50-question sets, one subject per block, phone in another room.",
    minutes: 50,
  },
  "jee-advanced": {
    angle:
      "Advanced is a 6-hour endurance exam of multi-concept problems. Build stamina with 90-minute deep blocks and full-length mocks at 9 AM — never with music, never in bed.",
    minutes: 90,
  },
  "neet-ug": {
    angle:
      "NEET is 200 questions of NCERT recall under a clock. The winners do daily 10-minute Inorganic bursts and timed Biology sets — volume of recall reps, not hours of reading.",
    minutes: 50,
  },
  "upsc-cse": {
    angle:
      "UPSC rewards consistent daily answer-writing over marathon reading. Two 50-minute blocks — one Mains answer set, one Prelims MCQ set — beat any 8-hour 'study day'.",
    minutes: 50,
  },
  "cat": {
    angle:
      "CAT is three timed sprints: VARC, DILR, Quant. Practice in exact sectional slots with a timer you cannot negotiate with — the slot pressure is the skill being tested.",
    minutes: 40,
  },
  gate: {
    angle:
      "GATE's numerical-heavy paper rewards problem mileage. One formula sheet per subject, 15 timed problems a day, and every error logged the same evening.",
    minutes: 50,
  },
  "cbse-class-12": {
    angle:
      "Boards reward complete, stepwise answers — not speed. Alternate 25-minute writing practice with 25-minute NCERT recall, and reviseoshort notes within 24 hours of learning.",
    minutes: 25,
  },
  "cbse-class-10": {
    angle:
      "Class 10 is won with NCERT line-by-line plus previous papers. Short daily blocks beat weekend marathons — consistency is the entire strategy at this stage.",
    minutes: 25,
  },
  "ssc-cgl": {
    angle:
      "SSC CGL is speed arithmetic plus reasoning patterns. Daily 25-minute speed sets with an error log outperform any amount of passive video watching.",
    minutes: 25,
  },
  nda: {
    angle:
      "NDA splits preparation between written GAT/maths and physical readiness. Protect one morning block for maths and one evening block for GAT — fitness never borrows from study time.",
    minutes: 50,
  },
  ctet: {
    angle:
      "CTET tests pedagogy concepts plus subject basics. Read one concept, then immediately attempt 20 MCQs on it — recall within the hour is what sticks.",
    minutes: 25,
  },
  "ibps-po": {
    angle:
      "Bank PO prelims are a speed filter: 100 questions, 60 minutes. Train at 130% pace in 25-minute bursts so the real paper feels slow.",
    minutes: 25,
  },
  bitsat: {
    // Short enough to survive intact in a 160-character description; the
    // angle's first sentence is not (see funnelDescription in exam/derive.mjs).
    pitch: "BITSAT is 130 questions in 3 hours, so pace matters more than depth.",
    angle:
      "BITSAT asks 130 questions in 3 hours — about 83 seconds each, with a quarter of the marks in English and Logical Reasoning. Train throughput: 20-question sets in 20 minutes, daily, plus 20 minutes of vocabulary and reasoning patterns nobody else prepares.",
    minutes: 40,
  },
  kcet: {
    angle:
      "KCET is four 80-minute papers with no negative marking, set from the Karnataka board textbook. Practise at half-paper length — 30 questions in 40 minutes — and never leave a bubble empty, because on this paper a blank is the only guaranteed zero.",
    minutes: 40,
  },
  "mht-cet": {
    // Short enough to survive intact in a 160-character description; the
    // angle's first sentence is not (see funnelDescription in exam/derive.mjs).
    pitch: "MHT-CET puts two thirds of its marks in two one-hour Maths papers.",
    angle:
      "MHT-CET puts two thirds of its marks in two one-hour Maths papers where every question is worth double, and 80% of the syllabus is Class 12. Run 50-minute Maths blocks with no calculator — arithmetic throughput is the binding constraint, not concepts.",
    minutes: 50,
  },
  wbjee: {
    angle:
      "WBJEE is two 2-hour papers in one day, half the score in Mathematics, and three marking categories. Practise Category 3 separately: mark only the options you can confirm, because there is no partial credit and a hopeful third option is negative expected value.",
    minutes: 50,
  },
  "cuet-ug": {
    // Short enough to survive intact in a 160-character description; the
    // angle's first sentence is not (see funnelDescription in exam/derive.mjs).
    pitch: "CUET sections run 45 minutes and let you skip questions, so pace wins.",
    angle:
      "CUET sections are 45 minutes long and let you answer fewer questions than you are given — the skill is choosing the best 35 of 45, not attempting all of them. Rehearse at exactly 45 minutes, then log every question you attempted that you should have skipped.",
    minutes: 45,
  },
  clat: {
    angle:
      "CLAT is 120 questions in 2 hours and almost every one arrives with a passage. Train comprehension speed, not reading speed: one unseen passage a day timed at eight minutes, then score yourself on accuracy. Skimming loses exactly the qualifiers the questions ask about.",
    minutes: 60,
  },
  "ca-foundation": {
    // Short enough to survive intact in a 160-character description; the
    // angle's first sentence is not (see funnelDescription in exam/derive.mjs).
    pitch: "CA Foundation needs 40% in every paper, not one big score.",
    angle:
      "CA Foundation needs 40% in every paper plus a 50% aggregate, so your weakest paper decides the result. Give it the first block of every day, do 25 objective problems with the negative penalty applied to your practice score, and write two full answers by hand each week.",
    minutes: 50,
  },
  gre: {
    // Short enough to survive intact in a 160-character description; the
    // angle's first sentence is not (see funnelDescription in exam/derive.mjs).
    pitch: "The GRE is section-adaptive, so the first section sets your ceiling.",
    angle:
      "The GRE is section-adaptive, so your first Verbal and first Quant section set the ceiling for the second. Do not experiment with pace early, and never leave a blank — there is no penalty for a wrong answer, only for an empty one.",
    minutes: 40,
  },
  gmat: {
    // Short enough to survive intact in a 160-character description; the
    // angle's first sentence is not (see funnelDescription in exam/derive.mjs).
    pitch: "GMAT Focus is 64 questions in 2h15m, roughly two minutes each.",
    angle:
      "GMAT Focus is 64 questions in 2h15m, so each one is worth more and two minutes each is enough to be careful. Drill Data Insights type by type — data sufficiency, two-part analysis, table analysis — because the switching cost between types is what makes the section feel hard.",
    minutes: 45,
  },
  "exam-anxiety": {
    angle:
      "Anxiety shrinks working memory, which is exactly what exams tax. Shorter 25-minute blocks with real breaks keep the nervous system regulated — and regulated brains recall more.",
    minutes: 25,
  },
  "last-minute-revision": {
    // Short enough to survive intact in a 160-character description; the
    // angle's first sentence is not (see funnelDescription in exam/derive.mjs).
    pitch: "In the final days, stop learning and start retrieving.",
    angle:
      "In the final days, stop learning and start retrieving: formula sheets, error logs and timed mixed sets only. New material now costs more than it earns.",
    minutes: 25,
  },
};

export function getFunnelAngle(slug) {
  return FUNNEL_ANGLES[slug] ?? null;
}
