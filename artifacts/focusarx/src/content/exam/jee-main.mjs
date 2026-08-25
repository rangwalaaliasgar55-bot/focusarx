// JEE Main — exam guide (Workstream E, SEO cluster)
import { EXAM_CORE_LINKS } from "./links.mjs";

export const jeeMain = {
  slug: "jee-main",
  title: "JEE Main Study Plan & Prep Guide (2027) | FocusArx",
  description:
    "JEE Main 2027 prep guide: exam pattern, 6-month plan, daily focus routine, subject-wise strategy, mock protocol, and the 30-day final sprint. Free.",
  h1: "JEE Main: the complete study plan & focus guide",
  lead: "JEE Main is won by the student who converts planned hours into actually-focused hours. This guide gives you the official exam pattern, a realistic 6-month plan, a daily structure that survives a real school or coaching day, and the mistakes that quietly cost 50+ marks.",
  keywords: "jee main study plan jee main preparation jee main 2027 focus routine daily routine jee main tips",
  exam: {
    name: "JEE Main",
    authority: "NTA (twice a year: Jan + Apr sessions)",
    mode: "Online CBT — 3h 20m, 75 questions, 300 marks, 1/4 negative",
    frequency: "Two attempts per year; JEE Advanced eligibility via top 2.5 lakh (B.E.) / 9th percentile (B.Arch)",
    tagline: "The 11/12 board-year exam that decides IIT/NIT/GFTI entry",
  },
  sections: [
    {
      h: "JEE Main at a glance",
      p: "JEE Main is a computer-based test of 75 questions in 200 minutes (180 minutes of answering plus 20 for reading the instructions and shifting between sections). You get 300 marks, with +4 for a correct answer and −1 for a wrong one in most sections. Physics and Chemistry carry 25 questions each; Mathematics carries 35. Since the 2024 redesign the paper is non-adaptive with Section A (compulsory MCQs) and Section B (optional — you answer 10 of 12, or 12 of 15 in Maths depending on the session's blueprint), which makes question selection a real scoring skill. The qualifying percentile for JEE Advanced sits around the 90+ percentile, and a 95+ percentile is the honest target if you want a comfortable IIT seat through the combined JEE Main + Advanced score.",
    },
    {
      h: "What JEE Main actually tests",
      p: "It does not test who studied the most hours. It tests three narrow things: retrieval speed (can you recall the formula and apply it in under 90 seconds?), accuracy under time pressure (negative marking punishes guessing — an 85% attempt rate with 95% accuracy beats a 100% attempt rate with 70% accuracy), and emotional stability (the paper deliberately places 8–10 questions designed to stall you; the exam is won in how you handle those). A student who plans 4 focused hours a day beats a student who 'studied 8 hours' of scrolling-and-highlighting. Focus quality is the entire game, which is why this guide is built around how to protect your attention, not just what to study.",
    },
    {
      h: "A 6-month plan (Month 3 of Class 12 onwards)",
      p: "Month 1 — close the gaps: finish pending Class 12 chapters and re-do the weakest 5 Class 11 chapters with PYQs (previous year questions) alongside, 60 minutes per gap. Month 2 — core engineering chapters: Calculus, Mechanics, Organic reaction maps, Electrochemistry; every chapter ends with 50 PYQs under a timer. Month 3 — remaining syllabus plus first full mocks: one mock every weekend, always 3h 20m, always analysed for 2h the next morning. Month 4 — PYQ deep-dive: 2019–2026 papers, one per day, marking every error into a single 'error log' notebook. Month 5 — mock density: two mocks per week, error log re-tested weekly, formula sheets built from your own errors (not from anyone else's list). Month 6 — the final sprint: formula sheets only, 50-question timed sets per subject daily, full syllabus mocks at exam time, and sleep locked at 7 hours. The plan assumes 3–4 real deep-work hours daily during the school/coaching year; scale sections, not intensity, if you have more.",
    },
    {
      h: "Your daily structure (school year version)",
      p: "The structure that works for most JEE aspirants in Class 12: 45–60 minutes before school for the hardest subject of the day (your brain's freshest 45 minutes go to Mathematics or Physics — never to 'easy' Chemistry reading). After school: 20-minute break, dinner, then a 50-minute deep block on the second subject, a 10-minute walk (no phone), a 50-minute block on the third, and 15 minutes of active recall — close the notebook and write down everything you remember from the day. Before bed: 10 minutes on the error log. Total: 3–3.5 protected deep hours plus 25 minutes of recall work, every day, 6 days a week, with Sunday reserved for a mock. The rule that keeps this alive: the blocks are on a timer, the phone is in another room, and 'skipping one block' is treated like missing a bus — you take the next one, you don't spiral.",
    },
    {
      h: "Subject strategy",
      p: "Physics: do not read theory twice. One honest pass of the chapter, then 100+ problems graded by difficulty; your goal is recognition speed on standard problem types (kinematics, waves, modern physics, electronics — the 'low-hanging 40 marks'). Chemistry: Physical Chemistry is formula-driven and fully scoreable with practice; Organic needs a reaction-map system (functional group → reagent → product) reviewed weekly; Inorganic is pure recall — NCERT line-by-line, tested with active recall daily in 10-minute bursts. Mathematics: the 35-question section decides the exam. Work 15 timed problems a day across Calculus, Vectors 3D, Probability, and Conics; when stuck for more than 90 seconds, mark the question, move on, and solve it from the solutions the same evening — that 'mark and move' habit is exactly the exam behaviour that saves 15–20 marks.",
    },
    {
      h: "The mock protocol (this is where ranks are made)",
      p: "A mock is only worth the analysis. Run every mock at the real exam time (9 AM), in a single sitting, 3h 20m, phone away, no references. The same evening, spend 90–120 minutes on the analysis with a three-column log: (1) questions you got wrong and why — formula gap, concept gap, misread, or time trap; (2) questions you skipped that you could have solved; (3) questions you solved slowly that should be 60-second solvers. Every error category from the last two mocks becomes a 30-minute focused set the next day. After 12–15 analysed mocks, your score plateau breaks, because you stop repeating the same 15 errors. Unanalysed mocks are entertainment; analysed mocks are coaching.",
    },
    {
      h: "Protecting focus: the 25/5 engine",
      p: "JEE preparation is a marathon of short, intense sprints, which is exactly what the Pomodoro rhythm was built for: 25–50 minutes of single-task work, 5–10 minutes of real rest (stand up, water, look out a window — never the phone, because 5 minutes of Reels resets your attention for 30). Use a timer you can't ignore, and let the timer decide when the break comes — self-negotiated breaks are how a '2-hour study session' becomes 40 minutes of studying and 80 minutes of scrolling. Track every session: FocusArx scores each block and shows your focus DNA (the hours you're genuinely sharp), which usually reveals that your 7–9 AM and 5–7 PM windows are worth two of your three daily deep blocks. Guard those windows like exam time, because for JEE they are.",
    },
    {
      h: "The mistakes that cost 50+ marks",
      p: "In order of frequency: (1) collecting resources instead of doing problems — more than two sources per subject is procrastination with a subscription; (2) re-reading notes and calling it revision — without recall testing, you lose ~70% within a week; (3) skipping the easy 60% to chase the last 10% — JEE's first 45–55 questions are worth more per minute than the last 10; (4) mocking only when feeling ready — mocks are for when you're not ready; (5) studying in bed or with the phone on the desk; (6) comparing your mock percentile with a friend's instead of your own trend line; (7) burning out in Month 4 and collapsing in Month 6 — the plan above deliberately tapers intensity so the final month is maintenance, not a sprint from zero.",
    },
    {
      h: "The final 30 days",
      p: "Stop learning new things after T−25. Your day becomes: 2 timed 50-question sets (Physics + Maths) in the morning, Chemistry + Inorganic NCERT recall in the afternoon, 100 mixed questions at exam pace in the evening, error-log-only revision at night, and a full mock every third day at 9 AM. Sleep is fixed at 7 hours — a 97 percentile with 5 hours of sleep on exam day is worth less than a 95 with 7, because the working-memory tax of sleep loss hits the 200-minute paper hardest. Two days before: light formula review only, pack the admit card, pen, and watch. Exam week is a maintenance phase, not a study phase.",
    },
    {
      h: "Exam-day protocol",
      p: "Arrive 45 minutes early; eat a familiar, moderate breakfast (you know your gut better than any guide); no new formulae in the last 2 hours. In the paper: read the full instructions once (20 minutes are on the clock), then take a fast first pass — attempt every question you can solve in under 60–90 seconds, mark the rest, come back. With 1/4 negative marking, your expected value says: attempt if you can eliminate two options, skip if you're fully guessing. Section B selection: pick your 10–12 from the 15 by speed, not by difficulty labels. Last 20 minutes: transfer check, OMR/flag review, and the easy marks you were too proud to take. You are not trying to finish the paper; you are trying to maximize the attempted-correct count. That single reframe keeps the negative marking from becoming self-sabotage.",
    },
  ],
  faq: [
    [
      "How many hours a day should I study for JEE Main?",
      "3–4 hours of genuinely focused study beats 8 distracted hours. During the Class 12 school year, protect 3–3.5 deep hours plus 25 minutes of daily recall work. In dropper years, scale to 6–8 focused hours in 50-minute blocks with real breaks.",
    ],
    [
      "Is JEE Main difficult if I start in Class 11?",
      "It is very achievable. Start in Class 11 with Class 11 syllabus + PYQs, and by the end of the year you should be comfortable at the JEE Main level in Maths and Physics. The students who struggle usually started in Class 12 with a gap in Class 11 fundamentals.",
    ],
    [
      "How important are mock tests for JEE Main?",
      "Critical — but only analysed mocks. 12–15 full-length, exam-timed mocks with a 2-hour analysis each, logged in an error notebook, are worth more than any extra course. The final 10 percentiles come from fixing your repeatable error patterns.",
    ],
    [
      "What is the best time of day to study for JEE?",
      "Your focus DNA decides, but most students peak in two windows: 7–9 AM and 5–7 PM. Put your hardest subject (usually Maths or Physics) in the first window, and reserve one daily window for a mock or PYQ set at the real exam time.",
    ],
    [
      "Can I crack JEE Main with only NCERT?",
      "NCERT is necessary for Chemistry (especially Inorganic) and a good base, but insufficient for Physics and Mathematics. Pair NCERT with one standard problem book and 2019–2026 PYQs. The PYQs are non-negotiable — the exam repeats its own patterns far more than students expect.",
    ],
  ],
  related: [
    "/exam/jee-advanced|JEE Advanced: the hard part of IIT",
    "/exam/last-minute-revision|Last-minute revision protocol",
    "/exam/exam-anxiety|Beating exam anxiety",
    ...EXAM_CORE_LINKS,
  ],
};
