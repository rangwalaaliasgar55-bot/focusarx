// UPSC CSE — exam guide (Workstream E, SEO cluster)
import { EXAM_CORE_LINKS } from "./links.mjs";

export const upscCse = {
  slug: "upsc-cse",
  title: "UPSC CSE Study Plan & Strategy (2027) | FocusArx",
  description:
    "UPSC CSE 2027 guide: Prelims-Mains-Interview structure, a 12-month plan, newspaper + source system, answer-writing practice, GS paper strategy, and the focus routine for a long game.",
  h1: "UPSC CSE: the 12-month system behind the selection",
  lead: "UPSC is not an exam you prepare for — it's a 12–18 month system you run: Prelims filters, Mains measures writing, the interview measures the person. With a 1:1000+ selection ratio, the winners are the candidates whose system never broke. This guide is that system: sources, schedule, answer practice, and the focus discipline that survives month 10.",
  keywords: "upsc cse study plan upsc 2027 upsc preparation strategy prelims mains answer writing daily routine newspaper",
  exam: {
    name: "UPSC Civil Services Examination",
    authority: "Union Public Service Commission",
    mode: "Prelims: 2×2h MCQ (GS + CSAT) → Mains: 9 papers (3 qualifying + 6 GS/optional, 250 marks) → Interview: 275",
    frequency: "Once a year (Prelims ~May, Mains ~Aug, interviews Oct–Dec)",
    tagline: "Three exams, one system — the ratio is 1:1000+",
  },
  sections: [
    {
      h: "The structure, precisely",
      p: "UPSC CSE is a three-stage funnel. Prelims: two 2-hour papers — General Studies Paper I (100 questions, 200 marks, negative 1/3) and CSAT (100 questions, 200 marks, qualifying at 33%, no negative). The Prelims cutoff hovers near the low-70s marks (varies by year), and it filters roughly 10–11 lakh applicants to about 2.5 lakh. Mains: nine written papers — three language qualifiers (English + two optional-language, 300 each, qualifying 40%) and six merit papers: Essay (250), GS I–IV (1000 total), and one Optional (300); the Mains merit list (~1200) is cut from the six merit papers. Interview: 275 marks, a 45–60 minute conversation with the board, where a candidate's Prelims + Mains total (out of 1750) and interview (275) combine into the final rank out of 2025. The strategic truth: Prelims is a memory-and-elimination game, Mains is a writing-and-structure game, and the interview is a consistency game — each stage rewards a different skill, and the selected candidate is the one who trained all three in parallel from month one.",
    },
    {
      h: "The source system (fewer books, deeper passes)",
      p: "The standard, working source stack — keep it this size, because the failure mode of UPSC preparation is not missing books, it's unread books: NCERTs (Class 6–12) as the foundation pass for Polity, Geography, History, and Science; one standard book per GS paper — Laxmikanth (Polity), a current-affairs compendium you maintain yourself from a single daily newspaper (The Hindu or Indian Express, ~90 minutes), one Environment source (Shruti Kaushal or the UNEP summaries), one Economy source (the annual Economic Survey + a standard text), IR from the newspaper + a short compendium, and History from a standard text + NCERT. Optional: 2–3 books + PYQs, chosen by affinity AND syllabus overlap with GS (the overlap is the real ROI — Geography, Sociology, and Public International Law options double-count effort). The newspaper rule is the system's heartbeat: every day, 90 minutes, one paper, with a running current-affairs notebook (one page per day: 8–10 points across Polity/Economy/Environment/IR/Society, in your own words) — 365 pages a year, which is your Prelims revision document and your Mains answer bank. Candidates who juggle 5 newspapers and 20 books finish year one with zero retention; the single-newspaper candidate has 365 pages of their own words.",
    },
    {
      h: "The 12-month plan",
      p: "Months 1–3 — foundation: NCERTs + standard texts for the static core (Polity, Geography, Economy, Environment, History), 2–3 focused hours daily in 50-minute blocks, current-affairs notebook started day one. Months 4–6 — the integrated phase: newspaper + notebook at 90 min/day, standard books completed, first PYQ pass (2013–2026 Prelims papers solved chapter-wise — PYQs tell you the exam's actual syllabus, which is narrower than the books claim), optional syllabus 40% done. Months 7–9 — answer-writing launch: Mains practice begins (2 answers/day, 12 minutes each, timed, against PYQ sets), optional completed, second newspaper-pass on the notebook's weak months, one full Prelims mock per week starting. Month 10 — Prelims season: 15–20 full mocks (2-hour, exam-timed), notebook re-read end-to-end (the 365 pages), error log per paper. Months 11–12 (post-Prelims) — Mains season: 2–3 answers/day, 3 full Mains dress tests (9 papers over 3 days, real timing), interview prep from month 11 (DAF practice, current-affairs view, mock boards). The plan's spine: the current-affairs notebook runs all 12 months without a single gap — it is the thread that connects Prelims facts to Mains answers to interview views, and a broken thread is a broken year.",
    },
    {
      h: "Prelims strategy: the elimination game",
      p: "Prelims GS is 100 questions in 120 minutes with 1/3 negative — which makes it the most elimination-driven exam in India. The strategy: attempt 80–85 questions, not 100; the 15 you skip should be the 15 you can't reduce to two options. Training the 2-option reduction: PYQs solved with the 'why the other three are wrong' note (not just the right answer); the notebook's 8–10 daily points re-asked weekly (spaced recall — the 1/3/7/21 cycle); and the mock protocol of 15–20 full papers where the metric is attempts-with-confidence, not raw score. CSAT is qualifying (33%) but the most underrated: 20 minutes of RC + 20 minutes of basic math weekly from month 4 keeps it at 60%+ with near-zero effort — candidates who ignore CSAT and fail it have lost the entire year for 33%. The subject tilt: Polity + Economy + Environment + Geography carry ~50–55% of the GS paper in most years; History and Science are the variable 30%; the current-affairs layer (your notebook) is the 40% that separates 65 from 75.",
    },
    {
      h: "Mains answer-writing: the 250-mark craft",
      p: "Mains is where 11 lakh becomes 1200, and it's a writing exam measured against a rubric: content (the arguments), structure (intro-body-conclusion with clear headings), coverage (all dimensions — political, economic, social, environmental, international), and examples (the current-affairs notebook is your example bank). The training protocol: 2 answers/day, timed at 12 minutes for a 10-marker (the real exam's constraint), written on the actual answer-sheet layout (margins, space), covering GS I (Polity + IR + Society) and GS II/III (Economy + Environment + Science + Security + Disaster) in rotation, then reviewed against 3 criteria — did I cover all dimensions, did I use 2+ current examples, would a stranger understand my argument. The weekly dress set: 4 answers across different papers, timed in one sitting, reviewed by a peer or mentor (the feedback loop is non-negotiable — self-review plateaus at month 3). GS IV (Ethics) is the most structured paper: case studies follow a fixed framework (identify stakeholders → values in conflict → options with consequences → decision + justification), and the framework practice is what separates 200/250 candidates. The Essay paper: 2 essays of 1000 words, one practice every two weeks from month 7 — the skill is argument architecture, and it's trainable.",
    },
    {
      h: "The optional: choose for overlap, not passion",
      p: "The optional is 300 of your 1750 Mains marks — 17% of the total — and the choice is made on two criteria: syllabus overlap with GS (the double-count) and your genuine ability to write 12-minute answers on it for 6 months. The classic high-overlap options: Geography (doubles with GS I's physical geography + maps), Sociology (doubles with GS I's society), Public International Law (doubles with IR), Anthropology (doubles with society + environment). The decision rule: 20 hours of the optional's syllabus + 50 PYQs, then the choice — and the commitment is total from month 4 (2–3 hours/day, because the optional's 300 marks at 80% is worth more than the GS average at 60%). The anti-pattern: switching optionals in month 8 — the 300 marks are forfeit, and the GS months that paid for the switch are gone. One optional, trained like a GS paper, is the selected candidate's profile.",
    },
    {
      h: "The focus system for a 12-month war",
      p: "UPSC is won by attention hygiene over 365 days, and the system has five components: (1) the blocks — 3–4 deep hours daily in 50-minute Pomodoro blocks with 10-minute real breaks, phone in another room, one subject per block (the block subject is fixed on a weekly grid — Mon Polity, Tue Economy, etc. — so the schedule runs itself); (2) the recall — 15 minutes nightly, the day's points written from memory (the notebook's 8–10 points become the next day's opening re-ask — this is the spaced-repetition engine); (3) the notebook — the 365-page current-affairs document, one page per day, in your own words, never skipped (a skipped day is a hole in the Prelims paper); (4) the streak — the visible chain of completed blocks, tracked (FocusArx scores each block; the week-40 Tuesday is defended by the chain, not by motivation); (5) the recovery — one half-day off per week and a full day off per month, protected like an exam. The month-10 data is consistent across serious aspirants: motivation is gone, the system remains, and the system is what carries the candidate through Prelims. UPSC preparation is not a knowledge race; it is a consistency race with knowledge as the entry fee.",
    },
    {
      h: "Interview: the 275 you've been training all year",
      p: "The board sees your DAF (Detailed Application Form), your Mains answers (in some cases), and 45–60 minutes of conversation. The preparation, starting month 11: the DAF as a document — every word you wrote (hometown, family, career, hobbies, the 'why civil services' line) is a question; rehearse honest, specific answers to all of them. Current-affairs views: your 365-page notebook is the view bank — 5 minutes daily on 'my position on this week's top 3 stories, in 3 sentences each'. Mock boards: 3–5 with real panels (friends, mentors, a prep institute's board), each followed by a written debrief (what was the underlying question, what was my tell). The meta-skill: consistency — the interview measures whether the person matches the paperwork, and the candidate who has been running a 12-month system has a story the board can see: the discipline is the answer. Selected candidates describe the same preparation: not a personality act, but a year of running the system, and the interview as its final, visible output.",
    },
    {
      h: "The failure modes (and the fix for each)",
      p: "In order of frequency: (1) source-hopping — 20 books, 3 newspapers, 20 hours of YouTube; fix: the source system above, and the rule 'a second source is a substitute for understanding, and it costs a block'; (2) Prelims-only preparation — the Mains answer skill untrained until month 11, when it can't be built; fix: answers from month 7, non-negotiable; (3) the notebook gap — the current-affairs thread broken for 3 weeks in month 5, which shows up as 8 missing Prelims questions in May; fix: the 90-minute daily slot is protected like the exam; (4) isolation — the month-8 depression of a 12-month solo race; fix: one study partner or room, one honest friend, a monthly 'what worked' review; (5) the attempt-2 spiral — the first attempt's failure becoming the identity; fix: the year is a system, the result is a data point, and the attempt-2 plan is written in the week after the result, not in the six months of grief. The system that survives all five is the one that selects.",
    },
  ],
  faq: [
    [
      "How long does UPSC CSE preparation take?",
      "12–18 months of consistent work is the standard serious attempt: 3–4 focused hours daily in 50-minute blocks, a 90-minute daily newspaper pass, answer-writing from month 7, and 15–20 Prelims mocks. The duration matters less than the unbroken current-affairs thread and the weekly structure.",
    ],
    [
      "What is the UPSC CSE selection ratio?",
      "Roughly 1:1000+ from Prelims to final selection (10–11 lakh applicants, ~1000 final selections in recent years). The ratio is why the system — not the intensity — decides: the selected candidate is the one whose 12-month structure never broke.",
    ],
    [
      "Which optional subject should I choose for UPSC?",
      "Choose for GS overlap and your 12-minute answer stamina: Geography, Sociology, PIL, and Anthropology are the classic high-overlap options. Decide in months 1–2 after 20 hours of syllabus + 50 PYQs, and commit fully — switching in month 8 forfeits the 300 marks.",
    ],
    [
      "Is coaching necessary for UPSC?",
      "For most candidates, a structured self-study system (the source stack + newspaper + PYQs + answer practice) covers the syllabus; coaching adds structure and peer feedback, which is most valuable for the answer-writing phase. The failure mode is never 'no coaching' — it's unstructured months.",
    ],
    [
      "How many mocks for UPSC Prelims?",
      "15–20 full 2-hour mocks in the 6–8 weeks before Prelims, each analysed with the 2-option-elimination metric, plus the PYQ pass (2013–2026) solved chapter-wise. CSAT needs 20 minutes of practice weekly from month 4 — it's qualifying, but failing it forfeits the year.",
    ],
  ],
  related: [
    "/exam/ssc-cgl|SSC CGL: the speed game",
    "/exam/ibps-po|IBPS PO/MT: the banking exam",
    "/exam/nda|NDA & NA: the defence route",
    ...EXAM_CORE_LINKS,
  ],
};
