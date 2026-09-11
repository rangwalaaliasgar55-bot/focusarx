// GRE — Graduate Record Examinations guide (Workstream 7b, SEO cluster)
import { EXAM_CORE_LINKS } from "./links.mjs";

export const gre = {
  slug: "gre",
  title: "GRE Study Plan & Shortened-Format Strategy (2026) | FocusArx",
  description:
    "GRE guide: the shortened format explained, section-adaptive scoring, Quant 130-170, Verbal strategy, the Issue essay, free PowerPrep tests and a six-week daily plan.",
  h1: "GRE: a short adaptive test with two very different halves",
  lead: "Since the 2023 shortening the GRE runs under two hours, scores Verbal and Quant separately from 130 to 170, adapts section by section, and asks for one analytical writing essay. This guide covers what the shortened format actually contains, how section-level adaptation changes your strategy, a six-week plan for a first attempt, how to use the free official PowerPrep tests, and the mistakes that cost Indian applicants points they already knew how to earn.",
  keywords: "gre study plan gre 2026 preparation gre shortened format gre section adaptive gre quant verbal score gre powerprep gre issue essay gre syllabus",
  exam: {
    name: "GRE General Test",
    authority: "Educational Testing Service (ETS)",
    mode: "Computer-delivered, under two hours — one Analytical Writing essay plus two Verbal Reasoning sections and two Quantitative Reasoning sections; Quant and Verbal each scored 130-170, AWA 0-6",
    frequency: "Available year-round at test centres and at home; repeatable after a fixed interval",
    tagline: "Two hours, two scores, and an algorithm watching your first section",
  },
  sections: [
    {
      h: "The shortened format, precisely",
      p: "The current GRE General Test takes under two hours: one Analytical Writing task (the Analyse an Issue essay), then Verbal Reasoning across two sections and Quantitative Reasoning across two sections, with fewer questions than the pre-2023 test and no unscored experimental section. There is no negative marking, so an unanswered question is a pure loss. Quant and Verbal each produce a score from 130 to 170 in one-point steps; the essay is scored 0 to 6 in half points. ETS revises formats, so confirm the current section lengths, question counts and fees on the official site before you book.",
    },
    {
      h: "How section-level adaptation works",
      p: "The test is section-adaptive within each measure: how you perform on the first Verbal section determines the difficulty of the second, and the same holds for Quant. Your final score depends on both the number of correct answers and the difficulty level you reached. The strategic consequence is that the first section of each measure is worth disproportionate attention — a shaky start caps the ceiling of the second section. Do not experiment with pace in section one, and do not leave any question blank in it.",
    },
    {
      h: "What the Quant section actually asks",
      p: "Arithmetic, algebra, geometry and data analysis at roughly a Class 10 level, wrapped in wording designed to catch inattention: quantitative comparison, numeric entry, and multiple-answer questions where you must select every correct option. For Indian applicants the content is usually not the problem — the traps are. The traps are consistent and learnable: units, per-cent-of-per-cent, 'must be true' versus 'could be true', diagrams not drawn to scale, and answer choices that match a common misread. Practise by logging which trap you fell into each time, not just whether you got it right.",
    },
    {
      h: "What the Verbal section actually asks",
      p: "Text completion and sentence equivalence (vocabulary in context, where the sentence's own logic supplies the answer), plus reading comprehension across short and long passages with inference, structure and author-attitude questions. Vocabulary matters but is secondary to logic: in sentence equivalence the two correct answers must produce sentences with the same meaning, which lets you solve many questions by structure before you consider word choice. Build vocabulary by learning words in families and by their charge (positive or negative), which is what the blanks actually require.",
    },
    {
      h: "The Issue essay in 30 minutes",
      p: "One task, 30 minutes, a prompt asking you to evaluate a claim and explain your position. A reliable structure: a two-sentence introduction stating your position and its basis, three body paragraphs each carrying one reason with a specific example, one paragraph acknowledging and answering the strongest counter-position, and a two-sentence conclusion. Practise six essays under timing before the real one and read ETS's published scorer commentary — the graders reward a clear position, developed examples and controlled sentences, not sophisticated vocabulary or a contrarian take.",
    },
    {
      h: "The six-week plan",
      p: "Week one: one full official PowerPrep test cold, to get a baseline and see the score split between Quant and Verbal. Weeks two and three: Quant fundamentals plus daily 20-question timed sets, and Verbal text-completion drills with a vocabulary list of 20 words a day learned in context. Week four: reading comprehension volume — two long passages a day under timing — plus two Issue essays. Week five: two full-length practice tests with same-day review, error log by trap type. Week six: taper to mixed timed sets, one more full test, daily revision of the error log and the vocabulary you have already met, and protect sleep. Total is roughly 90-120 focused hours, which suits most first attempts with a decent baseline.",
    },
    {
      h: "Using the official practice material properly",
      p: "ETS's PowerPrep tests are the only material that adapts the way the real test does, so treat them as measurements rather than practice: take one at baseline, one mid-preparation and one in the final week, each at the same time of day you will sit the real test, each reviewed the same evening. Third-party question banks are fine for volume on Quant and for vocabulary, but their difficulty calibration drifts, so do not let a good third-party score change your plan or a bad one panic you. Review matters more than volume: an hour of logging why you missed questions beats an extra hour of new ones.",
    },
    {
      h: "Targeting the score your programme wants",
      p: "Programmes publish averages, not minimums, and the split matters more than the total: an engineering department reads Quant, a humanities department reads Verbal and the essay, and a business school reads both plus your GMAT if you took it instead. Find the median scores of last year's admitted cohort for your specific programme and aim one to two points above it in the relevant measure. If your target programme is Quant-heavy and your Verbal is already respectable, the marginal hour goes to Quant — the reverse of what most test-takers instinctively do, because Verbal feels more like studying.",
    },
    {
      h: "The mistakes that cost GRE points",
      p: "Preparing only from third-party material and never seeing the adaptive shape, ignoring the essay because 'it is only 0-6' when programmes do read it, treating Quant as easy and losing points to misreads, learning vocabulary as isolated word-meaning pairs instead of in context, booking the test before having a baseline, and leaving questions blank when there is no penalty for guessing. The last one is free points: with no negative marking, an empty answer is a decision to score lower.",
    },
  ],
  faq: [
    [
      "How long is the GRE now?",
      "Under two hours since the 2023 shortening: one Issue essay plus two Verbal and two Quantitative sections, with fewer questions than the older format and no unscored experimental section. Confirm current timings on the ETS site before you book.",
    ],
    [
      "How is the GRE scored?",
      "Verbal Reasoning and Quantitative Reasoning are each scored 130-170 in one-point increments, and Analytical Writing 0-6 in half points. There is no composite score — programmes read the two measures separately, so the split matters as much as the total.",
    ],
    [
      "Is there negative marking on the GRE?",
      "No. Wrong answers cost nothing beyond the point you did not earn, so never leave a question blank — eliminate what you can and guess on the rest.",
    ],
    [
      "What is section-level adaptivity?",
      "Your performance on the first Verbal section sets the difficulty of the second, and the same for Quant. Reaching a harder second section raises your ceiling, which is why the first section of each measure deserves your best attention and no blank answers.",
    ],
    [
      "How much preparation is enough?",
      "Six weeks of roughly 15-20 focused hours a week is a common first-attempt budget, starting with an official PowerPrep baseline and ending with a full test in the last week. If the baseline is far from your target, add a second six-week cycle rather than compressing.",
    ],
  ],
  related: [
    "/exam/gmat|GMAT Focus Edition guide",
    "/exam/cat|CAT study plan",
    "/exam/exam-anxiety|Beating exam anxiety",
    "/exam/last-minute-revision|Last-minute revision protocol",
    ...EXAM_CORE_LINKS,
  ],
};
