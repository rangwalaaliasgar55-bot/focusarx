// ══════════════════════════════════════════════════════════════════
// FocusArx intent-page content — ONE source of truth
// ══════════════════════════════════════════════════════════════════
// Every public "wedge" page (a page built to rank for one specific
// search intent) is described here exactly once. Three consumers read
// this file, which is the whole point:
//
//   1. scripts/prerender-data.mjs  → emits the static HTML crawlers read
//   2. src/pages/seo-landing.tsx   → renders the SAME copy after hydration
//   3. api-server seoContract.test.ts → proves route ↔ prerender ↔ sitemap
//                                        ↔ robots.txt never drift apart
//
// Why one file and not three copies: the prerenderer writes content into
// #root that React then replaces. If the static HTML said something the
// rendered page did not, that is cloaking — and Google treats content that
// only crawlers see as a spam signal. Keeping the copy in one place makes
// the divergence structurally impossible.
//
// ── Editorial rules (enforced by review, not by code) ─────────────
// • No invented numbers. No user counts, ratings, study sizes or
//   percentages unless they appear in the claim ledger on /evidence.
// • No medical or treatment claims. ADHD copy describes workflow design,
//   never diagnosis or therapy.
// • Attribute ideas to their origin (Pomodoro → Cirillo, deep work →
//   Newport, body doubling → the ADHD community) instead of implying we
//   ran the research.
// • Answer first: `answerFirst` is a self-contained 40–60 word answer that
//   stands alone if quoted out of context (AI Overviews / featured snippet).
//
// @typedef {Object} SeoPage
// @property {string} kind              "tool" | "guide" | "trust"
// @property {string} title             full <title>
// @property {string} description       meta description
// @property {string} h1
// @property {string} lead
// @property {string} answerFirst
// @property {{h: string, p: string|string[]}[]} sections
// @property {[string,string][]} [faq]
// @property {{name: string, steps: {name: string, text: string}[]}} [howTo]
// @property {{name: string, category: string, description: string}} [software]
// @property {{href: string, label: string}} cta
// @property {string[]} related         "path|Label"
// @property {string} [lastReviewed]    YYYY-MM-DD shown on the page
// @property {string[]} [sources]       visible attribution lines

export const LAST_REVIEWED = "2026-08-29";

/** Reusable related-link sets, so internal linking is dense and consistent. */
const TOOLS = [
  "/pomodoro-timer|Pomodoro timer",
  "/focus-timer|Focus timer",
  "/study-timer|Study timer",
  "/study-calculator|Study time calculator",
  "/study-method-quiz|Study method quiz",
];

const GUIDES = [
  "/focus-guide|How to focus: complete guide",
  "/deep-work-guide|Deep work guide",
  "/pomodoro-guide|Pomodoro technique guide",
  "/study-techniques|Best study techniques",
  "/how-to-focus-while-studying|How to focus while studying",
  "/body-doubling|Body doubling explained",
  "/stop-procrastinating|How to stop procrastinating",
  "/stop-scrolling|How to stop scrolling",
  "/adhd-focus-tools|ADHD-friendly focus tools",
  "/adhd-focus-tips|How to focus with ADHD",
  "/focus-music|Best music for studying",
  "/science-of-deep-work|Science of deep work",
];

const ROOMS = [
  "/virtual-study-room|Virtual study rooms",
  "/study-with-me|Study with me sessions",
  "/study-rooms|Live study rooms",
  "/safety|Room safety and moderation",
];

