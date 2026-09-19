/**
 * Dream catalogue and per-dream systems — shared by the dreams route and the
 * first-run onboarding generator.
 *
 * Kept in `lib/` rather than inside a route so the onboarding generator can
 * build a plan from the same source of truth the dreams page renders. Two
 * copies of "what a NEET week looks like" would drift within a release.
 */

export const DREAM_TYPES = [
  { id: "iit", label: "IIT/JEE", emoji: "⚙️", desc: "Crack India's toughest engineering exam", targetMinutes: 360 },
  { id: "neet", label: "NEET/AIIMS", emoji: "🩺", desc: "Become a doctor and heal the world", targetMinutes: 360 },
  { id: "upsc", label: "UPSC/IAS", emoji: "🏛️", desc: "Serve the nation as a civil servant", targetMinutes: 300 },
  { id: "cat", label: "CAT/MBA", emoji: "💼", desc: "Lead organizations and build your future", targetMinutes: 240 },
  { id: "startup", label: "Launch a Startup", emoji: "🚀", desc: "Build something people love", targetMinutes: 240 },
  { id: "promotion", label: "Career Promotion", emoji: "📈", desc: "Rise to the top of your field", targetMinutes: 180 },
  { id: "coding", label: "Crack Coding Interviews", emoji: "💻", desc: "Land your dream tech job", targetMinutes: 240 },
  { id: "research", label: "Research/PhD", emoji: "🔬", desc: "Push the boundaries of knowledge", targetMinutes: 300 },
  { id: "language", label: "Learn a Language", emoji: "🌍", desc: "Connect with the world", targetMinutes: 120 },
  { id: "fitness", label: "Get Fit & Healthy", emoji: "💪", desc: "Build the body you deserve", targetMinutes: 90 },
  { id: "creative", label: "Creative Mastery", emoji: "🎨", desc: "Master your art form", targetMinutes: 180 },
  { id: "custom", label: "My Own Dream", emoji: "✨", desc: "Define your own path", targetMinutes: 180 },
];

/**
 * Dream → system.
 *
 * A dream picker that changes a label and a target number is a progress bar,
 * not a plan: every dream ends up with the same advice. Each dream type below
 * carries its own *system* — the subject split that matches how that exam is
 * actually scored, the shape of a day, and the milestones that mark real
 * progress. The client renders it as today's plan, the weekly split and the
 * next milestone, so choosing a dream visibly changes what you do next.
 */
export interface DreamBlock {
  label: string;
  minutes: number;
  kind: "deep" | "practice" | "review" | "output";
}

export interface DreamSystem {
  tagline: string;
  subjects: Array<{ name: string; percent: number }>;
  blocks: DreamBlock[];
  milestones: string[];
  dailyHabit: string;
  checkIn: string;
}

