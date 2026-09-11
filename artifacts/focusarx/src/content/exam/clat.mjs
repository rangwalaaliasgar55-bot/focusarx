// CLAT — Common Law Admission Test guide (Workstream 7b, SEO cluster)
import { EXAM_CORE_LINKS } from "./links.mjs";

export const clat = {
  slug: "clat",
  title: "CLAT Study Plan & Reading Strategy (2027) | FocusArx",
  description:
    "CLAT guide: 120 questions in 2 hours, five sections with their weightages, −0.25 negative marking, passage-based reading strategy, legal reasoning method and a daily plan.",
  h1: "CLAT: a reading exam with a legal section in it",
  lead: "CLAT is the entrance test for the 24 National Law Universities and other participating institutions, and it is unusual among Indian competitive exams: almost every question is attached to a passage, the whole paper is 120 questions in two hours, and the skill that decides your rank is reading accurately under time pressure. This guide covers the section weightages, the −0.25 penalty, a method for legal reasoning passages, how to build reading speed, and a daily plan for a first attempt.",
  keywords: "clat study plan clat 2027 preparation clat exam pattern clat legal reasoning clat reading speed nlu admission clat negative marking clat section weightage",
  exam: {
    name: "CLAT",
    authority: "Consortium of National Law Universities",
    mode: "Offline OMR, 2 hours — 120 objective questions, +1 correct and −0.25 wrong, five sections with published weightage ranges",
    frequency: "Once a year (usually December, for the following academic year)",
    tagline: "Sixty seconds a question, and most of them arrive with a passage",
  },
  sections: [
    {
      h: "The pattern, precisely",
      p: "120 objective questions in 2 hours, answered on OMR, with +1 for a correct answer and −0.25 for a wrong one. The paper has five sections with published weightage ranges rather than fixed counts: English Language roughly 20%, Current Affairs including General Knowledge roughly 25%, Legal Reasoning roughly 25%, Logical Reasoning roughly 20%, and Quantitative Techniques roughly 10%. Most questions follow a passage of a few hundred words. The Consortium revises the bulletin annually, so read the current one for the exact section order, question counts and eligibility before you build a timetable.",
    },
    {
      h: "What CLAT is actually testing",
      p: "Comprehension under time. Legal Reasoning does not assume you know law: a passage gives you a principle and a fact situation, and you apply the principle to the facts — no legal knowledge required, only careful reading and consistent application. Current Affairs rewards a sustained daily habit rather than a yearbook in December. Quantitative Techniques is basic numeracy from short data passages. In every section the failure mode is the same: reading fast enough to finish but not accurately enough to answer, which is why the training target is comprehension speed, not raw speed.",
    },
    {
      h: "The two-hour budget",
      p: "One minute per question including reading time, which is tight but workable if you do not stall. A budget that holds up in mocks: Current Affairs and English first (fastest marks, no long working), then Legal Reasoning and Logical Reasoning (the two heaviest sections, done while you are still fresh), and Quantitative Techniques last with 10-12 minutes reserved. Leave three minutes at the end for OMR verification — with 120 bubbles, a shifted row costs more than any single question you could have attempted in those minutes.",
    },
    {
      h: "A method for Legal Reasoning passages",
      p: "Read the principle first, then the facts, then restate the principle in your own words in one line before looking at the options — the restatement is what stops the options from steering you. For each option ask only 'does this fact situation satisfy the stated principle?', not 'is this fair' or 'what would a court do'. Where two options look right, return to your one-line restatement and test both against it literally. Practise in sets of ten passages, and after every set write down which questions you lost to a misread principle versus a misread fact — the two have different fixes.",
    },
    {
      h: "Building reading speed without losing accuracy",
      p: "One unseen passage a day, timed, from an editorial, a judgement summary or a long-form article — then five minutes of review scoring yourself on how many questions you answered correctly, not how fast you read. Speed arrives as a side effect of not re-reading: train yourself to take one line of notes per paragraph (subject, claim, qualifier) so you never need to go back. After six weeks add a second daily passage and start timing full sections. What you should not do is speed-reading tricks that suppress subvocalisation at the cost of comprehension; CLAT questions live in the qualifiers, and skimming loses exactly those.",
    },
    {
      h: "Current Affairs: a daily habit, not a December binge",
      p: "Twenty-five per cent of the paper is Current Affairs and General Knowledge, and it is the section where consistent effort compounds most visibly. Ten to fifteen minutes a day from one reliable source, plus a monthly compilation revised once at month end, plus a small notebook of recurring themes (constitutional bodies, international organisations, landmark judgements, sports and awards, economy basics). The notebook is the revision document for December; a pile of unannotated monthly magazines is not.",
    },
    {
      h: "The six-month plan for a first attempt",
      p: "Months one and two: daily passage work, Legal Reasoning principle sets of ten, Logical Reasoning topic by topic (assumption-inference, arguments, puzzles, blood relations, syllogisms), Quantitative Techniques fundamentals, and the Current Affairs habit from day one. Months three and four: section-wise previous-year questions under timing, one full mock a week with a same-evening error log, and legal reasoning volume rising to twenty passages a week. Month five: two full mocks a week plus a re-read of your error log; month six: mocks taper to one a week, daily passage and Current Affairs continue, sleep and routine get protected. CLAT is in December while most of your competitors are also writing boards — the plan has to survive December, not just November.",
    },
    {
      h: "The −0.25 penalty, in numbers",
      p: "Four wrong answers cost one mark, so a blind guess among four options is exactly break-even, and eliminating one option makes guessing positive. In a paper where ranks separate by fractions of a mark, that arithmetic matters: attempt everything you can eliminate on, skip only what you cannot read at all. But note the asymmetry with CLAT's format — most questions carry a passage you have already read, so a 'guess' is rarely blind, and the disciplined version of this rule is: answer from the passage, guess only when the passage gives you nothing, and never leave a bubble empty.",
    },
    {
      h: "The mistakes that cost CLAT ranks",
      p: "Preparing it as a knowledge exam (memorising legal maxims nobody asks about), reading Current Affairs in a December panic, practising untimed so that accuracy looks excellent and pace never improves, answering Legal Reasoning from a sense of fairness instead of the stated principle, skipping Quantitative Techniques because it is only 10% when it is the section where prepared candidates lose nothing, and never rehearsing a full 2-hour OMR paper before exam day.",
    },
  ],
  faq: [
    [
      "What is the CLAT exam pattern?",
      "120 objective questions in 2 hours on OMR, +1 for correct and −0.25 for wrong, across five sections with published weightage ranges: English around 20%, Current Affairs with GK around 25%, Legal Reasoning around 25%, Logical Reasoning around 20% and Quantitative Techniques around 10%.",
    ],
    [
      "Do I need to know law for CLAT?",
      "No. Legal Reasoning passages give you a principle and a fact situation, and you apply the principle as stated. The skill is precise reading and consistent application, not legal knowledge — memorising maxims does not help.",
    ],
    [
      "When is CLAT held?",
      "Usually in December, for admission in the following academic year. Because it lands during Class 12 board preparation, the plan has to run alongside boards rather than instead of them.",
    ],
    [
      "How many hours a day do I need for CLAT?",
      "Two to three focused hours a day over six months is a realistic first-attempt budget: one passage block, one reasoning block, one Current Affairs habit, with full mocks weekly from month three. Consistency matters far more than marathon weekend sessions.",
    ],
    [
      "Is there negative marking, and should I guess?",
      "−0.25 per wrong answer, which makes four wrong guesses cost one mark. Since most questions come with a passage you have already read, answer from the passage, eliminate where you can, and leave no bubble empty — blind guessing stays break-even at worst.",
    ],
  ],
  related: [
    "/exam/cuet-ug|CUET (UG) subject choice guide",
    "/exam/upsc-cse|UPSC CSE study plan",
    "/exam/exam-anxiety|Beating exam anxiety",
    "/exam/last-minute-revision|Last-minute revision protocol",
    ...EXAM_CORE_LINKS,
  ],
};