export const SEO_PAGES = {
  // ══════════════════════════════════════════════════════════════
  // TOOL WEDGES — the highest-intent utility queries in the category
  // ══════════════════════════════════════════════════════════════
  "/pomodoro-timer": {
    kind: "tool",
    title: "Free Pomodoro Timer Online — 25/5 Focus Sprints | FocusArx",
    description:
      "Start a free Pomodoro timer in your browser. 25/5 focus sprints, custom intervals, session history, streaks and live study rooms. No signup needed to begin.",
    h1: "Free Pomodoro Timer Online",
    lead: "Run classic 25/5 Pomodoro sprints or set your own interval. Your sessions, streaks and focus score are saved the moment you create a free account — the timer itself works without one.",
    answerFirst:
      "The Pomodoro technique splits work into 25-minute focus intervals separated by 5-minute breaks, with a longer break after four intervals. Francesco Cirillo developed it in the late 1980s and named it after a tomato-shaped kitchen timer. FocusArx runs those intervals in your browser and records every completed sprint.",
    software: {
      name: "FocusArx Pomodoro Timer",
      category: "ProductivityApplication",
      description:
        "Browser-based Pomodoro and deep work timer with session scoring, streaks, task tracking and live study rooms.",
    },
    howTo: {
      name: "How to run a Pomodoro session on FocusArx",
      steps: [
        { name: "Pick one task", text: "Write down a single, specific task. Pomodoro works because the interval is short enough that one task fits inside it." },
        { name: "Set the interval", text: "Keep the default 25 minutes for your first sprints. FocusArx also allows custom lengths from 10 to 180 minutes for deep-work blocks." },
        { name: "Start and work until the timer ends", text: "Work only on that task. If something else comes up, note it on paper and return after the break — that note is the point of the method." },
        { name: "Take the break", text: "Stand up, walk, look away from the screen. Five minutes is enough to clear attention residue without losing momentum." },
        { name: "Repeat, then take a long break", text: "After four intervals, take 15–30 minutes. FocusArx logs each completed interval and adds it to your streak and focus score." },
      ],
    },
    sections: [
      {
        h: "Why 25 minutes",
        p: [
          "Twenty-five minutes is short enough that starting does not feel like a commitment and long enough to get past the friction of settling in. The interval also gives procrastination a deadline: you are not agreeing to finish the essay, only to spend 25 minutes on it.",
          "The break matters as much as the sprint. Attention residue — the part of your mind still on the previous task — decays during the pause, which is why the next interval usually starts faster than the last one.",
        ],
      },
      {
        h: "When Pomodoro is the wrong tool",
        p: [
          "A fixed 25-minute cap interrupts flow. If you are writing, coding or solving proofs and you hit a state where the work is pulling you forward, a forced break costs more than it returns. Use a longer 50/10 or 90-minute block instead, and treat the timer as a floor rather than a ceiling.",
          "Pomodoro is also weak for creative exploration and research reading, where the useful unit is not time but a question answered. Match the method to the task: sprints for execution, open blocks for thinking.",
        ],
      },
      {
        h: "What FocusArx adds to a plain timer",
        p: [
          "A plain timer ends. FocusArx scores the session, stores it against the task you set, and folds it into a streak and a focus score you can see week over week. Optional study rooms put other learners working beside you during the same interval, which is the body-doubling effect. An AI coach then turns the accumulated history into concrete suggestions about when and how long you should work.",
          "The core timer, tasks, streaks and analytics are free. Premium is unlocked with Focus Tokens you earn by completing sessions — there is no payment step.",
        ],
      },
    ],
    faq: [
      ["Is the Pomodoro timer free?", "Yes. The timer, task list, streaks and session history are free forever. Premium features such as custom 10–180 minute presets, sound mixing and 180-day analytics are unlocked with Focus Tokens earned from completed sessions, not with money."],
      ["Do I need an account to start a timer?", "No. You can start immediately. An account is only needed if you want sessions, streaks and analytics saved across devices."],
      ["How long should a Pomodoro break be?", "Five minutes between intervals and 15–30 minutes after every four intervals. Keep breaks screen-free where you can — scrolling does not restore attention the way movement does."],
      ["Can I change the 25/5 lengths?", "Yes. FocusArx supports custom intervals from 10 to 180 minutes so you can run 50/10 deep-work blocks or longer writing sessions."],
      ["Does the timer work offline?", "FocusArx is installable as a PWA, so the timer keeps running after it has loaded. Session history syncs when you are back online."],
    ],
    cta: { href: "/signup", label: "Start a free Pomodoro session" },
    related: ["/pomodoro-guide|Pomodoro technique: complete guide", ...TOOLS.slice(1), ...GUIDES.slice(0, 3)],
    lastReviewed: LAST_REVIEWED,
    sources: [
      "Francesco Cirillo, The Pomodoro Technique (late 1980s) — origin of the 25/5 interval.",
      "Sophie Leroy, 'Why is it so hard to do my work?' (2009) — attention residue between tasks.",
    ],
  },

  "/study-timer": {
    kind: "tool",
    title: "Study Timer for Students — Plan, Time and Track | FocusArx",
    description:
      "A free study timer built for exam prep: plan sessions against subjects, run timed blocks, track revision progress and join live study rooms. Free forever.",
    h1: "Study Timer for Exam Prep",
    lead: "Timed study blocks tied to subjects and a plan, so revision progress is measurable instead of a feeling.",
    answerFirst:
      "A study timer works better than a to-do list because it converts 'study chemistry' into a bounded, finishable block. Set the subject, set the length, start the timer, and record what you covered. FocusArx stores each block against the subject so you can see which topics are getting real time and which are being avoided.",
    software: {
      name: "FocusArx Study Timer",
      category: "EducationalApplication",
      description:
        "Timed study blocks with subject tracking, revision planning, spaced-repetition flashcards and live study rooms for exam preparation.",
    },
    sections: [
      {
        h: "How to set up a study block",
        p: [
          "Pick one topic, not one subject. 'Thermodynamics — enthalpy problems' is a block; 'Chemistry' is a semester. Write the intended output before you start: three solved problems, one summary page, one set of flashcards.",
          "Choose the length from the work, not from habit. Recall practice fits in 25 minutes. Working through a full past paper needs 90 or more. FocusArx supports both.",
        ],
      },
      {
        h: "Spacing beats cramming",
        p: [
          "Distributing the same total hours across more days reliably produces better retention than concentrating them. The study-time calculator works this way: give it an exam date and a topic list and it spreads the hours so each topic is revisited before you would otherwise forget it.",
          "The practical consequence is that a study timer is only half the system. The other half is deciding what to revisit tomorrow — which is what the plan and the flashcards are for.",
        ],
      },
      {
        h: "Studying with other people",
        p: [
          "Live study rooms run the same timed block for everyone in the room at once. You can see that others are still working, which makes stopping early feel costlier and restarting feel easier. Camera use is optional and off by default.",
        ],
      },
    ],
    faq: [
      ["Is the study timer free?", "Yes, including subject tracking, the study plan and the study-time calculator. No credit card and no trial countdown."],
      ["Can I track different subjects separately?", "Yes. Each session is attached to a task or subject, and analytics break your time down by topic so you can see where the hours actually went."],
      ["Does it help with exam planning?", "The study-time calculator takes an exam date and a topic list and produces a dated revision schedule with spaced repeats built in."],
      ["Can I study with friends?", "Yes. Public and private study rooms run synchronised timers, so a group works the same block together."],
    ],
    cta: { href: "/study-calculator", label: "Build a revision schedule free" },
    related: ["/study-calculator|Study time calculator", "/exam|Exam prep guides", ...TOOLS.slice(0, 2), ...ROOMS.slice(0, 2), "/study-techniques|Best study techniques", ...GUIDES.slice(3, 5)],
    lastReviewed: LAST_REVIEWED,
    sources: [
      "Hermann Ebbinghaus, forgetting curve and spacing (1885); replicated across the modern spacing-effect literature.",
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // GUIDE WEDGES — topical cluster spokes
  // ══════════════════════════════════════════════════════════════
  "/deep-work-guide": {
    kind: "guide",
    article: true,
    title: "Deep Work Guide: How to Do Focused, Undistracted Work | FocusArx",
    description:
      "A practical deep work guide — what deep work is, why it is scarce, how to schedule it, and how to protect a block once it starts. With a free timer.",
    h1: "Deep Work: A Practical Guide",
    lead: "Deep work is professional activity performed in a state of distraction-free concentration that pushes your capabilities to their limit. This guide covers how to actually schedule and protect it.",
    answerFirst:
      "Deep work is cognitively demanding work done without distraction, a term Cal Newport popularised in his 2016 book of the same name. It is protected by scheduling fixed blocks in advance, removing notifications for the duration, choosing a single defined task, and stopping deliberately rather than drifting to a halt.",
    sections: [
      {
        h: "What deep work actually is",
        p: [
          "Cal Newport's 2016 framing separates deep work — effortful, concentration-heavy, hard to replicate, and it creates new value — from shallow work, which is logistical, easily replicated and often performed while distracted. The distinction is useful because the two have opposite economics: shallow work expands to fill whatever time you leave it, while deep work only happens inside time you defended in advance.",
        ],
      },
      {
        h: "Four scheduling patterns",
        p: [
          "Monastic: eliminate shallow obligations almost entirely. Works for writers and researchers with unusual control over their calendar, and for almost nobody else.",
          "Bimodal: alternate multi-day stretches of deep work with ordinary weeks. Good for academics and people who can take blocks of leave.",
          "Rhythmic: the same block at the same time every day. This is the pattern most students and professionals can sustain, because it turns the decision into a habit rather than a daily negotiation.",
          "Journalistic: drop into deep work whenever a gap appears. Only realistic once deep work is already a trained skill.",
        ],
      },
      {
        h: "Protecting a block once it starts",
        p: [
          "Most failed blocks are not failed at the start — they are abandoned at minute eleven when a notification arrives. Put the phone in another room, close the tabs that are not the task, and tell the people who might interrupt you when you will be back.",
          "Then define an ending. A block with no finish condition drifts; you check something, then something else, and the block dissolves without you noticing. Set the timer and let it decide.",
        ],
      },
      {
        h: "Measuring whether it is working",
        p: [
          "Count deep hours per week, not feelings of productivity. FocusArx records the length of every completed block and scores it, so the number is there whether or not the week felt good. Most people discover their real deep-work total is far lower than they assumed, which is the useful part.",
        ],
      },
    ],
    faq: [
      ["How long should a deep work block be?", "Ninety minutes is a common ceiling for a single uninterrupted block, with many people working more effectively in 45–60 minute units. Total deep hours per day is typically far lower than people expect; two to four is a realistic sustained range."],
      ["What is the difference between deep work and a Pomodoro?", "A Pomodoro is a fixed-length interval technique. Deep work is the kind of activity you do inside an interval. You can run deep work inside a 25-minute Pomodoro or inside a 90-minute block."],
      ["Is deep work possible with ADHD?", "Many people with ADHD do their best work in long uninterrupted blocks once they have started, and struggle mainly with the transition into work. External structure — a timer, a body double, a pre-committed block — usually helps more than trying harder. This is workflow design, not medical advice."],
      ["How do I know if I am doing deep work?", "If you could do it while checking messages, it is not deep work. Deep work requires your full attention and produces something you could not produce distracted."],
    ],
    cta: { href: "/signup", label: "Track your deep work hours free" },
    related: ["/science-of-deep-work|The science of deep work", "/focus-guide|How to focus", ...TOOLS.slice(0, 2), ...GUIDES.slice(3, 5)],
    lastReviewed: LAST_REVIEWED,
    sources: [
      "Cal Newport, Deep Work (2016) — definition and the four scheduling philosophies.",
    ],
  },

  "/body-doubling": {
    kind: "guide",
    article: true,
    title: "Body Doubling: Focus Alongside Someone Else | FocusArx",
    description:
      "What body doubling is, why working alongside another person makes starting easier, and how to use it online. Join a free live study room.",
    h1: "Body Doubling: Why Working Next to Someone Helps",
    lead: "Body doubling is simply doing your own work in the presence of someone else doing theirs. It is one of the lowest-effort focus interventions that exists.",
    answerFirst:
      "Body doubling means working on your own task while another person works on theirs nearby. The term comes from the ADHD community, where it is widely used to make task initiation easier. The other person does not help, supervise or talk — their presence alone supplies the structure that makes starting less costly.",
    sections: [
      {
        h: "Why presence helps",
        p: [
          "Task initiation is the hardest part of most focus problems, not sustaining attention once you begin. Another person working nearby raises the social cost of opening a distraction and lowers the cost of starting, because you are joining an activity that is already happening rather than generating momentum from nothing.",
          "Nobody has to be checking on you for this to work. The mechanism does not depend on accountability in the supervisory sense; it depends on shared context.",
        ],
      },
      {
        h: "How to use it online",
        p: [
          "Pick a room with a timer running so the block has a shared start and end. State your intention out loud or in the room chat, work silently for the interval, and report back at the break. That structure — announce, work, report — is what most study-with-me formats converge on.",
          "Keep the camera optional. On FocusArx cameras are off by default, video never leaves your device, and you can join any room without one.",
        ],
      },
      {
        h: "When it does not help",
        p: [
          "Body doubling is weaker for work that needs total silence and no social awareness at all, and it can backfire if the room becomes a chat. If you find yourself performing for the room instead of working, switch to a silent room or work alone with a timer.",
        ],
      },
    ],
    faq: [
      ["Does body doubling only work for ADHD?", "No. It comes from the ADHD community and is especially popular there, but plenty of people without ADHD find it makes starting easier. It is a structural aid, not a treatment, and it is not a substitute for professional care."],
      ["Do I have to turn my camera on?", "No. FocusArx study rooms work with the camera off, which is the default. Any on-device attention tracking is optional and processes video locally in your browser."],
      ["Is it the same as studying with a friend?", "Related but different. Body doubling specifically means parallel independent work, not collaboration. Conversation during the block usually defeats the purpose."],
      ["How long should a body doubling session be?", "Match it to a normal work block: 25 to 50 minutes with a short break. Rooms on FocusArx run synchronised timers so everyone starts and ends together."],
    ],
    cta: { href: "/study-rooms", label: "Join a live study room" },
    related: [...ROOMS, ...GUIDES.slice(5, 7), "/safety|Room safety and moderation"],
    lastReviewed: LAST_REVIEWED,
    sources: [
      "'Body doubling' is a term used within ADHD communities and coaching practice rather than a formal clinical construct.",
    ],
  },

  "/how-to-focus-while-studying": {
    kind: "guide",
    article: true,
    title: "How to Focus While Studying: 9 Methods That Work | FocusArx",
    description:
      "Practical ways to focus while studying — environment, timing, retrieval practice and phone handling — with the evidence behind each and a free timer.",
    h1: "How to Focus While Studying",
    lead: "Nine changes that make studying easier to sustain, ordered by how much they usually matter and how little effort they take.",
    answerFirst:
      "Focusing while studying mostly comes down to three things: remove the phone from the room, make the session short and specific, and test yourself instead of re-reading. Environment design does most of the work; willpower covers the rest.",
    sections: [
      {
        h: "1. Put the phone in another room",
        p: "Out of sight measurably beats face-down-on-the-desk. The cost is not the notification you see, it is the fraction of attention held back in case one arrives. A drawer is not enough — another room is.",
      },
      {
        h: "2. Make the session specific and short",
        p: "'Study biology' does not start. 'Do eight genetics problems' does. Short, concrete blocks also survive interruption better, because you always know what the next small step is.",
      },
      {
        h: "3. Test yourself instead of re-reading",
        p: "Re-reading and highlighting feel productive and retain little. Retrieval — closing the book and writing what you remember — is slower and far more effective. Flashcards and self-testing turn studying into an activity rather than a review.",
      },
      {
        h: "4. Space the same material across days",
        p: "Four 45-minute sessions across four days beat one three-hour session, even though the second feels less impressive. Revisiting material as it starts to fade is what makes it stick.",
      },
      {
        h: "5. Fix the start time, not the start mood",
        p: "Waiting to feel like studying is the mechanism by which whole weeks disappear. A fixed start time turns studying into something that happens at 7pm rather than something you decide about at 7pm.",
      },
      {
        h: "6. Use a timer you can see",
        p: "A visible countdown converts an open-ended obligation into a bounded commitment. FocusArx runs the timer, records the session and keeps the streak, so the cost of stopping early becomes something you can see.",
      },
      {
        h: "7. Work alongside other people",
        p: "Body doubling makes starting cheaper. A live study room gives you other learners on the same block without any obligation to interact.",
      },
      {
        h: "8. Protect sleep like it is part of the syllabus",
        p: "Sleep is when consolidation happens. Trading sleep for an extra hour of revision usually loses more than it gains, and the next day's sessions get worse too.",
      },
      {
        h: "9. Write down what you are avoiding",
        p: "Most 'I cannot focus' is really 'I do not want to start this particular thing'. Naming it takes ten seconds and usually reveals that the task is too big or too vague.",
      },
    ],
    faq: [
      ["Why can I focus on games but not on studying?", "Games deliver immediate, frequent feedback and a clear next action. Studying usually offers neither. Adding both — a timer, a visible streak, a specific next step — closes most of the gap."],
      ["How many hours should I study a day?", "Sustained, genuinely focused study is usually a small number of hours. Quality blocks you finish beat long blocks you abandon. Track completed focused minutes rather than time at the desk."],
      ["Does music help me focus?", "It varies. Instrumental music helps some people and costs others. Lyrics are the most consistently disruptive element. Test it against your own recall, not your mood."],
      ["What if I have ADHD?", "Structure tends to matter more than effort: shorter blocks, external timers, body doubling, and starting with the smallest possible version of the task. This is workflow design, not medical advice — talk to a professional about diagnosis and treatment."],
    ],
    cta: { href: "/signup", label: "Start a focused study session" },
    related: ["/study-techniques|Best study techniques", "/study-timer|Study timer", ...GUIDES.slice(0, 4), ...ROOMS.slice(0, 2)],
    lastReviewed: LAST_REVIEWED,
    sources: [
      "Roediger & Karpicke (2006) — testing effect / retrieval practice.",
      "Ward et al. (2017) — 'Brain Drain': the mere presence of a smartphone reduces available cognitive capacity.",
    ],
  },

  "/adhd-focus-tools": {
    kind: "guide",
    article: true,
    title: "ADHD-Friendly Focus Tools: Timers, Rooms and Body Doubling | FocusArx",
    description:
      "Free ADHD-friendly focus tools: visual timers, body doubling rooms, task breakdown and streaks that allow recovery. Built for brains that need external structure.",
    h1: "ADHD-Friendly Focus Tools",
    lead: "Tools designed around external structure — visible time, immediate feedback, and starting costs made small. Free to use, no diagnosis required.",
    answerFirst:
      "ADHD-friendly focus tools work by moving structure outside the brain: a visible timer instead of estimated time, a body double instead of solitary willpower, one small next action instead of a whole project, and immediate feedback instead of a distant deadline. FocusArx bundles all four, free.",
    sections: [
      {
        h: "A note before the list",
        p: "These are workflow tools, not treatment, and FocusArx does not diagnose or manage any condition. If you are investigating ADHD or already managing it, a qualified clinician is the right source for medical guidance. What follows is about designing an environment that requires less self-management.",
      },
      {
        h: "Tools that help with starting",
        p: [
          "Task breakdown turns 'write the report' into 'open the document and write one sentence'. The first action should be so small that it is not worth resisting.",
          "Body doubling supplies an external start signal: other people are already working, so joining is easier than initiating. FocusArx study rooms run synchronised blocks and cameras are off by default.",
        ],
      },
      {
        h: "Tools that help with staying",
        p: [
          "A visible countdown makes time concrete. Time-blindness — underestimating how long things take and losing track of how long has passed — is a common experience, and an external clock is a direct answer to it.",
          "Immediate feedback matters more than eventual reward. Session scoring, XP and streaks deliver something within minutes rather than at the end of a semester.",
        ],
      },
      {
        h: "Tools that help with returning",
        p: [
          "Rigid streaks punish the exact interruption that is most likely. FocusArx streaks support recovery and rest rather than demanding a perfect run, so a missed day does not erase the record. Losing everything on day nine is a design that guarantees quitting on day nine.",
        ],
      },
      {
        h: "Privacy, specifically",
        p: [
          "The optional attention-monitoring feature runs entirely on your device using MediaPipe. Video is processed locally and is not uploaded, and the feature is off unless you turn it on. There is no camera-free penalty — every room and every feature works with the camera disabled.",
        ],
      },
    ],
    faq: [
      ["Is FocusArx an ADHD app?", "No. It is a focus platform that happens to work well for people who need external structure, including many people with ADHD. It is not a medical device, it does not diagnose, and it is not a substitute for clinical care."],
      ["Do I need a diagnosis to use it?", "No. The tools are free and open to anyone. Nothing is gated behind a condition."],
      ["Does the webcam feature send my video anywhere?", "No. Attention monitoring is optional, off by default, and runs locally in your browser with MediaPipe. Frames are not uploaded to our servers. You can delete related data at any time."],
      ["Are streaks going to punish me for a bad day?", "No. Streaks include recovery so a single missed day does not reset your history to zero."],
      ["Does it cost money?", "The core timer, tasks, streaks and rooms are free forever. Premium unlocks with Focus Tokens earned from completed sessions."],
    ],
    cta: { href: "/signup", label: "Try the free ADHD-friendly timer" },
    related: ["/adhd-focus-tips|How to focus with ADHD", "/body-doubling|Body doubling explained", ...ROOMS.slice(0, 3), ...TOOLS.slice(0, 2), "/camera-data|How camera data is handled"],
    lastReviewed: LAST_REVIEWED,
    sources: [
      "FocusArx makes no clinical claims on this page. Consult a qualified professional about ADHD diagnosis and treatment.",
    ],
  },

  "/stop-scrolling": {
    kind: "guide",
    article: true,
    title: "How to Stop Scrolling: Break the Loop in 60 Seconds | FocusArx",
    description:
      "Why endless scrolling is hard to stop, and a practical reset you can run right now — friction, replacement, and a 60-second interruption pattern. Free tool.",
    h1: "How to Stop Scrolling",
    lead: "Scrolling is not a willpower failure. It is a loop engineered to continue, and it breaks when you insert friction and give your hands something else to do.",
    answerFirst:
      "To stop scrolling, break the loop physically rather than mentally: stand up, put the phone in another room, and start a 60-second timer before you decide what to do next. Removing the device works better than deciding not to use it, because the decision has to be made again every time you pick it up.",
    sections: [
      {
        h: "Why it is hard to stop",
        p: [
          "Infinite feeds remove the natural stopping points that used to exist — the end of the page, the end of the chapter, the end of the programme. Variable reward, where the next item might be interesting or might not, is the pattern that keeps behaviour going longest; it is the same schedule that makes slot machines effective.",
          "None of this is a character flaw. The loop is designed by teams whose job is to make it continue, and it is being run against you at the moment you are least able to argue back.",
        ],
      },
      {
        h: "The 60-second reset",
        p: [
          "When you notice you have been scrolling, do not try to summon discipline. Stand up, put the phone face-down in another room, and run the 60-second reset: name where you are, name the smallest next action on your actual task, and start it.",
          "The point is that the reset is shorter than the argument. You are not deciding whether to work for three hours. You are deciding what happens in the next minute.",
        ],
      },
      {
        h: "Make the phone cost something",
        p: [
          "Distance is the most reliable intervention: another room beats another desk. Grayscale, notification removal and app repositioning all add a small amount of friction, and friction is cumulative. Each extra step between you and the feed is another chance to notice.",
        ],
      },
      {
        h: "Replace, do not just remove",
        p: [
          "Scrolling usually fills a gap — boredom, transition, avoidance of a task that feels too large. If you remove it without replacing it, the gap returns and the loop comes back with it. A timer, a short walk or a five-minute task is a better filler than nothing at all.",
        ],
      },
    ],
    faq: [
      ["How do I stop scrolling when I need my phone for work?", "Separate the tools. Keep work apps on the home screen and move social apps into a folder on the second page or off the device entirely. Notifications off by default, on by exception."],
      ["Will deleting the apps fix it?", "It raises the cost of access, which is genuinely useful, but it does not address the gap the scrolling was filling. Pair removal with a replacement activity."],
      ["How long does it take to break the habit?", "There is no reliable universal number. What is reliable is that friction works immediately and consistency compounds: each day the loop is interrupted makes the next interruption easier."],
      ["Is the 60-second reset free?", "Yes. It is a free tool at /break-free with no account required."],
    ],
    cta: { href: "/break-free", label: "Run the 60-second reset" },
    related: ["/break-free|60-second scroll reset", "/stop-procrastinating|How to stop procrastinating", "/breathe|2-minute breathing reset", ...GUIDES.slice(0, 3)],
    lastReviewed: LAST_REVIEWED,
    sources: [
      "B. F. Skinner, variable-ratio reinforcement schedules — the mechanism behind intermittent reward design.",
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // TRUST PAGES — the substantiation the audits require
  // ══════════════════════════════════════════════════════════════
  "/evidence": {
    kind: "trust",
    title: "Our Evidence and Claim Policy | FocusArx",
    description:
      "Every number FocusArx publishes, with its definition, source, sample and date — plus the claims we refuse to make. Our public claim ledger.",
    h1: "Evidence and Claim Policy",
    lead: "This page is our claim ledger. Every metric we publish anywhere on the site should appear here with a definition, a source and a date. If a number you saw is not listed, treat it as unsupported and tell us.",
    answerFirst:
      "FocusArx publishes a claim ledger: each public metric appears here with its definition, data source, sample size and review date. We do not publish ratings, user counts or improvement percentages we cannot source, and we do not make clinical or treatment claims.",
    sections: [
      {
        h: "How to read a claim here",
        p: [
          "Each entry states the number, exactly what is being counted, where the data comes from, how large the sample is, the period it covers, and when it was last reviewed. A claim without those five things does not belong on the site.",
        ],
      },
      {
        h: "Claims we have removed",
        p: [
          "Earlier versions of this site carried an aggregate product rating in structured data and user-count figures in meta descriptions that we could not source to a review platform, a counting definition or a date. Unsubstantiated ratings in structured data also violate Google's review-snippet policy, which restricts self-serving reviews on your own product. Both have been removed.",
          "They will come back only when there is a named platform, a review count and a date behind them.",
        ],
      },
      {
        h: "What we do publish",
        p: [
          "Product-internal analytics — completion rates, session lengths, feature usage — when they come with a definition, a sample and a period. Those are labelled as FocusArx product data and are never presented as independent research.",
          "External claims are attributed to their source, and we link to it. Where the evidence is thin or contested, we say so on the page rather than smoothing it out.",
        ],
      },
      {
        h: "Claims we do not make",
        p: [
          "No medical, diagnostic or treatment claims, including for ADHD or any other condition. No user counts, ratings or testimonial quotes we cannot source. No invented studies, citations or competitor weaknesses. Where we cannot verify something, we say VERIFY and leave the gap visible.",
        ],
      },
      {
        h: "Corrections",
        p: [
          "If you find a claim on this site that is wrong, unsourced or misleading, send it to us through the contact page and we will correct or remove it. Corrections are logged here with a date.",
        ],
      },
    ],
    faq: [
      ["Why did the rating disappear from your site?", "We published an aggregate rating in structured data without a review platform, review count or date behind it. Google's structured-data policy does not permit self-serving reviews, and we could not source the number, so it was removed."],
      ["Do you run research studies?", "No. We publish anonymised product analytics when they are properly labelled and defined. We do not conduct or claim clinical research."],
      ["Can I see the data behind a claim?", "Ask and we will share the definition, sample and period. Aggregated data only — never individual user data."],
    ],
    cta: { href: "/contact", label: "Report an inaccurate claim" },
    related: ["/privacy|Privacy policy", "/camera-data|Camera data handling", "/ai-policy|AI policy", "/about|About FocusArx", "/press|Press kit"],
    lastReviewed: LAST_REVIEWED,
    sources: [
      "Google Search Central, 'Schemas: review snippet guidelines' — restrictions on self-serving reviews.",
    ],
  },

  "/camera-data": {
    kind: "trust",
    title: "How Camera Data Is Handled | FocusArx",
    description:
      "FocusArx attention monitoring is optional and off by default. Video is processed on your device with MediaPipe and never uploaded. How to disable and delete it.",
    h1: "Camera and Attention Monitoring: How Your Data Is Handled",
    lead: "Plain-language explanation of what the optional camera feature does, what it does not do, and how to turn it off and delete anything it produced.",
    answerFirst:
      "FocusArx's attention-monitoring feature is optional, off by default, and processes video entirely on your device using MediaPipe. Frames are analysed in the browser and are not uploaded to our servers. Every feature works with the camera disabled, and you can delete the derived data at any time.",
    sections: [
      {
        h: "What is on by default",
        p: "Nothing involving the camera. The feature does not activate until you explicitly enable it and grant browser permission, and the browser will ask you again if permission is revoked.",
      },
      {
        h: "What happens when it is on",
        p: [
          "The browser gives the page a local video stream. MediaPipe, running as WebAssembly in your browser, derives coarse attention signals from it — roughly, whether a face is present and oriented toward the screen. Those derived signals are used to score the session.",
          "Raw frames are not encoded, not uploaded and not stored. What leaves your device is the session score and the derived signals, not video.",
        ],
      },
      {
        h: "Turning it off",
        p: "Disable it in session settings at any time, or revoke camera permission at the browser level — the site loses access immediately. Nothing degrades: timers, rooms, tasks, streaks and analytics all work without a camera.",
      },
      {
        h: "Deleting what it produced",
        p: "Derived attention signals are attached to your session records and are removed with them. The data-deletion page walks through removing a single session or your whole account.",
      },
      {
        h: "Minors",
        p: "Attention monitoring is never required, and we recommend it stays off for younger users. Study rooms do not require a camera to join or participate.",
      },
    ],
    faq: [
      ["Is my webcam video uploaded?", "No. Processing happens in your browser with MediaPipe. Frames are not encoded or sent anywhere."],
      ["Do I need the camera to use FocusArx?", "No. It is entirely optional and off by default. Every feature works with the camera disabled."],
      ["Can I delete the data it created?", "Yes. Attention signals are stored with your session records and are deleted along with them."],
      ["Do study rooms require a camera?", "No. Cameras are off by default in rooms and are never a condition of joining."],
    ],
    cta: { href: "/data-deletion", label: "Delete your data" },
    related: ["/privacy|Privacy policy", "/data-deletion|Data deletion", "/safety|Study room safety", "/evidence|Evidence and claim policy"],
    lastReviewed: LAST_REVIEWED,
  },

  "/safety": {
    kind: "trust",
    title: "Study Room Safety, Moderation and Reporting | FocusArx",
    description:
      "How FocusArx study rooms are moderated: cameras off by default, reporting, host responsibilities, age-appropriate defaults and escalation paths.",
    h1: "Study Room Safety and Moderation",
    lead: "Live study rooms put strangers in a shared space. Here is how that space is kept usable, and what to do when it is not.",
    answerFirst:
      "FocusArx study rooms run with cameras off by default, support in-room reporting, and are governed by an acceptable-use policy. Hosts are responsible for their rooms, reports are reviewed by moderators, and serious or repeated violations lead to removal from rooms or account suspension.",
    sections: [
      {
        h: "Defaults that reduce risk",
        p: "Cameras are off by default and are never required. Chat is text-based and rate-limited. Rooms are focused on a synchronised timer, which keeps the interaction narrow by design.",
      },
      {
        h: "Reporting",
        p: "Every room has a report action. Reports go to moderators with enough context to act on — room, timestamp, reported content — and nothing more than that.",
      },
      {
        h: "Moderation and escalation",
        p: "Moderators can remove a participant from a room, mute them, or escalate to account-level action. Harassment, sexual content, hate, threats and any content involving minors are treated as immediate escalations, not warnings.",
      },
      {
        h: "Younger users",
        p: "Study rooms are intended for learners, and many are students. Camera-free defaults, text-only chat and no direct-messaging requirement from rooms are deliberate choices to keep the surface narrow. If you are a parent, guardian or educator with concerns, contact us directly.",
      },
      {
        h: "Host responsibilities",
        p: "A host sets the room's timer and tone. Hosts are expected to keep the room on-task, act on reports inside their room, and stop a room rather than let it degrade. Repeated failure to moderate leads to losing host access.",
      },
    ],
    faq: [
      ["Do I have to use my camera in a study room?", "No. Cameras are off by default and never required to join or stay in a room."],
      ["How do I report someone?", "Use the report action inside the room. It sends the room, timestamp and reported content to moderators."],
      ["What happens after I report someone?", "A moderator reviews it and can remove, mute or escalate. Serious violations are actioned immediately."],
      ["Can I study privately with just my friends?", "Yes. Private rooms are limited to people you invite."],
    ],
    cta: { href: "/acceptable-use", label: "Read the acceptable use policy" },
    related: ["/acceptable-use|Acceptable use policy", "/camera-data|Camera data handling", "/study-rooms|Live study rooms", "/contact|Contact and escalation"],
    lastReviewed: LAST_REVIEWED,
  },

  "/accessibility": {
    kind: "trust",
    title: "Accessibility at FocusArx",
    description:
      "FocusArx accessibility: keyboard navigation, screen-reader support, contrast, reduced motion, captions and how to report a barrier.",
    h1: "Accessibility",
    lead: "What we hold ourselves to, what is automated in CI, and how to tell us when we fall short.",
    answerFirst:
      "FocusArx targets WCAG 2.2 AA: keyboard-operable controls, accessible names on interactive elements, sufficient contrast, reduced-motion support, and automated axe-core accessibility tests in continuous integration. Barriers should be reported and will be treated as bugs.",
    sections: [
      {
        h: "What we build for",
        p: [
          "WCAG 2.2 Level AA is the target. In practice that means every control reachable and operable from the keyboard, visible focus states, a logical heading order, accessible names on buttons and inputs, and contrast that survives both the dark and light themes.",
        ],
      },
      {
        h: "Motion",
        p: "Animations respect the prefers-reduced-motion setting. The app also has heavy 3D and particle surfaces, which are skipped or simplified when reduced motion is requested or when the device cannot sustain them.",
      },
      {
        h: "Automated checks",
        p: "Playwright tests run axe-core against key flows on every change, so regressions in contrast, naming and landmarks are caught before they ship. Automated tooling catches a minority of real barriers, which is why manual testing and user reports still matter more.",
      },
      {
        h: "Known limitations",
        p: "The 3D Focus City and some canvas-heavy surfaces are not fully exposed to assistive technology; the underlying data is available in text form elsewhere in the app. We would rather name that than imply complete coverage.",
      },
      {
        h: "Report a barrier",
        p: "Tell us what you were trying to do, what happened, and which browser and assistive technology you were using. Accessibility reports are treated as bugs, not feature requests.",
      },
    ],
    faq: [
      ["Which standard do you target?", "WCAG 2.2 Level AA."],
      ["Do you test with real assistive technology?", "Automated axe-core tests run in CI on every change, supplemented by manual keyboard and screen-reader checks. We do not claim full AT coverage on every surface."],
      ["How do I report an accessibility problem?", "Use the contact page and describe the task, the result, and your browser and assistive technology."],
    ],
    cta: { href: "/contact", label: "Report an accessibility barrier" },
    related: ["/contact|Contact us", "/privacy|Privacy policy", "/evidence|Evidence and claim policy"],
    lastReviewed: LAST_REVIEWED,
    sources: ["W3C, Web Content Accessibility Guidelines (WCAG) 2.2."],
  },

  "/press": {
    kind: "trust",
    title: "Press Kit and Media Enquiries | FocusArx",
    description:
      "FocusArx press kit: what the product is, dated facts you can use, screenshots, founder background and a direct media contact.",
    h1: "Press Kit",
    lead: "Everything a writer needs to describe FocusArx accurately, including the facts we can stand behind and the ones we will not claim.",
    answerFirst:
      "FocusArx is a free, browser-based focus platform combining a Pomodoro and deep-work timer, task and habit tracking, session analytics, live study rooms and an AI coach, with optional on-device attention monitoring. This page carries dated, sourced facts, screenshots and a media contact.",
    sections: [
      {
        h: "One-line description",
        p: "FocusArx is a free AI-powered focus platform — Pomodoro and deep-work timer, live study rooms, session analytics and an AI coach — for students and professionals.",
      },
      {
        h: "Facts you can use",
        p: [
          "Free forever core: timer, tasks, streaks, analytics and public study rooms, with no credit card.",
          "Premium is unlocked with Focus Tokens earned by completing sessions rather than purchased.",
          "Optional attention monitoring runs on-device with MediaPipe; video is not uploaded.",
          "Exam-prep content is India-first: JEE, NEET, UPSC, SSC, GATE, CAT, CBSE, NDA, CTET and IBPS.",
        ],
      },
      {
        h: "Facts we will not give you",
        p: "We do not supply user counts, ratings or improvement percentages without a source, sample and date. Our claim ledger lists what is supportable. If a number is not there, please do not print it.",
      },
      {
        h: "Assets",
        p: "Logo and Open Graph imagery are available at /logo.png and /opengraph.jpg. Product screenshots on request. Please do not imply endorsement by any institution or person we have not named here.",
      },
      {
        h: "Contact",
        p: "Media enquiries go through the contact page. We reply to journalists directly and we do not require exclusivity.",
      },
    ],
    faq: [
      ["Can I get user numbers for a story?", "Only sourced ones. See our evidence page for what we can stand behind and how each figure is defined."],
      ["Are you free to use?", "The core product is free forever. Premium unlocks with in-product tokens rather than payment."],
      ["Do you upload webcam video?", "No. Attention monitoring is optional, off by default, and processes video locally in the browser."],
    ],
    cta: { href: "/contact", label: "Contact the FocusArx team" },
    related: ["/about|About FocusArx", "/evidence|Evidence and claim policy", "/roadmap|Product roadmap", "/privacy|Privacy policy"],
    lastReviewed: LAST_REVIEWED,
  },
};

/**
 * Comparison pages. Rendered by src/pages/comparison.tsx and mirrored in
 * prerender-data.mjs + the sitemap. Facts about competitors are limited to
 * what those companies state publicly; we do not invent weaknesses.
 */
export const COMPARISONS = {
  forest: {
    slug: "focusarx-vs-forest",
    name: "Forest",
    title: "FocusArx vs Forest: Honest Comparison",
    description:
      "FocusArx vs Forest compared feature by feature — gamification, analytics, study tools and price. An honest look at which fits your workflow.",
    lead: "Forest built the most memorable focus mechanic in the category: plant a tree, leave the app, kill the tree. FocusArx takes a different route — measurable sessions, tasks, analytics and study tools in one browser-based system. Neither is universally better; here is the actual difference.",
    ours: ["Adaptive Pomodoro and deep work timer", "Task and goal tracking", "Session analytics and focus score", "Live study rooms", "Exam prep guides and flashcards", "AI coach", "Browser-based, no install"],
    theirs: ["Tree-growing focus mechanic", "Real trees planted via Trees for the Future", "Native iOS and Android apps", "Group planting sessions"],
    rows: [
      ["Focus timer", true, true],
      ["Visual progress metaphor", "Session score, streaks, city", "Growing tree"],
      ["Tasks and goals", true, false],
      ["Session analytics", true, "Basic"],
      ["Live study rooms", true, "Group planting"],
      ["Exam prep content", true, false],
      ["Flashcards / active recall", true, false],
      ["AI coaching", true, false],
      ["Native mobile apps", "PWA (installable)", true],
      ["Real-world tree planting", false, true],
    ],
    whenOurs:
      "Choose FocusArx when focus time needs to connect to tasks, revision plans, flashcards and analytics — the student or professional workflow where the timer is one part of a larger system.",
    whenTheirs:
      "Choose Forest when the tree is the whole point: a single, emotionally memorable mechanic on a phone, plus the real-tree impact story. It is a genuinely good product and we are not going to pretend otherwise.",
  },
  "focus-to-do": {
    slug: "focusarx-vs-focus-todo",
    name: "Focus To-Do",
    title: "FocusArx vs Focus To-Do: Honest Comparison",
    description:
      "FocusArx vs Focus To-Do compared — Pomodoro timers, task management, learning tools and progress analytics. Which fits how you actually work?",
    lead: "Both combine a Pomodoro timer with task management. The difference is what happens around the timer: Focus To-Do is a focused task-and-timer app, while FocusArx adds analytics, study tools, live rooms and an AI coach.",
    ours: ["Pomodoro and custom-interval timer", "Task management", "Session analytics and focus score", "Live study rooms", "Flashcards and active recall", "AI learning roadmap and coach", "On-device attention option"],
    theirs: ["Pomodoro and task management", "Cross-platform native apps", "Project and list organisation", "Simple, mature interface"],
    rows: [
      ["Pomodoro timer", true, true],
      ["Task management", true, true],
      ["Session analytics", "Focus score, trends, breakdown", "Basic statistics"],
      ["AI coaching / roadmap", true, false],
      ["On-device attention option", true, false],
      ["Live study rooms", true, false],
      ["Spaced-repetition flashcards", true, false],
      ["Native mobile apps", "PWA (installable)", true],
    ],
    whenOurs:
      "Choose FocusArx when you want focused time, learning tools and progress intelligence in one system, and you are happy working in a browser or installed PWA.",
    whenTheirs:
      "Choose Focus To-Do when you want a mature, straightforward task list with a Pomodoro timer attached and native apps on every platform you own.",
  },
  focusmate: {
    slug: "focusarx-vs-focusmate",
    name: "Focusmate",
    title: "FocusArx vs Focusmate: Honest Comparison",
    description:
      "FocusArx vs Focusmate compared — one-to-one accountability sessions versus open study rooms, timers, tasks and analytics. Which fits your focus style?",
    lead: "Focusmate pioneered scheduled one-to-one video accountability sessions and defined the category. FocusArx offers open and private study rooms instead, plus a full timer, task and analytics system around them.",
    ours: ["Open and private live study rooms", "Synchronised room timers", "Camera optional and off by default", "No scheduling required to join", "Timer, tasks, habits and analytics", "AI coach", "Free core"],
    theirs: ["Scheduled 25/50/75-minute one-to-one video sessions", "Matched with a specific partner", "Strong commitment mechanism", "Category-defining accountability format"],
    rows: [
      ["Accountability mechanism", "Open/private rooms, synchronised timers", "Scheduled 1:1 video partner"],
      ["Booking required", false, true],
      ["Camera required", false, true],
      ["Walk-in availability", true, "Scheduled slots"],
      ["Built-in timer and tasks", true, "Session timer only"],
      ["Progress analytics", true, "Session history"],
      ["AI coaching", true, false],
      ["Free tier", true, "Limited sessions per week"],
    ],
    whenOurs:
      "Choose FocusArx when you want body doubling available right now without booking, camera off, and a full focus system — timer, tasks, analytics — around the room.",
    whenTheirs:
      "Choose Focusmate when a scheduled appointment with one named human is exactly the commitment device you need. For many people it is the single most effective thing they can do, and the scheduling friction is the feature.",
  },
  pomofocus: {
    slug: "focusarx-vs-pomofocus",
    name: "Pomofocus",
    title: "FocusArx vs Pomofocus: Honest Comparison",
    description:
      "FocusArx vs Pomofocus compared — instant browser Pomodoro versus a full focus system with tasks, analytics, streaks and live study rooms.",
    lead: "Pomofocus is the reference implementation of an instant, no-friction browser Pomodoro, and it is very good at that. FocusArx keeps the instant start and builds a system on top of it.",
    ours: ["Instant browser timer, no signup to start", "Saved sessions, streaks and focus score", "Task and goal tracking", "Analytics and trends", "Live study rooms", "AI coach", "Exam prep content"],
    theirs: ["Instant Pomodoro with zero setup", "Simple, fast, distraction-free UI", "Task list within a session", "Long track record as a browser timer"],
    rows: [
      ["Starts in seconds without an account", true, true],
      ["Custom interval lengths", true, true],
      ["Session history across visits", true, "Limited"],
      ["Streaks and focus score", true, false],
      ["Progress analytics", true, "Basic"],
      ["Live study rooms", true, false],
      ["AI coaching", true, false],
      ["Study guides and exam content", true, "Guide articles"],
    ],
    whenOurs:
      "Choose FocusArx when you want the instant start but also want sessions, streaks, analytics and rooms to accumulate into something over weeks.",
    whenTheirs:
      "Choose Pomofocus when you want the smallest possible thing that works and nothing else. If a full system would feel like overhead, that is the right answer.",
  },
  freedom: {
    slug: "focusarx-vs-freedom",
    name: "Freedom",
    title: "FocusArx vs Freedom: Honest Comparison",
    description:
      "FocusArx vs Freedom compared — system-wide distraction blocking across devices versus a browser-based focus system with timers, rooms and analytics.",
    lead: "Freedom is a mature cross-device website and app blocker with scheduling and a locked mode. FocusArx does not block anything at the operating-system level; it structures the time instead. They solve adjacent problems and are often used together.",
    ours: ["Structured focus sessions and deep work blocks", "Tasks, habits and goals", "Session analytics and focus score", "Live study rooms", "AI coach", "Free core, browser-based"],
    theirs: ["Blocks websites and apps across Mac, Windows, iOS, Android and Chrome", "Scheduled and recurring block sessions", "Locked mode", "Syncs across all your devices"],
    rows: [
      ["Blocks apps and websites system-wide", false, true],
      ["Cross-device sync of blocks", false, true],
      ["Locked mode", false, true],
      ["Structured focus timer", true, "Block-session timer"],
      ["Task and habit tracking", true, false],
      ["Session analytics", true, false],
      ["Live study rooms", true, false],
      ["AI coaching", true, false],
      ["Free tier", true, "Trial, then subscription"],
    ],
    whenOurs:
      "Choose FocusArx when the problem is structuring and measuring focused time rather than removing access to distractions. Many people use both: Freedom removes the option, FocusArx fills the block with something.",
    whenTheirs:
      "Choose Freedom when you need websites and apps genuinely unavailable at the operating-system level across every device you own. That is a different problem, and no browser-based tool can solve it.",
  },
  stayfocusd: {
    slug: "focusarx-vs-stayfocusd",
    name: "StayFocusd",
    title: "FocusArx vs StayFocusd: Honest Comparison",
    description:
      "FocusArx vs StayFocusd compared — a Chrome extension that limits distracting sites versus a full focus system with timers, analytics and study rooms.",
    lead: "StayFocusd is a Chrome extension that caps the time you can spend on distracting websites. FocusArx is a focus system that structures what you do with the time. Different jobs, and they compose well.",
    ours: ["Focus and deep work timer", "Tasks, habits and goals", "Session analytics and focus score", "Live study rooms", "AI coach", "Free core"],
    theirs: ["Time limits on distracting sites in Chrome", "Nuclear Option for hard blocks", "Active days and allowed hours", "Very low install friction as an extension"],
    rows: [
      ["Caps time on distracting sites", false, true],
      ["Hard block mode", false, true],
      ["Chrome extension install", false, true],
      ["Structured focus timer", true, false],
      ["Task and habit tracking", true, false],
      ["Session analytics", true, false],
      ["Live study rooms", true, false],
      ["AI coaching", true, false],
    ],
    whenOurs:
      "Choose FocusArx when you want to build and measure focused work rather than restrict access to particular sites.",
    whenTheirs:
      "Choose StayFocusd when the specific problem is a handful of websites eating hours inside Chrome, and you want them capped with minimal setup. Pair it with a timer for the block itself.",
  },
};

/** Flat list of comparison paths, consumed by prerender + sitemap + tests. */
export const COMPARISON_PATHS = Object.values(COMPARISONS).map(
  (c) => `/comparison/${c.slug}`,
);
