// CTET — exam guide (Workstream E, SEO cluster)
import { EXAM_CORE_LINKS } from "./links.mjs";

export const ctet = {
  slug: "ctet",
  title: "CTET Study Plan & Preparation Guide (2027) | FocusArx",
  description:
    "CTET 2027 guide: Paper 1 & 2 pattern, the 150-question MCQ strategy, subject-wise weightage, a 4-month plan, the no-negative-marking exploit, and the daily focus routine for aspiring teachers.",
  h1: "CTET: the pass-mark exam, won by the recall system",
  lead: "CTET is the one major teaching exam with no negative marking and a 60/180 pass mark — which makes it the most forgiving exam in Indian recruitment and the most failed one, because candidates treat it like a knowledge test instead of a recall-and-speed test. This guide is the system: pattern, weightage, a 4-month plan, the question-type strategy, and the daily routine that carries the 150 questions of each paper.",
  keywords: "ctet study plan ctet 2027 paper 1 paper 2 preparation strategy math evs language teaching methodology",
  exam: {
    name: "CTET (Central Teacher Eligibility Test)",
    authority: "CBSE",
    mode: "Paper 1 (Classes 1–5) / Paper 2 (Classes 6–8): 150 MCQs each, 2.5h, 150 marks, NO negative, pass 60/150 (90/300 for B.Ed relaxation)",
    frequency: "Once a year (notification ~Aug, exam ~Oct–Nov); eligibility valid 7 years (Paper 2 for B.Ed-holders: lifetime in some cases)",
    tagline: "No negative marking, 60 to pass — the recall game, not the knowledge game",
  },
  sections: [
    {
      h: "The pattern, precisely",
      p: "CTET is a 150-question, 2.5-hour, all-MCQ exam with no negative marking — and that fact should reshape your entire preparation. Paper 1 (for Classes 1–5) is five sections: Child Development & Pedagogy (30 questions — the 'CDP' section, common to both papers and the most misunderstood), Language I (30), Language II (30), Mathematics (30), and Environmental Studies (30). Paper 2 (Classes 6–8) replaces the Languages + EVS with subject papers: you choose two of Mathematics, Science, Social Science, or Second Language, at 60 questions each, alongside the 30 CDP and 30 Language I questions. The pass mark is 60/150 (90/300 with the 5% relaxation for reserved categories), and the certificate is valid for 7 years for recruitment. The strategic facts: (1) no negative marking means you attempt all 150 — the 'skip the unknown' discipline of other exams is a loss here, and the blind-attempt 30 questions are free expected value; (2) the pass mark is low enough that the exam is won by the 90 questions you're certain of, not the 60 you're guessing on — the system's job is to make 120+ certain; (3) CDP is 30 questions in BOTH papers, and it's the section where the 'I've taught for 2 years' candidate loses to the 'I studied the pedagogy framework' candidate — the framework beats the instinct.",
    },
    {
      h: "Child Development & Pedagogy: the framework section",
      p: "CDP is 30 questions of pedagogy theory, and it's the highest-ROI 30 in the paper because it's fully framework-based and fully trainable. The core concepts that carry the section: Piaget's cognitive stages (sensorimotor → preoperational → concrete → formal, with the 'what can the child at this stage do' question type — 4–6 questions every year), Vygotsky's ZPD and scaffolding (the 'teacher as scaffold' scenario questions), Kohlberg's moral development, the inclusive-education principles (learning disabilities: dyslexia, dyscalculia, ADHD — the identification questions are a fixed cluster), the 'child-centred vs teacher-centred' distinction, the assessment types (formative/summative/diagnostic — the scenario questions), and the NCF 2005 principles. The method: one concept per day (15 concepts over 15 days, 45 minutes each: the concept + 10 PYQ-style scenario questions), then the weekly CDP mock of 30 questions. The scenario-reading skill is the actual exam: 'A 7-year-old says X — which stage is she in, and what should the teacher do?' — the two-step answer (identify the stage, choose the pedagogically-correct action) is the question type, and 150 of them (5 years of PYQs) make it reflex. The 30/30 CDP target is the section's standard, and it's a framework section — the instinct-teachers fail it, the framework-students clear it.",
    },
    {
      h: "Language papers: the 2×30 that's fully practiceable",
      p: "Language I and Language II (Paper 1) or Language I + your second language (Paper 2) are 30 questions each of reading comprehension, grammar-in-context, vocabulary, and language-pedagogy (the 'how would you teach X to this age group' questions — the pedagogy layer makes CTET's language sections different from a general English test). The method per language: 20 minutes daily (the same 20-minute habit as every language section on this site) — 10 minutes comprehension (one short passage, 5 questions, timed at 4 minutes), 5 minutes grammar-in-context (the error-spotting + usage rules in age-appropriate passages), 5 minutes vocab (10 words in context). The pedagogy questions (8–10 per language section) are framework: the reading-comprehension teaching methods (literal/inferential/critical levels), the writing-skill progression (the 1–5 spelling-to-composition arc), and the 'child's error as a developmental stage, not a mistake' principle. The 2-language candidates (Paper 2) get the same 20-minute habit per language — the total is 40 minutes daily, which is the difference between the 50/60 and the 60/60 on the subject papers. The comprehension speed target: 4 minutes per passage is the exam standard (2.5 hours ÷ 150 questions ≈ 1 minute per question, and the comprehension passages eat 3–4 of those minutes each).",
    },
    {
      h: "Mathematics (Paper 1): the 30 that's a skill, not a memory",
      p: "Paper 1's Mathematics section is Classes 1–5 level — and it's the section where the strong-math candidate is most overconfident and most wrong, because the questions test MATHEMATICAL LITERACY AND PEDAGOGY, not math ability. The clusters: number sense and place value (the 'a child writes 305 as 350 — what's the error' type), fractions and decimals at the concrete level (the 'which representation is correct' type), geometry basics (symmetry, 2D/3D, the measurement questions), data handling (the pictograph/bar-graph reading — the 1–2 questions every year), and the math-pedagogy questions (the 'which activity builds the concept of fractions best' type). The method: the 1–5 NCERT math textbooks as the source (read the 1–5 math chapters at the level a Class 3 student would — the 'explain it to a 7-year-old' standard), the PYQ pass (5 years, 150 questions, the scenario type dominates), and the 30-question weekly mock. The anti-pattern: solving the questions at adult speed and getting 28/30 in mocks, then 20/30 in the exam — the exam's Math section rewards the candidate who thinks like the 7-year-old the question is about, and that thinking is trained, not assumed.",
    },
    {
      h: "EVS (Paper 1) & the subject papers (Paper 2)",
      p: "EVS is 30 questions of the environmental curriculum at the 1–5 level: the self, the family, food, water, shelter, transportation, the natural world, and the 'child's perspective on the environment' pedagogy layer — the source is the NCERT EVS 1–5, and the method is the same 45-minute-per-chapter + 10-PYQ pattern. For Paper 2 candidates, the two subject papers (60 questions each) are the real weight: Mathematics (6–8 level: the algebra intro, the geometry proof-basics, the mensuration, the data — the 'teach it at the 6–8 level' pedagogy layer + the content), Science (6–8: physics/chemistry/biology at the NCERT level + the science-pedagogy — the 'inquiry-based learning' and 'lab activity' questions), Social Science (6–8: history/geography/civics/economics at the NCERT level + the map questions — the 2–3 map questions per paper are the free cluster, and the 'source-based history' pedagogy), or Second Language (the same 20-minute habit, scaled to 60). The Paper 2 strategy: the 2 subjects chosen should be the 2 you can write 60-question mocks at 50+/60 — the pass is 90/300 across the 5 sections, so the distribution that clears is 30 CDP + 30 Language + 15 + 15 subjects, which is why the '2 strong subjects' choice (not 2 average ones) is the Paper 2 decision rule.",
    },
    {
      h: "The no-negative-marking strategy (the whole game)",
      p: "No negative marking changes the exam's mathematics completely: your expected value on a 50-50 guess is +0.5 (the mark) versus 0 on a skip — so the optimal strategy is attempt-all-150, and the preparation's job is purely to raise the certain-question count. The three tiers of the 150: (1) the certain 90 (the PYQ-trained clusters — CDP framework, the language habit, the map/diagram/free clusters) — the target is 85+ of these correct; (2) the probable 40 (the scenario questions where the framework narrows it to 2 options) — the 2-option elimination trained on 5 years of PYQs; (3) the unknown 20 (the blind attempts) — attempted in the last 15 minutes, one second each, no guilt. The mock protocol reflects it: 10–12 full 2.5-hour mocks over 3 months, each analysed with the 3-tier audit (which tier leaked, and why — the 'certain tier' leak is the only one that matters, because it's the trainable one). The candidates who clear CTET at 120+ report the same profile: 95+ certain, 30 probable, 25 blind — and the 95-certain count is a training number, not a talent number. The 60-to-pass mark means the exam fails the unprepared, not the average-prepared — which is why it's the most failed-eligible exam in teaching recruitment, and why this guide exists.",
    },
    {
      h: "The 4-month plan",
      p: "CTET is a 4-month exam, not a 6-month one — the syllabus is small, the question bank is small (5 years of PYQs is the entire exam), and the recall half-life is short. Month 1 — the framework pass: CDP's 15 concepts (one per day, 45 minutes each), the 1–5 NCERT pass (Math + EVS, 45 minutes per chapter), and the language habit switched on (20 minutes daily per language). Month 2 — the PYQ integration: 5 years of papers solved section-wise with the scenario-type log, the subject papers' 6–8 NCERT pass (Paper 2 candidates: the 2 subjects, 45 minutes per chapter), and the weekly 30-question CDP mock starting. Month 3 — mock season: 10 full 2.5-hour mocks (the 3-tier audit per mock), the error log per section, the 45-minute 'leak fix' set per week's top-2 leaked sections, and the free clusters locked (maps, diagrams, data-reading, the 1–2 fixed question families). Month 4 — the final 30 days: PYQ-only revision (the 150-question scenario set re-run 3×), the 2 mocks/week tapering to 1, the 3-minute CDP formula-concept sheet, the 10-language-error rule sheet, sleep at 7 hours, and the attempt-all-150 rhythm rehearsed until the blind-20 is a 15-minute formality. The total is ~250–300 focused hours — the smallest serious budget on this site, which is exactly why CTET is the highest-ROI teaching exam and why it's won by the 4-month system, not the 2-year drift.",
    },
    {
      h: "The daily focus routine",
      p: "The CTET daily structure (student or working teacher — the blocks scale, the rhythm doesn't): 30 minutes — CDP (the framework day's concept + the 10 scenario questions, the section that needs the most deliberate practice); 45 minutes — the content block (Math/EVS for Paper 1, the subject-NCERT for Paper 2, rotating on a weekly grid); 40 minutes — languages (20 per language: the comprehension + grammar + vocab habit); 15 minutes — the evening recall (the day's CDP concept from memory + the week's PYQ scenarios re-asked). Weekends: Saturday = 1 full mock (2.5 hours, the 3-tier audit in the 90 minutes after); Sunday = the leak-fix sets + the free-cluster lock + rest. Total: 2–2.5 deep hours + habits, 6 days a week, for 4 months ≈ 250–300 hours. The rules: the timer runs the blocks (the 1-minute-per-question exam rhythm is trained at 45-second blocks, not in the 2.5-hour mock alone), the phone in another room (the CTET aspirant's attention is the product — the 150 questions are an attention exam as much as a knowledge exam), and the streak as the chain — the month-3 Tuesday, when the 'it's only a pass-mark exam' complacency creeps in, is defended by the chain. The certificate is 7 years of eligibility, and the system that earns it is the 4-month one, run without a gap.",
    },
    {
      h: "Exam day: the 2.5-hour architecture",
      p: "The fixed order (rehearsed in all 10–12 mocks): CDP first (0–30 min — the 30 framework questions at 60 seconds each, the scenario two-step reflex); Language I (30–60 min — the 20-minute habit is now 30 questions in 25 minutes); Language II or subject 1 (60–105 min); subject 2 (105–140 min); the final 20 minutes = the blind attempts (the unknown 20, one second each, attempt-all) + the flagged returns + the OMR transfer check. The no-negative rhythm holds harder in the real exam than in mocks: the 50-50 is +0.5 expected value, and the 15-minute blind window is where the 60-to-pass line is crossed by the prepared and missed by the complacent. The section time caps are the architecture: CDP under 30, each language under 25, each subject under 40 — the audit in every mock found the section that ate the clock, and the 10th mock's audit is the exam-day plan. The candidate who clears at 110+ describes the exam the same way: 'It was the 10th mock.' That's the 4-month system, and it's the cheapest 7-year eligibility in Indian teaching recruitment.",
    },
  ],
  faq: [
    [
      "What is the CTET passing mark?",
      "60/150 for the general category. Reserved categories get a 5% relaxation (54/150), and B.Ed holders appear for Paper 2. The certificate is valid for 7 years for recruitment purposes.",
    ],
    [
      "How much time is needed to prepare for CTET?",
      "A focused 4 months — about 250–300 focused hours. The syllabus and the question bank (5 years of PYQs) are small; the recall half-life is short, so a tight 4-month system beats a 2-year drift.",
    ],
    [
      "Which papers should I appear for?",
      "Paper 1 if you want to teach Classes 1–5, Paper 2 for Classes 6–8. For Paper 2, choose the two subjects you can mock at 50+/60 — the pass (90/300) is cleared by a 30 CDP + 30 Language + 15 + 15 distribution, so two strong subjects beat two average ones.",
    ],
    [
      "Is CDP the hardest section of CTET?",
      "It's the most misunderstood: it's a framework section (Piaget, Vygotsky, Kohlberg, inclusive education, NCF 2005), not an instinct section. One concept per day for 15 days plus 5 years of scenario PYQs makes the 30/30 a trained outcome.",
    ],
    [
      "What is the best strategy with no negative marking?",
      "Attempt all 150 — a 50-50 guess is +0.5 expected value, so skipping is a loss. The preparation's job is to raise the 'certain' tier to 120+; the unknown 20 go in the final 15 minutes, one second each.",
    ],
  ],
  related: [
    "/exam/cbse-class-10|CBSE Class 10 boards guide",
    "/exam/last-minute-revision|Last-minute revision protocol",
    "/exam/exam-anxiety|Beating exam anxiety",
    ...EXAM_CORE_LINKS,
  ],
};