export const DREAM_SYSTEMS: Record<string, DreamSystem> = {
  iit: {
    tagline: "Two subjects deep, one subject practised, every single day.",
    subjects: [{ name: "Physics", percent: 34 }, { name: "Chemistry", percent: 33 }, { name: "Mathematics", percent: 33 }],
    blocks: [
      { label: "Hardest subject first (problem solving)", minutes: 90, kind: "deep" },
      { label: "NCERT / formula consolidation", minutes: 45, kind: "review" },
      { label: "Timed mock section (30 Qs)", minutes: 60, kind: "practice" },
      { label: "Error log + redo wrong questions", minutes: 30, kind: "review" },
    ],
    milestones: ["Full syllabus first pass", "First full mock above 40%", "10 mocks with error logs", "90% of chapters revised twice", "Full-length mocks every alternate day"],
    dailyHabit: "One timed section, every day, no exceptions.",
    checkIn: "Which chapter did today's mock expose?",
  },
  neet: {
    tagline: "Biology compounds, Chemistry decides ranks, Physics protects them.",
    subjects: [{ name: "Biology", percent: 50 }, { name: "Chemistry", percent: 27 }, { name: "Physics", percent: 23 }],
    blocks: [
      { label: "NCERT Biology line-by-line", minutes: 75, kind: "deep" },
      { label: "Chemistry (Organic/Inorganic rotation)", minutes: 60, kind: "deep" },
      { label: "Physics numericals", minutes: 45, kind: "practice" },
      { label: "Diagram + definition recall", minutes: 20, kind: "review" },
    ],
    milestones: ["NCERT biology round 1", "Chapter-wise NEET questions done", "First full mock", "Biology above 300/360", "Three mocks a week with post-mortems"],
    dailyHabit: "Twenty biology flashcards before bed.",
    checkIn: "Which NCERT line did you skip today?",
  },
  upsc: {
    tagline: "Read less, revise more, write every day.",
    subjects: [{ name: "GS core", percent: 40 }, { name: "Optional", percent: 30 }, { name: "Current affairs", percent: 20 }, { name: "CSAT", percent: 10 }],
    blocks: [
      { label: "Optional / GS deep reading", minutes: 90, kind: "deep" },
      { label: "Newspaper → notes in 30 min", minutes: 30, kind: "output" },
      { label: "Answer writing (2 answers, timed)", minutes: 45, kind: "output" },
      { label: "Revision of yesterday's notes", minutes: 30, kind: "review" },
    ],
    milestones: ["Syllabus mapped to sources", "Optional first pass", "300 answers written", "12 years PYQs solved", "Full prelims mock series"],
    dailyHabit: "Write before you read tomorrow.",
    checkIn: "What did you write today?",
  },
  cat: {
    tagline: "Accuracy before speed. Speed before volume.",
    subjects: [{ name: "VARC", percent: 34 }, { name: "DILR", percent: 33 }, { name: "QA", percent: 33 }],
    blocks: [
      { label: "QA fundamentals (topic-wise)", minutes: 60, kind: "deep" },
      { label: "Two full RC sets, timed", minutes: 45, kind: "practice" },
      { label: "One DILR set, timed + analysed", minutes: 45, kind: "practice" },
      { label: "Mock analysis (not the mock)", minutes: 30, kind: "review" },
    ],
    milestones: ["Concept gaps closed in QA", "DILR 2 sets in 40 min", "First mock above 85 percentile", "Sectional cut-offs cleared", "Full mocks weekly"],
    dailyHabit: "Analyse one mock or one set, daily.",
    checkIn: "Which question type is still costing you?",
  },
  startup: {
    tagline: "Build, talk to users, ship. Repeat.",
    subjects: [{ name: "Product", percent: 40 }, { name: "Customers", percent: 35 }, { name: "Distribution", percent: 25 }],
    blocks: [
      { label: "Deep build block (one feature, no meetings)", minutes: 90, kind: "deep" },
      { label: "Talk to a user / read feedback", minutes: 30, kind: "output" },
      { label: "Write: launch post, docs, or changelog", minutes: 45, kind: "output" },
      { label: "Metrics + next experiment", minutes: 15, kind: "review" },
    ],
    milestones: ["Problem written as one sentence", "10 user conversations", "First paying customer", "Weekly shipping cadence", "First 100 users"],
    dailyHabit: "Ship something visible every day.",
    checkIn: "What did the last user tell you?",
  },
  promotion: {
    tagline: "Visible skills beat silent effort.",
    subjects: [{ name: "Core skill", percent: 50 }, { name: "Visibility", percent: 30 }, { name: "Network", percent: 20 }],
    blocks: [
      { label: "Deep skill practice (hardest part first)", minutes: 60, kind: "deep" },
      { label: "Write about what you learned", minutes: 30, kind: "output" },
      { label: "Network: one real conversation", minutes: 20, kind: "output" },
      { label: "Review goals vs. this week's evidence", minutes: 15, kind: "review" },
    ],
    milestones: ["Skill gap list written", "First public artefact", "One mentor conversation", "Owned a visible project", "Promotion case assembled"],
    dailyHabit: "One public artefact per week, minimum.",
    checkIn: "What evidence exists that you're ready for the next level?",
  },
  coding: {
    tagline: "Patterns, then volume, then mock interviews.",
    subjects: [{ name: "DSA", percent: 50 }, { name: "System design", percent: 25 }, { name: "Projects", percent: 25 }],
    blocks: [
      { label: "New pattern (2–3 problems, timed)", minutes: 75, kind: "deep" },
      { label: "Revision: re-solve yesterday's problems", minutes: 30, kind: "review" },
      { label: "System design reading + notes", minutes: 45, kind: "deep" },
      { label: "Project commit (real code)", minutes: 30, kind: "output" },
    ],
    milestones: ["300 problems with patterns noted", "Every core pattern re-solved once", "Two projects deployed", "5 mock interviews", "Offer-ready resume"],
    dailyHabit: "Two problems re-solved from memory, daily.",
    checkIn: "Which pattern still makes you think too long?",
  },
  research: {
    tagline: "Read, think, write — in that order, most days.",
    subjects: [{ name: "Reading", percent: 40 }, { name: "Writing", percent: 35 }, { name: "Methods/analysis", percent: 25 }],
    blocks: [
      { label: "Paper reading + summary notes", minutes: 75, kind: "deep" },
      { label: "Writing block (no editing while writing)", minutes: 60, kind: "output" },
      { label: "Methods / tooling practice", minutes: 30, kind: "practice" },
      { label: "Reference manager cleanup + next question", minutes: 15, kind: "review" },
    ],
    milestones: ["Literature map written", "Research question sharpened", "First draft of methods", "Submission to a venue", "Revision with reviewer feedback"],
    dailyHabit: "Write 200 words before reading anything new.",
    checkIn: "What did you write today?",
  },
  language: {
    tagline: "Input every day, output four times a week.",
    subjects: [{ name: "Listening/Reading", percent: 40 }, { name: "Speaking", percent: 35 }, { name: "Vocabulary/grammar", percent: 25 }],
    blocks: [
      { label: "Listening / reading with subtitles off", minutes: 30, kind: "deep" },
      { label: "Speaking out loud (record yourself)", minutes: 20, kind: "output" },
      { label: "Vocabulary in sentences (not lists)", minutes: 20, kind: "practice" },
      { label: "Shadow the recording, fix 3 errors", minutes: 15, kind: "review" },
    ],
    milestones: ["100-word intro recorded", "First 30-min conversation", "News podcast understood without subtitles", "Wrote a page of diary", "500 words in active use"],
    dailyHabit: "Speak out loud for ten minutes, no exceptions.",
    checkIn: "What did you say out loud today?",
  },
  fitness: {
    tagline: "Show up, move, recover. Consistency is the programme.",
    subjects: [{ name: "Strength", percent: 45 }, { name: "Cardio", percent: 30 }, { name: "Mobility/recovery", percent: 25 }],
    blocks: [
      { label: "Strength session", minutes: 45, kind: "deep" },
      { label: "Cardio (walk/run/cycle)", minutes: 25, kind: "practice" },
      { label: "Mobility + stretching", minutes: 15, kind: "review" },
      { label: "Log food, sleep, weight", minutes: 10, kind: "review" },
    ],
    milestones: ["Two weeks unbroken", "Consistent protein + sleep", "Strength numbers up 10%", "Four weeks unbroken", "Body-fat / endurance target"],
    dailyHabit: "Ten thousand steps or a full session.",
    checkIn: "Did you sleep enough to train well tomorrow?",
  },
  creative: {
    tagline: "Practise daily, finish weekly, publish monthly.",
    subjects: [{ name: "Practice", percent: 50 }, { name: "Study of craft", percent: 25 }, { name: "Publishing", percent: 25 }],
    blocks: [
      { label: "Practice block (technique drills)", minutes: 60, kind: "deep" },
      { label: "Study a master / reference", minutes: 30, kind: "review" },
      { label: "Make one finished piece", minutes: 60, kind: "output" },
      { label: "Share it somewhere public", minutes: 15, kind: "output" },
    ],
    milestones: ["30-day practice streak", "First finished piece", "First public share", "10 pieces in a series", "First paid / commissioned work"],
    dailyHabit: "Make something, even badly.",
    checkIn: "What did you finish today?",
  },
  custom: {
    tagline: "Your dream, your blocks — keep them honest and repeatable.",
    subjects: [{ name: "Deep work", percent: 60 }, { name: "Practice", percent: 25 }, { name: "Review", percent: 15 }],
    blocks: [
      { label: "Deep work block", minutes: 60, kind: "deep" },
      { label: "Practice / application", minutes: 45, kind: "practice" },
      { label: "Notes + next step", minutes: 20, kind: "review" },
    ],
    milestones: ["Weekly target defined", "First week completed", "One month of consistency", "First visible result", "Quarterly review"],
    dailyHabit: "Same time, same place, every day.",
    checkIn: "What moved today?",
  },
};

