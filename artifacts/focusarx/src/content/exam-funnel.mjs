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
  "exam-anxiety": {
    angle:
      "Anxiety shrinks working memory, which is exactly what exams tax. Shorter 25-minute blocks with real breaks keep the nervous system regulated — and regulated brains recall more.",
    minutes: 25,
  },
  "last-minute-revision": {
    angle:
      "In the final days, stop learning and start retrieving: formula sheets, error logs and timed mixed sets only. New material now costs more than it earns.",
    minutes: 25,
  },
};

export function getFunnelAngle(slug) {
  return FUNNEL_ANGLES[slug] ?? null;
}
