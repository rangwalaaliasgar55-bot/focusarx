// ══════════════════════════════════════════════════════════════════
// FocusArx prerender manifest
// ══════════════════════════════════════════════════════════════════
// Per-route SEO data used by scripts/prerender.mjs to emit static
// HTML for every public URL at build time, so crawlers and social
// scrapers see unique titles, descriptions, canonicals, JSON-LD and
// real content WITHOUT needing to execute JavaScript.
//
// Keep titles <= ~60 chars and descriptions <= ~160 chars where
// possible. Body sections should be a faithful summary of the real
// (client-rendered) page — never fabricated content.

export const SITE_NAME = "FocusArx";
import { EXAM_GUIDES, EXAM_HUB } from "../src/content/exam/index.mjs";

// OG card base for dynamic OG images (serverless /api/og endpoint).
const OG_BASE = "https://www.focusarx.site";
const examOgImage = (title, subtitle) =>
  `${OG_BASE}/api/og?tag=${encodeURIComponent("EXAM GUIDE")}&title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(subtitle)}&accent=${encodeURIComponent("#a78bfa")}`;
export const DEFAULT_OG_IMAGE_PATH = "/opengraph.jpg";

/**
 * @typedef {Object} RouteEntry
 * @property {string} path           — route path, "" for home (written to /index.html)
 * @property {string} title          — full <title> text
 * @property {string} description    — meta description
 * @property {string} h1             — visible headline for the prerendered body
 * @property {string} lead           — lead paragraph under the H1
 * @property {{h: string, p: string}[]} [sections] — body sections
 * @property {[string, string][]} [faq]   — [question, answer] pairs (emits FAQPage JSON-LD)
 * @property {boolean} [article]     — emit Article JSON-LD (guides)
 * @property {string[]} [related]    — related internal links (path|Label)
 */

const GUIDE_LINKS = [
  "/guides|All FocusArx guides",
  "/focus-guide|How to focus: complete guide",
  "/pomodoro-guide|Pomodoro technique guide",
  "/study-techniques|Best study techniques",
  "/stop-procrastinating|How to stop procrastinating",
  "/adhd-focus-tips|How to focus with ADHD",
  "/focus-music|Best music for studying",
  "/study-with-me|Study with me sessions",
  "/study-calculator|Study time calculator",
];

export const ROUTES = [
  // ── Home ──────────────────────────────────────────────────────
  {
    path: "",
    title: "FocusArx — AI Pomodoro Timer & Deep Work Tracker",
    description:
      "Free AI focus timer that builds real deep-work habits: Pomodoro sessions, focus scores, streaks, live study rooms, and an AI productivity coach. No credit card required.",
    h1: "FocusArx — AI Pomodoro Timer & Deep Work Tracker",
    lead: "FocusArx is a free, gamified focus platform that combines an adaptive Pomodoro timer, deep-work tracking, an AI productivity coach, and live virtual study rooms — so you don't just plan to focus, you actually do.",
    sections: [
      {
        h: "What FocusArx does",
        p: "Run timed Pomodoro or deep-work sessions and earn XP, coins, and streaks for every focused minute. FocusArx scores each session (0–100) from completion and consistency, then its AI coach turns your data into personalized study recommendations. Optional on-device attention monitoring processes webcam signals locally — video never leaves your browser.",
      },
      {
        h: "Built for students and professionals",
        p: "Join live study rooms for body-doubling accountability, compete on leaderboards, track habits and goals, and watch your Focus DNA reveal the hours your brain is sharpest. A free forever plan covers the core timer, tasks, streaks, and analytics.",
      },
      {
        h: "Learn to focus, not just track it",
        p: "FocusArx includes a free library of science-backed guides — how to focus, the Pomodoro technique, study techniques ranked by evidence, focusing with ADHD, beating procrastination, and what music actually helps concentration.",
      },
    ],
    related: GUIDE_LINKS,
  },

  // ── Auth ──────────────────────────────────────────────────────
  {
    path: "/signup",
    title: "Sign Up Free | FocusArx — AI Focus Timer & Deep Work Tracker",
    description:
      "Create your free FocusArx account in 30 seconds. AI Pomodoro timer, focus scores, streaks, live study rooms. No credit card required.",
    h1: "Start focusing free",
    lead: "Create a free FocusArx account and run your first focus session in under a minute. Free forever — no credit card required.",
    sections: [
      {
        h: "What you get for free",
        p: "Adaptive Pomodoro and deep-work timer, task management, XP, coins and streaks, focus analytics, live study rooms, and a library of science-backed focus and study guides.",
      },
    ],
    related: ["/guides|Explore free guides", "/pricing|Pricing — free forever"],
  },
  {
    path: "/login",
    title: "Log In | FocusArx — AI Focus Timer & Deep Work Tracker",
    description:
      "Log in to FocusArx to continue your focus streaks, sessions, study rooms, and AI productivity coaching.",
    h1: "Welcome back",
    lead: "Log in to continue your streaks, join live study rooms, and pick up your focus sessions where you left off.",
    sections: [],
    related: ["/signup|Create a free account", "/support|Help center"],
  },

  // ── Company ───────────────────────────────────────────────────
  {
    path: "/about",
    title: "About FocusArx | Our Mission to Make Deep Work Easy",
    description:
      "FocusArx helps students and professionals build unbreakable focus habits with an AI-powered, gamified deep-work platform. Learn about our mission and principles.",
    h1: "About FocusArx",
    lead: "FocusArx exists to make deep work the easiest option — not the hardest. We build tools that turn intention into focused action using behavioral science, AI, and game design.",
    sections: [
      {
        h: "Why we build",
        p: "Attention has become the scarcest resource of the knowledge economy. Willpower alone loses to apps engineered to capture it — so we engineer back: timers that adapt to you, rewards that arrive immediately, social accountability that makes starting easy, and analytics that show real progress.",
      },
      {
        h: "How we're different",
        p: "FocusArx is free forever at its core, privacy-first (optional attention monitoring runs entirely on-device), and built around measurable focus depth rather than vanity metrics.",
      },
    ],
    related: ["/contact|Contact us", "/roadmap|Product roadmap", "/pricing|Pricing"],
  },
  {
    path: "/contact",
    title: "Contact FocusArx | Support, Feedback & Enquiries",
    description:
      "Get in touch with the FocusArx team for support, feedback, feature requests, or business enquiries. We reply within 24 hours.",
    h1: "Contact FocusArx",
    lead: "Questions, feedback, or partnership ideas? Reach the team at focusarx@gmail.com or through the contact form — we usually reply within 24 hours.",
    sections: [],
    related: ["/support|Help center & FAQ", "/about|About FocusArx"],
  },
  {
    path: "/support",
    title: "FocusArx Help Center | FAQ & Support",
    description:
      "Answers to common questions about FocusArx — the Pomodoro timer, focus sessions and scores, AI coaching, streaks and coins, study rooms, accounts, and privacy.",
    h1: "FocusArx Help Center",
    lead: "Fast answers to the most common questions about the timer, focus scores, streaks, coins, study rooms, and your account.",
    sections: [
      {
        h: "Popular topics",
        p: "How focus sessions and the Focus Score work; how streaks, XP, and Focus Coins are earned and spent; how live study rooms and leaderboards work; how optional on-device attention monitoring protects privacy; and how to manage or delete your account data.",
      },
    ],
    related: ["/contact|Contact us", "/privacy|Privacy policy"],
  },
  {
    path: "/pricing",
    title: "FocusArx Pricing — Free Forever | Premium with Earned Coins",
    description:
      "FocusArx is completely free forever. Unlock Premium — advanced AI coaching, exclusive themes, deep insights — with coins you earn by focusing. No subscriptions.",
    h1: "Free forever. Premium by focusing.",
    lead: "The core platform — timer, tasks, streaks, analytics, study rooms — is free forever. Premium features are unlocked with Focus Coins you earn by completing sessions, not with a credit card.",
    sections: [
      {
        h: "Free plan",
        p: "Unlimited Pomodoro and deep-work sessions, task and habit tracking, XP and streaks, basic analytics, live study rooms, and every guide in the FocusArx library.",
      },
      {
        h: "Premium (earned, not paid)",
        p: "Advanced AI coaching, exclusive themes and cosmetics, deeper Focus DNA insights, and productivity boosts — all purchased with Focus Coins earned during sessions.",
      },
    ],
    related: ["/signup|Start free", "/premium|Premium overview"],
  },
  {
    path: "/premium",
    title: "FocusArx Premium — Advanced AI Coaching & Insights",
    description:
      "FocusArx Premium unlocks advanced AI coaching, exclusive themes, deeper Focus DNA insights, and boosts — activated with Focus Coins you earn by focusing.",
    h1: "FocusArx Premium",
    lead: "Premium amplifies everything that works about FocusArx — smarter coaching, richer insights, exclusive cosmetics — and it's earned with focus, not bought.",
    sections: [],
    related: ["/pricing|Pricing", "/signup|Start free"],
  },
  {
    path: "/roadmap",
    title: "FocusArx Product Roadmap | What's Next",
    description:
      "See what's shipping next on FocusArx — upcoming features, recent releases, and the direction of the platform. Updated weekly.",
    h1: "FocusArx product roadmap",
    lead: "What's shipped, what's next, and what we're exploring — updated weekly.",
    sections: [],
    related: ["/about|About", "/contact|Send feedback"],
  },

  // ── Guides & content ──────────────────────────────────────────
  {
    path: "/guides",
    title: "All Focus & Study Guides | Free Productivity Library | FocusArx",
    description:
      "Browse every free FocusArx guide — Pomodoro technique, deep work, study techniques, ADHD focus, beating procrastination, study music, and more. Science-backed and practical.",
    h1: "The FocusArx guide library",
    lead: "Every FocusArx guide in one place: science-backed, practical, and free. Focus fundamentals, study methods, motivation and habits, and interactive tools.",
    sections: [
      {
        h: "Focus fundamentals",
        p: "How to focus (the complete science-based guide), the neuroscience of deep work, what music actually helps concentration, and focus strategies engineered for ADHD brains.",
      },
      {
        h: "Study methods",
        p: "Study techniques ranked by evidence — active recall, spaced repetition, interleaving — plus deep dives into the Pomodoro technique, the 2-hour study method, deep study, and the Feynman technique.",
      },
      {
        h: "Motivation & habits",
        p: "How to stop procrastinating (it's an emotion-regulation problem, not laziness), study-with-me sessions and body doubling, virtual study rooms, and the 2-minute breathing reset.",
      },
      {
        h: "Free tools",
        p: "A 2-minute study-method quiz that matches techniques to your brain and schedule, and a study-time calculator that turns your exam date into a retention-optimized plan.",
      },
    ],
    article: true,
    related: GUIDE_LINKS.slice(1),
  },
  {
    path: "/focus-guide",
    title: "How to Focus: The Complete Science-Based Guide (2026) | FocusArx",
    description:
      "Learn how to focus and master deep work. Science-backed methods — Pomodoro technique, time blocking, flow state — plus a practical system to build unbreakable focus habits.",
    h1: "How to focus: the complete science-based guide",
    lead: "Attention is the most valuable resource you own — and the one most under attack. This guide explains why focus is hard, the science behind it, and a practical system to master deep work.",
    sections: [
      {
        h: "Why focus is so hard",
        p: "Modern apps are engineered to interrupt you; every switch leaves attention residue that degrades the next task. The guide covers the top-down and bottom-up attention systems, ultradian energy rhythms, and how cheap dopamine makes deep work feel unrewarding.",
      },
      {
        h: "Proven focus methods",
        p: "The Pomodoro Technique, Cal Newport's deep work, time blocking, engineering flow states, the 2-hour study method, and spaced repetition with the Feynman technique — how each works and when to use it.",
      },
      {
        h: "Building your focus system",
        p: "Sleep, movement, single-tasking and environment design as the foundation; a sample deep-work day; and how to measure depth with a Focus Score instead of vanity hours.",
      },
    ],
    article: true,
    related: [
      "/pomodoro-guide|Pomodoro technique guide",
      "/science-of-deep-work|The science of deep work",
      "/stop-procrastinating|How to stop procrastinating",
      "/adhd-focus-tips|How to focus with ADHD",
      "/guides|All guides",
    ],
  },
  {
    path: "/pomodoro-guide",
    title: "Pomodoro Technique Guide 2026 | Best Free Pomodoro Timer App | FocusArx",
    description:
      "Complete guide to the Pomodoro Technique: how 25/5 focus sprints work, common mistakes, longer deep-work intervals, and the best free Pomodoro timer app with AI coaching.",
    h1: "The Pomodoro technique: the complete guide",
    lead: "Pomodoro breaks work into 25-minute focused sprints separated by 5-minute breaks. It's the world's most-used focus method — here's how to run it correctly, when to extend it, and the tools that make it stick.",
    sections: [
      {
        h: "How a Pomodoro cycle works",
        p: "Choose one task, set a 25-minute timer, work without switching until it rings, take a 5-minute break — after four cycles, take 15–30 minutes. Developed by Francesco Cirillo in the late 1980s and validated by decades of user practice.",
      },
      {
        h: "Common Pomodoro mistakes",
        p: "Checking your phone during breaks, skipping breaks entirely, using Pomodoro for shallow multitasking, and treating the timer as a prison — the interval serves the work, not the reverse. For deep creative tasks, 45–52 minute intervals often work better.",
      },
      {
        h: "Pomodoro with FocusArx",
        p: "FocusArx's free timer runs customizable Pomodoro sessions, scores each one for completion and consistency, rewards streaks with XP and coins, and syncs cycles across live study rooms.",
      },
    ],
    article: true,
    related: [
      "/focus-guide|How to focus: complete guide",
      "/two-hour-study-method|The 2-hour study method",
      "/study-techniques|Best study techniques",
      "/guides|All guides",
    ],
  },
  {
    path: "/study-techniques",
    title: "Best Study Techniques 2026 | Science-Backed Study Methods | FocusArx",
    description:
      "The most effective study techniques ranked by evidence — active recall, spaced repetition, interleaving, elaboration — and how to combine them into a system that works.",
    h1: "The best study techniques, ranked by evidence",
    lead: "Highlighting and rereading feel productive but barely work. Here's what cognitive science says actually builds durable memory — and how to combine the winners.",
    sections: [
      {
        h: "The evidence hierarchy",
        p: "Practice testing (active recall) and distributed practice (spaced repetition) sit at the top of the evidence pyramid, with interleaving and elaborative interrogation close behind. Rereading, highlighting, and summarizing rank near the bottom.",
      },
      {
        h: "How to actually use them",
        p: "Turn notes into questions, test yourself before you feel ready, space reviews on an expanding schedule, mix problem types instead of blocking them, and explain concepts in your own words — the Feynman technique.",
      },
      {
        h: "Technique + time",
        p: "Techniques need protected time to live in. Pair them with Pomodoro sessions and the 2-hour study method inside FocusArx, where flashcards and session tracking make recall practice a daily habit.",
      },
    ],
    article: true,
    related: [
      "/feynman-technique|The Feynman technique",
      "/deep-study-guide|Deep study guide",
      "/study-method-quiz|Find your study method (quiz)",
      "/guides|All guides",
    ],
  },
  {
    path: "/adhd-focus-tips",
    title: "How to Focus with ADHD: 15 Science-Backed Strategies (2026) | FocusArx",
    description:
      "Practical focus strategies that actually work for ADHD brains — body doubling, the 10-minute rule, dopamine-friendly rewards, timers, and how to build study habits that stick.",
    h1: "How to focus with ADHD: 15 strategies that work",
    lead: "ADHD isn't a willpower problem — it's a dopamine and attention-regulation difference. These strategies work with your brain instead of against it.",
    sections: [
      {
        h: "Why ADHD focus feels different",
        p: "ADHD affects task initiation, working memory, time perception, and motivation regulation. Interest, novelty, urgency, and challenge — not importance — engage the ADHD brain, and weak dopamine signaling makes boring tasks neurologically hard to start.",
      },
      {
        h: "The core strategies",
        p: "Body doubling (working alongside someone), the 10-minute rule, external visible timers for time blindness, immediate rewards, one-tab environments, laughably small first steps, designed urgency (not panic), capture lists instead of memory, protected sleep, movement before blocks, implementation intentions, real non-phone breaks, energy-matched scheduling, accountability partners — and professional treatment where appropriate.",
      },
      {
        h: "A daily ADHD focus system",
        p: "One 10-minute morning session before anything else, visible timer blocks with real breaks, a two-minute evening review, and a consistent wake time. Start absurdly small; grow the loop weekly.",
      },
    ],
    article: true,
    faq: [
      ["Can people with ADHD do deep work?", "Yes — usually in shorter blocks and with more external structure. Find your workable interval (often 10–25 minutes), protect it from distractions, and repeat it with real breaks. Hyperfocus can carry you further when a task engages you."],
      ["What is body doubling and why does it help ADHD?", "Body doubling is working alongside another person, in person or virtually. The quiet social pressure of being seen working helps regulate attention and task initiation — it's one of the most consistently reported-effective ADHD strategies."],
      ["How long should a Pomodoro be with ADHD?", "Start with 10–15 minutes — short enough that starting feels safe — and extend gradually toward 25. The timer's job is to get you started, not to stop you."],
      ["Why do I procrastinate so much with ADHD?", "ADHD procrastination is mostly a dopamine and task-initiation problem, not laziness. Solutions lower activation energy (tiny first steps, the 2-minute rule) or add dopamine (rewards, novelty, urgency, accountability)."],
      ["What is time blindness and how do I manage it?", "Time blindness is difficulty sensing elapsed time or task duration. Externalize it: visible timers, alarms as bookends, calendar time blocking, and short commitments."],
    ],
    related: [
      "/stop-procrastinating|How to stop procrastinating",
      "/study-with-me|Study with me sessions",
      "/focus-guide|How to focus: complete guide",
      "/guides|All guides",
    ],
  },
  {
    path: "/stop-procrastinating",
    title: "How to Stop Procrastinating: 12 Methods That Work | FocusArx",
    description:
      "Why you procrastinate (it's not laziness) and 12 proven ways to stop — the 2-minute rule, temptation bundling, implementation intentions, and systems that make starting easy.",
    h1: "How to stop procrastinating: 12 methods that work",
    lead: "Procrastination isn't laziness or a time-management glitch — it's your brain avoiding an emotion. Here's the science, and the toolkit.",
    sections: [
      {
        h: "Why you really procrastinate",
        p: "Procrastination is an emotion-regulation problem. Tasks that feel boring, overwhelming, ambiguous, or threatening trigger avoidance — and your phone is an always-available anesthetic. Shame makes it worse: self-criticism adds new negative emotion to the task, and studies show self-compassion reduces future procrastination.",
      },
      {
        h: "The 12 methods",
        p: "The 2-minute rule, timeboxing instead of task-boxing, implementation intentions ('when X, I do Y'), temptation bundling, environment design, physical next actions, body doubling, visible progress and streaks, eat-the-frog vs warm-up wins, scheduled worry, permission to write a bad first draft, and rewarding the start rather than the finish.",
      },
      {
        h: "The daily anti-procrastination system",
        p: "Each night, choose tomorrow's one important task and write its 2-minute first step. Start it before email or messages. Timebox the day with a visible timer, log completed sessions, and review — with genuine self-forgiveness — at day's end.",
      },
    ],
    article: true,
    faq: [
      ["What is the main cause of procrastination?", "Research points primarily to emotion regulation, not time management. We procrastinate to avoid negative feelings attached to a task — boredom, anxiety, self-doubt, or overwhelm. The fix is reducing the emotional friction of starting."],
      ["How do I stop procrastinating right now?", "Pick the task you're avoiding, define its 2-minute version, set a timer, and do only that. Starting is the bottleneck; momentum usually follows."],
      ["Is procrastination laziness?", "No. Lazy people don't care about not working; procrastinators care intensely and suffer for the delay. Self-compassion, not self-criticism, reduces future procrastination."],
      ["Does the Pomodoro technique help with procrastination?", "Yes — a 25-minute commitment is small enough to slip under the avoidance reflex, and once you're 25 minutes in, task-related worry typically drops."],
    ],
    related: [
      "/adhd-focus-tips|How to focus with ADHD",
      "/pomodoro-guide|Pomodoro technique guide",
      "/focus-guide|How to focus: complete guide",
      "/guides|All guides",
    ],
  },
  {
    path: "/study-with-me",
    title: "Study With Me: Live Virtual Study Sessions | FocusArx",
    description:
      "Study with me and thousands of other learners in live virtual study rooms. Real-time accountability, Pomodoro sync, and the body-doubling effect that makes focusing easier.",
    h1: "Study with me: why focusing together works",
    lead: "Millions of students now study alongside strangers online. It's not a trend gimmick — it's the easiest accountability system ever discovered.",
    sections: [
      {
        h: "The body-doubling effect",
        p: "Body doubling is doing a task in the presence of another person — no teaching, no talking, just parallel work. Social presence creates mild, useful accountability: drift becomes visible, so most people start on time, work longer, and finish more.",
      },
      {
        h: "Why it works",
        p: "Starting stops being a solo battle (the room starts, so you start), synchronized Pomodoro timers create rhythm you didn't have to invent, streaks become social, and 24/7 rooms mean someone's always awake and working.",
      },
      {
        h: "How to start",
        p: "Pick the task you've been avoiding, join a FocusArx study room, and run one synchronized 25-minute cycle. Camera optional; silence is the feature; bring real work.",
      },
    ],
    article: true,
    faq: [
      ["What does 'study with me' mean?", "Focused work done alongside at least one other person — in the same room, on a call, or in a virtual study room. Nobody talks; you work in parallel, often with synchronized Pomodoro timers."],
      ["Does studying with others actually help?", "For most people, yes — social presence creates accountability and applies the body-doubling effect. The key is silent, focused companions rather than chatty study groups."],
      ["Are study-with-me rooms free on FocusArx?", "Yes — FocusArx's virtual study rooms are free to join, run 24/7, and sync Pomodoro timers across everyone in the room."],
      ["Should my camera be on in a study room?", "Only if you want. Presence is what matters; FocusArx works fully camera-optional."],
    ],
    related: [
      "/virtual-study-room|Virtual study rooms",
      "/adhd-focus-tips|ADHD focus tips (body doubling)",
      "/stop-procrastinating|How to stop procrastinating",
      "/guides|All guides",
    ],
  },
  {
    path: "/focus-music",
    title: "Best Music for Studying & Focus: What Science Says | FocusArx",
    description:
      "Does study music actually help? What the research really says about focus music, lo-fi, binaural beats, noise colors, and silence — plus how to build a playlist that deepens focus.",
    h1: "Focus music: what science actually says",
    lead: "'Study music' is a billion-stream genre — but does it help? The honest research verdict, and how to use sound to go deeper.",
    sections: [
      {
        h: "The honest verdict",
        p: "For hard cognitive work, silence usually wins; for everything else, the right background sound beats a noisy environment — and sometimes beats silence. Music's biggest proven effect is on mood and arousal: a track that makes a boring task pleasant keeps you at the desk longer.",
      },
      {
        h: "What hurts and what helps",
        p: "Lyrics are the biggest cost — they compete with reading, writing, and memorization. Lo-fi, ambient, and brown/pink noise are the safest backgrounds: steady, predictable, and lyric-free. Binaural beats show mixed, small effects at best.",
      },
      {
        h: "Build a trigger, not just a playlist",
        p: "No words, flat dynamics, 30+ minutes pre-queued, the same playlist every session, volume as a dimmer. Used consistently, the playlist itself becomes a focus trigger that tells your brain it's work time.",
      },
    ],
    article: true,
    faq: [
      ["Is listening to music while studying bad?", "It depends on the task and the music: lyrics reliably cost performance on memorization and reading, while instrumental or steady background sound can help repetitive work and mask noisy environments."],
      ["Does lo-fi actually help you focus?", "Lo-fi's strength is blandness — no lyrics, no dynamic surprises. Steady, unchanging sound is among the least disruptive backgrounds, which matches most students' experience."],
      ["Do binaural beats improve concentration?", "Evidence is mixed and effects, where found, are small. Harmless if you enjoy it — but treat 'brainwave rewiring' claims with skepticism."],
      ["Is silence better for deep work?", "For maximal performance on hard tasks, silence usually wins — but predictable sound beats unpredictable interruptions in noisy environments."],
    ],
    related: [
      "/focus-guide|How to focus: complete guide",
      "/adhd-focus-tips|ADHD focus tips",
      "/study-techniques|Best study techniques",
      "/guides|All guides",
    ],
  },
  {
    path: "/deep-study-guide",
    title: "Deep Study Guide 2026 | Master Deep Learning Techniques | FocusArx",
    description:
      "The complete deep study guide: science-backed strategies for sustained concentration, memory retention, and peak academic performance.",
    h1: "The deep study guide",
    lead: "Sustained concentration, memory that lasts, and peak academic performance — assembled into one practical playbook.",
    sections: [
      {
        h: "What deep study means",
        p: "Deep study is extended, distraction-free engagement with material, combined with evidence-based encoding: active recall, spaced repetition, and elaboration instead of passive rereading.",
      },
      {
        h: "The playbook",
        p: "Structure sessions with warm-up, focused blocks, and retrieval practice; protect attention with environment design; space your reviews; and measure depth rather than hours sat at a desk.",
      },
    ],
    article: true,
    related: [
      "/study-techniques|Best study techniques",
      "/two-hour-study-method|The 2-hour study method",
      "/science-of-deep-work|The science of deep work",
      "/guides|All guides",
    ],
  },
  {
    path: "/two-hour-study-method",
    title: "The 2-Hour Study Method: Structure Deep Study Sessions | FocusArx",
    description:
      "Master the 2-hour focused study method: warm-up, intense focused study, retrieval practice, and review — the structure that beats scattered, unfocused hours.",
    h1: "The 2-hour study method",
    lead: "A structured two-hour block — warm-up, deep study, retrieval, review — that outperforms scattered, unfocused hours.",
    sections: [
      {
        h: "The structure",
        p: "Warm up with a light review to re-enter the material, work through focused Pomodoro-style intervals on the hardest content, finish with active-recall testing, and close with a brief review that sets up tomorrow's session.",
      },
      {
        h: "Why it works",
        p: "The warm-up lowers entry friction, timed intervals protect depth, retrieval practice is where learning actually consolidates, and the closing review leverages the spacing effect across days.",
      },
    ],
    article: true,
    related: [
      "/pomodoro-guide|Pomodoro technique guide",
      "/study-techniques|Best study techniques",
      "/deep-study-guide|Deep study guide",
      "/guides|All guides",
    ],
  },
  {
    path: "/science-of-deep-work",
    title: "The Neuroscience of Deep Work | How Focus Rewires Your Brain",
    description:
      "Explore the biological mechanisms behind deep work — myelin, neurotransmitters, attention networks, and how to enter the flow state faster.",
    h1: "The neuroscience of deep work",
    lead: "What actually happens in your brain during deep work — and why focused repetition physically rewires it.",
    sections: [
      {
        h: "The mechanism",
        p: "Repeated focused firing of neural circuits wraps them in myelin, making them faster and more reliable — the biological basis of skill. Neurotransmitters like dopamine and norepinephrine gate attention and motivation.",
      },
      {
        h: "Flow states",
        p: "Flow emerges when challenge slightly exceeds skill with clear goals and immediate feedback. You can engineer the conditions instead of waiting for the mood.",
      },
    ],
    article: true,
    related: [
      "/focus-guide|How to focus: complete guide",
      "/deep-study-guide|Deep study guide",
      "/guides|All guides",
    ],
  },
  {
    path: "/feynman-technique",
    title: "The Feynman Technique | Master Any Subject Faster | FocusArx",
    description:
      "Learn the Feynman Technique — the ultimate method for rapid learning. Four simple steps to understand complex topics by explaining them simply.",
    h1: "The Feynman technique",
    lead: "Named after physicist Richard Feynman: if you can't explain it simply, you don't understand it well enough. Four steps turn that insight into a learning method.",
    sections: [
      {
        h: "The four steps",
        p: "Choose a concept and write it at the top of a blank page. Explain it in plain language as if teaching a child. When you stumble, return to the source material to fill the gap. Simplify and use analogies until the explanation flows.",
      },
      {
        h: "Why it works",
        p: "Explaining forces retrieval and elaboration — the two strongest learning techniques — and exposes illusory comprehension, the 'I recognize it so I know it' trap that rereading hides.",
      },
    ],
    article: true,
    related: [
      "/study-techniques|Best study techniques",
      "/deep-study-guide|Deep study guide",
      "/guides|All guides",
    ],
  },
  {
    path: "/study-method-quiz",
    title: "Which Study Method Works Best for You? | Free Quiz | FocusArx",
    description:
      "Take the free 2-minute study method quiz. Discover whether active recall, spaced repetition, Pomodoro, or another technique matches your learning style and schedule.",
    h1: "Which study method works best for you?",
    lead: "Two minutes, a handful of questions — and a study method matched to your brain, schedule, and goals.",
    sections: [
      {
        h: "What the quiz covers",
        p: "Your attention span, deadline pressure, subject mix, and preferred session length. The result maps you to the technique family — Pomodoro intervals, deep blocks, recall-first, or social study — most likely to stick.",
      },
    ],
    related: [
      "/study-techniques|Best study techniques",
      "/study-calculator|Study time calculator",
      "/guides|All guides",
    ],
  },
  {
    path: "/study-calculator",
    title: "Study Time Calculator | Plan Your Study Sessions | FocusArx",
    description:
      "Free study time calculator: enter your exam date, topics, and available hours to get a personalized, retention-optimized study schedule.",
    h1: "Study time calculator",
    lead: "Enter your exam date, topics, and available hours — get a personalized study schedule optimized for retention, not cramming.",
    sections: [
      {
        h: "What it does",
        p: "The calculator distributes your topics across the days you actually have, front-loads harder material, schedules spaced reviews at expanding intervals, and balances daily load so the plan survives contact with real life.",
      },
    ],
    related: [
      "/study-method-quiz|Study method quiz",
      "/two-hour-study-method|The 2-hour study method",
      "/guides|All guides",
    ],
  },
  {
    path: "/virtual-study-room",
    title: "Virtual Study Room | Study with Others Online | FocusArx",
    description:
      "Join a virtual study room and study with thousands of other learners online. Live focus rooms add accountability, social focus energy, and real-time productivity.",
    h1: "Virtual study rooms: study with others online",
    lead: "Join a live room, keep your camera on or off, and study in synchronized silence with learners around the world.",
    sections: [
      {
        h: "How rooms work",
        p: "Rooms run shared Pomodoro timers with live presence — everyone focuses together and breaks together. Join public rooms any hour or create a private room for your group.",
      },
      {
        h: "Why it helps",
        p: "Body doubling and social accountability make starting easier and drift rarer. For many people — especially with ADHD — a room is the difference between intending to study and actually studying.",
      },
    ],
    article: true,
    related: [
      "/study-with-me|Study with me sessions",
      "/pomodoro-guide|Pomodoro technique guide",
      "/guides|All guides",
    ],
  },

  // ── Public gamification / wellness ────────────────────────────
  {
    path: "/study-rooms",
    title: "Live Study Rooms | Focus Alongside Others | FocusArx",
    description:
      "Browse and join live FocusArx study rooms — synchronized Pomodoro timers, live presence, and instant accountability. Free, 24/7.",
    h1: "Live study rooms",
    lead: "Browse public rooms, see who's focusing right now, and join in one click — or create a private room for your friends.",
    sections: [],
    related: ["/virtual-study-room|About virtual study rooms", "/study-with-me|Study with me guide", "/signup|Start free"],
  },
  {
    path: "/leaderboard",
    title: "Focus Leaderboard | Top Focus Champions | FocusArx",
    description:
      "See who's leading the FocusArx leaderboard — top focus champions ranked by XP, streaks, and total focused time. Updated live.",
    h1: "FocusArx leaderboard",
    lead: "Top focus champions ranked by XP, streaks, and total focused time — updated live.",
    sections: [],
    related: ["/signup|Join and compete", "/achievements|Achievements"],
  },
  {
    path: "/achievements",
    title: "Achievements, Badges & Milestones | FocusArx",
    description:
      "Explore FocusArx achievements — 65+ badges across focus time, streaks, session quality, missions, social, and special milestones.",
    h1: "FocusArx achievements",
    lead: "65+ badges across focus time, streaks, session quality, missions, social, and special milestones.",
    sections: [],
    related: ["/leaderboard|Leaderboard", "/signup|Start earning badges"],
  },
  {
    path: "/breathe",
    title: "2-Minute Breathing Reset | Guided Box Breathing | FocusArx",
    description:
      "A free guided breathing tool for study breaks — box breathing and physiological sighs to reset your nervous system between focus sessions.",
    h1: "2-minute breathing reset",
    lead: "A guided breathing exercise for your study breaks — calm your nervous system in two minutes and start the next session clean.",
    sections: [
      {
        h: "Why breathe between sessions",
        p: "Breaks that stimulate (scrolling) don't restore attention; breaks that down-regulate arousal do. Slow exhale-weighted breathing shifts you toward the rest-and-digest state, lowering the friction of restarting.",
      },
    ],
    related: ["/focus-guide|How to focus: complete guide", "/focus-music|Focus music guide", "/guides|All guides"],
  },
  {
    path: "/break-free",
    title: "Break Free From a Distraction Spiral | FocusArx",
    description:
      "Caught in a scroll spiral? A free 60-second reset that gets you out of the loop and back into your work — no shame, just a protocol.",
    h1: "Break free from the distraction spiral",
    lead: "You're 60 seconds of deliberate action away from ending the scroll loop. No shame — just a protocol that works.",
    sections: [],
    related: ["/stop-procrastinating|How to stop procrastinating", "/breathe|Breathing reset", "/guides|All guides"],
  },

  // ── Legal ─────────────────────────────────────────────────────
  {
    path: "/privacy",
    title: "Privacy Policy | FocusArx",
    description:
      "How FocusArx collects, uses, and protects your data. Optional webcam attention monitoring is processed on-device — video never leaves your browser.",
    h1: "FocusArx privacy policy",
    lead: "What data FocusArx collects, how it's used, and the choices you control — including the principle that optional attention monitoring never uploads video.",
    sections: [],
    related: ["/terms|Terms of service", "/ai-policy|AI policy", "/contact|Contact us"],
  },
  {
    path: "/terms",
    title: "Terms of Service | FocusArx",
    description: "The terms governing your use of the FocusArx AI productivity platform.",
    h1: "FocusArx terms of service",
    lead: "The agreement between you and FocusArx when you use the platform.",
    sections: [],
    related: ["/privacy|Privacy policy", "/acceptable-use|Acceptable use policy"],
  },
  {
    path: "/cookie-policy",
    title: "Cookie Policy | FocusArx",
    description: "How FocusArx uses cookies — minimal, for authentication and analytics. No third-party tracking cookies.",
    h1: "FocusArx cookie policy",
    lead: "We use the minimum number of cookies needed to keep you signed in and improve the product.",
    sections: [],
    related: ["/privacy|Privacy policy"],
  },
  {
    path: "/acceptable-use",
    title: "Acceptable Use Policy | FocusArx",
    description: "Guidelines for responsible use of the FocusArx platform and community standards.",
    h1: "FocusArx acceptable use policy",
    lead: "The short list of things that keep FocusArx safe and useful for everyone.",
    sections: [],
    related: ["/terms|Terms of service", "/contact|Report a problem"],
  },
  {
    path: "/ai-policy",
    title: "AI Policy | How FocusArx Uses AI | FocusArx",
    description: "How FocusArx uses artificial intelligence — our AI features, data handling, and privacy-first approach to machine learning.",
    h1: "How FocusArx uses AI",
    lead: "Where AI appears in the product, what it does and doesn't touch, and the privacy-first rules it operates under.",
    sections: [],
    related: ["/privacy|Privacy policy", "/focus-guide|How to focus guide"],
  },

  // ── Comparison pages ──────────────────────────────────────────
  {
    path: "/comparison/focusarx-vs-forest",
    title: "FocusArx vs Forest App: Honest Comparison (2026) | FocusArx",
    description:
      "FocusArx vs Forest compared — timers, gamification, study rooms, AI coaching, analytics, privacy, and price. An honest look at which focus app fits you.",
    h1: "FocusArx vs Forest: an honest comparison",
    lead: "Forest gamifies focus with a growing tree; FocusArx builds a full focus system around the timer. Here's how they compare feature by feature.",
    sections: [
      {
        h: "Where they differ",
        p: "Forest centers on the don't-leave-the-app tree mechanic with mobile-first design; FocusArx adds focus scoring, AI coaching, live study rooms with body doubling, habit and goal tracking, deep analytics, and a free web-first experience with optional on-device attention monitoring.",
      },
      {
        h: "Where they agree",
        p: "Both use immediate gamified rewards to make focusing stick, and both work for students who want a lighter touch than a full productivity suite.",
      },
    ],
    article: true,
    related: ["/comparison/focusarx-vs-focus-todo|FocusArx vs Focus To-Do", "/pricing|FocusArx pricing", "/guides|All guides"],
  },
  {
    path: "/comparison/focusarx-vs-focus-todo",
    title: "FocusArx vs Focus To-Do: Honest Comparison (2026) | FocusArx",
    description:
      "FocusArx vs Focus To-Do compared — Pomodoro timers, task management, gamification, study rooms, AI features, analytics, and pricing. Which fits your workflow?",
    h1: "FocusArx vs Focus To-Do: an honest comparison",
    lead: "Focus To-Do pairs a Pomodoro timer with a GTD-style task list; FocusArx builds a focus OS around behavioral science. Here's how they stack up.",
    sections: [
      {
        h: "Where they differ",
        p: "Focus To-Do leans on task/project management with Pomodoro tracking; FocusArx emphasizes session quality (Focus Score), AI coaching, live study rooms, streaks and coins, Focus DNA insights, and a free web-first platform.",
      },
      {
        h: "Where they agree",
        p: "Both combine timers with task lists and both reward consistency — the difference is whether the timer serves your to-do list or your attention itself.",
      },
    ],
    article: true,
    related: ["/comparison/focusarx-vs-forest|FocusArx vs Forest", "/pricing|FocusArx pricing", "/guides|All guides"],
  },

  // ── Exam guide cluster (Workstream E) ─────────────────────
  {
    path: "/exam",
    title: EXAM_HUB.title,
    description: EXAM_HUB.description,
    h1: EXAM_HUB.h1,
    lead: EXAM_HUB.lead,
    sections: EXAM_HUB.sections,
    faq: EXAM_HUB.faq,
    related: EXAM_GUIDES.map((g) => `/exam/${g.slug}|${g.h1}`),
  },
  ...EXAM_GUIDES.map((g) => ({
    path: `/exam/${g.slug}`,
    title: g.title,
    description: g.description,
    h1: g.h1,
    lead: g.lead,
    sections: g.sections,
    faq: g.faq,
    article: true,
    ogImage: examOgImage(g.title.replace(/\s*\|\s*FocusArx.*$/i, ""), g.lead),
    related: g.related,
  })),
];
