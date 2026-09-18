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
import { clampText, DESCRIPTION_BUDGET, PAGE_TITLE_BUDGET } from "../src/lib/seo-text.mjs";
import { EXAM_GUIDES, EXAM_HUB } from "../src/content/exam/index.mjs";
import {
  COMPARISONS_REVIEWED,
  COMPARISONS,
  ABOUT_REVIEWED,
  COMPARISON_PATHS,
  GUIDE_LIBRARY_REVIEWED,
  SEO_PAGES,
  cellText,
} from "../src/content/seo-pages.mjs";
import { BLOG_POSTS } from "../src/content/blog.mjs";
import { localeRouteEntries } from "../src/content/locale-pages.mjs";
import { FUNNEL_ANGLES } from "../src/content/exam-funnel.mjs";
import {
  EXAM_CLUSTER_REVIEWED,
  funnelDescription,
  funnelHeading,
  funnelTitle,
} from "../src/content/exam/derive.mjs";

// OG card base for dynamic OG images (serverless /api/og endpoint).
// Canonical host is www — the apex 308-redirects here (vercel.json).
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
 * @property {{h: string, p: string | string[], bullets?: string[]}[]} [sections] — body sections
 * @property {{heading: string, caption?: string, head?: string[], rows: (string|boolean)[][]}} [table]
 *   — data table rendered into the static body (the comparison feature grid)
 * @property {[string, string][]} [faq]   — [question, answer] pairs (emits FAQPage JSON-LD)
 * @property {boolean} [article]     — emit Article JSON-LD (guides)
 * @property {string} [lastReviewed] — ISO date the copy was last reviewed;
 *                                     drives the visible byline, dateModified
 *                                     and the sitemap lastmod
 * @property {string[]} [related]    — related internal links (path|Label)
 */

/**
 * Policy link set — mirrors `LegalFooter()` in the live policy pages
 * (privacy / terms / cookie-policy / acceptable-use / ai-policy /
 * data-deletion), so the prerendered body and the rendered page carry the same
 * links. Policy pages used to dead-end: the prerender gave each of them one or
 * two "keep reading" links, which left /cookie-policy and /accessibility
 * reachable only from the sitemap.
 */
const POLICY_LINKS = [
  "/privacy|Privacy policy",
  "/terms|Terms of service",
  "/cookie-policy|Cookie policy",
  "/acceptable-use|Acceptable use policy",
  "/ai-policy|AI policy",
  "/data-deletion|Delete your data",
  "/accessibility|Accessibility statement",
  "/camera-data|How camera data is handled",
  "/safety|Study room safety and moderation",
  "/evidence|Evidence and claim policy",
];

/** Company/trust link set — mirrors the live landing footer columns. */
const COMPANY_LINKS = [
  "/|FocusArx home",
  "/about|About FocusArx",
  "/contact|Contact us",
  "/support|Help center",
  "/blog|Blog",
  "/guides|All guides",
  "/press|Press kit",
  "/roadmap|Product roadmap",
  "/changelog|Changelog",
  "/pricing|Pricing",
];

/**
 * The full guide/tool index — mirrors what `/guides` actually renders
 * (src/pages/guides.tsx lists every one of these). The prerender used to carry
 * eight of them, so nine real pages looked orphaned to a crawler that does not
 * run JavaScript.
 */
const ALL_GUIDE_LINKS = [
  "/focus-guide|How to focus: the complete guide",
  "/deep-work-guide|Deep work guide",
  "/pomodoro-guide|The Pomodoro technique",
  "/study-techniques|Best study techniques, ranked by evidence",
  "/how-to-focus-while-studying|How to focus while studying",
  "/body-doubling|Body doubling explained",
  "/stop-procrastinating|How to stop procrastinating",
  "/stop-scrolling|How to stop scrolling",
  "/adhd-focus-tips|How to focus with ADHD",
  "/adhd-focus-tools|ADHD-friendly focus tools",
  "/focus-music|Best music for studying",
  "/science-of-deep-work|The science of deep work",
  "/two-hour-study-method|The 2-hour study method",
  "/deep-study-guide|Deep study guide",
  "/feynman-technique|The Feynman technique",
  "/exam|Exam prep guides",
  "/blog|Blog",
  "/study-method-quiz|Study method quiz",
  "/study-calculator|Study time calculator",
  "/pomodoro-timer|Pomodoro timer",
  "/study-timer|Study timer",
  "/focus-timer|Focus timer",
  "/virtual-study-room|Virtual study rooms",
  "/study-with-me|Study with me sessions",
  "/study-rooms|Live study rooms",
  "/breathe|2-minute breathing reset",
  "/break-free|60-second scroll reset",
];

/**
 * Build a `related` list from link groups without ever linking a page to itself
 * and without duplicates. Order matters: the first group is the most relevant.
 */
const relatedFor = (path, ...groups) => {
  const seen = new Set();
  const out = [];
  for (const group of groups) {
    for (const pair of group || []) {
      const href = String(pair).split("|")[0];
      if (!href || href === path || seen.has(href)) continue;
      seen.add(href);
      out.push(pair);
    }
  }
  return out;
};

/**
 * Links into the localized editions, for the English pages a reader would
 * naturally leave from. These exist for two reasons: a person comparing what
 * Premium costs should be able to read that in their own language, and the
 * orphan gate in scripts/seo-validate.mjs rightly refuses to let a page whose
 * only inbound link is its sibling count as discoverable.
 */
const EDITION_HOME_LINKS = [
  "/in|India edition",
  "/us|United States edition",
  "/hi|हिन्दी संस्करण",
  "/es|Edición en español",
  "/pt-br|Edição em português",
];

const EDITION_PRICING_LINKS = [
  "/in/pricing|Pricing for India",
  "/us/pricing|US pricing",
  "/hi/pricing|कीमत (हिन्दी)",
  "/es/pricing|Precios en español",
  "/pt-br/pricing|Preços em português",
];

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
      "Free AI focus timer that builds real deep-work habits: Pomodoro sessions, focus scores, streaks, live study rooms, and an AI coach. No credit card.",
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
    faq: [
      [
        "Do I need an account to use the timer?",
        "No. The focus timer is public and guest-first: open it, set a length and start. An account is only worth creating when you want your sessions, streaks and analytics saved across devices, or when you want the AI coach to read your history. You can use FocusArx for months without one.",
      ],
      [
        "Is FocusArx actually free?",
        "The core is free forever: the timer, tasks, streaks, study rooms, leaderboards, flashcards, the guide library and the analytics. Premium is optional and is paid for with Focus Tokens earned by finishing sessions rather than with money — 10,000 tokens buys 30 days — so the paid tier is reachable without a card.",
      ],
      [
        "What is the Focus Score?",
        "A 0–100 rating for a session, derived from completion, consistency and distraction events rather than from elapsed time. It exists because hours logged is a vanity metric: eight distracted hours and two deep ones look similar on a timesheet and nothing alike in what they produce.",
      ],
      [
        "Does the webcam feature record me?",
        "The attention monitor is optional and runs on-device: the model processes webcam frames in your browser and only the derived attention signal is stored. No video is uploaded. Everything else in FocusArx works with the camera off, and the camera-data page describes exactly what is and is not kept.",
      ],
    ],
    cta: { href: "/focus", label: "Start a focus session — free, no account" },
    related: GUIDE_LINKS,
  },

  // ── Auth ──────────────────────────────────────────────────────
  {
    path: "/signup",
    title: "Sign Up Free — AI Focus Timer",
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
    related: ["/guides|Explore free guides", "/pricing|Pricing — free forever", ...EDITION_HOME_LINKS],
  },
  {
    path: "/login",
    title: "Log In — AI Focus Timer",
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
    lastReviewed: ABOUT_REVIEWED,
    title: "About FocusArx: why we built a focus timer",
    description:
      "FocusArx helps students and professionals build unbreakable focus habits with an AI-powered, gamified deep-work platform.",
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
      {
        h: "Who writes this",
        p: "The FocusArx editorial team — the people who build the product. Every long-form page carries that byline and the date its copy was last checked, and the same date is what the sitemap advertises.",
      },
      {
        h: "How we research what we publish",
        p: "Claims link out to the primary source — the paper, the book or the exam body. Every metric we quote is on the evidence ledger with its definition, source, sample and date. We make no clinical claims, we invent no citations, and we sell no advertising, no data and no page ranking.",
      },
      {
        h: "Corrections",
        p: "Email focusarx@gmail.com and we will fix the page and move its last-updated date, so a reader can tell the correction happened.",
      },
    ],
    related: relatedFor("/about", COMPANY_LINKS, ["/achievements|Achievements", "/evidence|Evidence ledger"], POLICY_LINKS.slice(0, 3)),
  },
  {
    path: "/contact",
    title: "Contact & Support",
    description:
      "Get in touch with the FocusArx team for support, feedback, feature requests, or business enquiries. We reply within 24 hours.",
    h1: "Contact FocusArx",
    lead: "Questions, feedback, or partnership ideas? Reach the team at focusarx@gmail.com or through the contact form — we usually reply within 24 hours.",
    sections: [],
    related: relatedFor("/contact", COMPANY_LINKS, POLICY_LINKS.slice(0, 3)),
  },
  {
    path: "/support",
    title: "Help centre: FAQs, fixes and how to reach us",
    description:
      "Answers to common questions about FocusArx — the Pomodoro timer, focus sessions and scores, AI coaching, streaks and coins, study rooms, accounts, and privacy.",
    h1: "FocusArx Help Center",
    lead: "Fast answers to the most common questions about the timer, focus scores, streaks, coins, study rooms, and your account.",
    sections: [
      {
        h: "Popular topics",
        p: "How focus sessions and the Focus Score work; how streaks and XP are earned; how the two currencies differ — Focus Tokens buy Premium, Coins buy cosmetics; how live study rooms and leaderboards work; how optional on-device attention monitoring protects privacy; and how to manage or delete your account data.",
      },
      {
        h: "The three questions we get most",
        p: "Do I need an account? No — the timer is public and starts a session without one; an account only saves your history across devices. Is it really free? The timer, tasks, streaks, study rooms, flashcards and the guide library are free; Premium is optional and can be paid for with coins you earn by focusing. Is the webcam always on? Never — the attention monitor is opt-in, runs in your browser, and stores only the derived attention signal, never video.",
      },
      {
        h: "When something is actually broken",
        p: "Tell us what you did, what you expected and what happened, plus the browser and device. Screenshots of the Focus Score or the session in question help more than a description. If a session did not record, say so explicitly and roughly when it happened — sessions are verified server-side, so an unrecorded one is a bug worth chasing rather than a lost cause.",
      },
    ],
    cta: { href: "/contact", label: "Contact support" },
    related: relatedFor("/support", COMPANY_LINKS, POLICY_LINKS.slice(0, 4)),
  },
  {
    path: "/pricing",
    title: "FocusArx pricing: free plan, or premium coins",
    description:
      "FocusArx is completely free forever. Unlock Premium — advanced AI coaching, exclusive themes, deep insights — with coins you earn by focusing. No subscriptions.",
    h1: "Free forever. Premium by focusing.",
    lead: "The core platform — timer, tasks, streaks, analytics, study rooms — is free forever. Premium features are unlocked with Focus Tokens you earn by completing sessions, not with a credit card. Coins are a separate currency for cosmetics.",
    sections: [
      {
        h: "Free plan",
        p: "Unlimited Pomodoro and deep-work sessions, task and habit tracking, XP and streaks, basic analytics, live study rooms, and every guide in the FocusArx library.",
      },
      {
        h: "Premium (earned, not paid)",
        p: "Advanced AI coaching, exclusive themes and cosmetics, deeper Focus DNA insights, and productivity boosts — all purchased with Focus Tokens earned during sessions.",
      },
      {
        h: "Coins and Tokens are two different things",
        p: "FocusArx has two earned currencies and it is worth keeping them straight. Coins buy cosmetics and marketplace items. Focus Tokens buy Premium time, and they are what the plans are priced in. Both are earned by using the product; neither is sold.",
      },
      {
        h: "What Premium actually costs",
        p: "30 days is 10,000 Focus Tokens, 90 days is 25,000, and a year is 80,000. A completed focus session earns 50 tokens with a daily cap of 500, so ten sessions in a day is the ceiling; daily quests add 30, streaks 20, a referral 200. At the session rate alone a month of Premium is roughly 200 finished sessions, and quests, streaks and events shorten that. Every earn and spend is written to a ledger you can read, so nothing is quietly deducted.",
      },
    ],
    faq: [
      [
        "What exactly is free?",
        "Unlimited focus and deep-work sessions, tasks, habits and goals, XP and streaks, the session analytics, live study rooms, leaderboards, flashcards, and the whole guide library. There is no session limit, no trial timer and no account required to run the timer itself.",
      ],
      [
        "How do I earn Focus Tokens?",
        "By finishing focus sessions — 50 tokens each, capped at 500 a day — plus daily and weekly quests, streaks, daily rewards, battle-pass tiers and referrals. The caps exist so the Premium tier keeps meaning something, and the ledger records every earn and spend with its source.",
      ],
      [
        "Will there be a paid subscription?",
        "The token economy is the model, not a teaser for one: the intent is that Premium is reachable by using the product. Card payments are not the way in, and nothing that is free today moves behind a paywall to make that work.",
      ],
    ],
    related: relatedFor("/pricing", ["/signup|Start free", "/premium|Premium overview"], EDITION_PRICING_LINKS, COMPANY_LINKS),
  },
  {
    path: "/premium",
    title: "Premium Membership — Unlock with Focus Tokens",
    description:
      "FocusArx Premium unlocks advanced AI coaching, exclusive themes, deeper Focus DNA insights and boosts — bought with Focus Tokens you earn by studying. No card.",
    h1: "FocusArx Premium",
    lead: "Premium amplifies everything that works about FocusArx — smarter coaching, richer insights, exclusive cosmetics — and it's earned with focus, not bought.",
    sections: [],
    related: relatedFor("/premium", ["/pricing|Pricing", "/signup|Start free", "/leaderboard|Leaderboard", "/achievements|Achievements"], COMPANY_LINKS),
  },
  {
    path: "/roadmap",
    title: "FocusArx Product Roadmap | What's Next",
    description:
      "See what's shipping next on FocusArx — upcoming features, recent releases, and the direction of the platform. Updated weekly.",
    h1: "FocusArx product roadmap",
    lead: "What's shipped, what's next, and what we're exploring — updated weekly.",
    sections: [
      {
        h: "How we decide what to build",
        p: "Three inputs, in order. First, what breaks: a session that fails to record or a streak that resets wrongly outranks any new feature, because the product's whole promise is that the record is true. Second, what people ask for in support and in the feedback form — repeated requests beat loud ones. Third, what the guides argue: if we tell people that retrieval and spacing are what work, then flashcards and a review scheduler are not optional extras, they are the product keeping its own advice.",
      },
      {
        h: "What is deliberately not on this page",
        p: "Dates. A roadmap with dates on a product this size is a list of things we will be late on, and a missed date costs more trust than an absent one. What is here is direction and order, and the changelog is the record of what actually shipped. If something you need is not listed, say so through the feedback form — that is the input with the shortest path into the queue.",
      },
    ],
    cta: { href: "/changelog", label: "See what shipped recently" },
    related: relatedFor("/roadmap", ["/changelog|Changelog", "/about|About", "/contact|Send feedback"], COMPANY_LINKS),
  },

  // ── Guides & content ──────────────────────────────────────────
  {
    path: "/guides",
    title: "23 free focus and study guides (2026)",
    description:
      "Browse every free FocusArx guide — Pomodoro technique, deep work, study techniques, ADHD focus, beating procrastination, study music, and more.",
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
      {
        h: "How to use this library",
        p: "Do not read it end to end. Pick the problem you have today — cannot start, cannot remember, cannot sit still — and read the one guide that addresses it, then run a session with the timer before the idea decays. Every guide here ends in something you can do in the next hour, and the tools are there so that reading turns into a plan rather than another tab. If you are preparing for a specific exam, start from the exam hub instead: those plans are built around a real syllabus and date.",
      },
    ],
    faq: [
      [
        "Which guide should I read first?",
        "If you cannot get started, read how to stop procrastinating. If you study for hours and remember little, read the deep study guide or study techniques ranked by evidence. If your attention is the problem rather than your method, read how to focus. There is no required order — these are answers to different problems, not a course.",
      ],
      [
        "Are these guides free, and do I need an account?",
        "Every guide and tool in this library is free and readable without an account. An account only matters if you want your sessions, streaks and analytics saved across devices; the focus timer itself starts a session without one.",
      ],
      [
        "Where do the claims in these guides come from?",
        "Each guide that argues something names its sources in prose and links out to them — the paper, the book or the exam body. Where we cannot source a claim we do not make it, and the evidence ledger records what every number on this site means and where it came from.",
      ],
    ],
    article: true,
    cta: { href: "/focus", label: "Open the free focus timer" },
    // The live hub lists every guide and tool; the prerender must not claim
    // fewer, or a no-JS crawl sees nine pages nothing links to.
    related: relatedFor("/guides", ALL_GUIDE_LINKS, EDITION_PRICING_LINKS, COMPANY_LINKS.slice(0, 1)),
  },
  {
    path: "/focus-guide",
    lastReviewed: GUIDE_LIBRARY_REVIEWED,
    title: "How to focus: a science-based system (2026)",
    description:
      "Learn how to focus and master deep work — Pomodoro technique, time blocking, and flow state — plus a practical system to build unbreakable focus.",
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
      {
        h: "A starting system you can run today",
        p: "Choose one block tomorrow, at a fixed time, in a fixed place, and write down the single task it is for the night before. Put the phone in another room — not face down, another room, because its mere presence costs capacity even when it is ignored. Start a visible timer for 25 minutes and do not stop when it gets hard; stop when it rings, then take a real break away from a screen. Do that once a day for a week before changing anything. Almost every focus problem is easier to fix after seven days of one protected block, because the variables narrow down to something you can actually act on.",
      },
    ],
    faq: [
      [
        "How long should a focus session be?",
        "Start with 25 minutes and a 5 minute break, which is the classic Pomodoro shape and short enough to agree to on a bad day. Extend towards 50 or 90 minutes once starting is easy — longer intervals avoid paying the settling cost repeatedly, and most people need 5–20 minutes to get properly into a task. What matters more than the length is that the interval is bounded and uninterrupted.",
      ],
      [
        "Why do I lose focus after about 20 minutes?",
        "Because attention is not a steady supply; it comes in cycles, and the settling cost at the start of a task is real. Losing the thread at 20 minutes is normal, not a personal failing. The fixes are external rather than motivational: a timer you can see, a task with a defined next action, and an environment with fewer things competing for the bottom-up attention system.",
      ],
      [
        "Does phone blocking actually help?",
        "More than most interventions, and more than willpower. A phone in sight reduces available cognitive capacity even when it is off and face down, so the effective version is another room rather than another drawer. App blockers help when the phone has to stay nearby, but they are a second-best solution to physical distance.",
      ],
      [
        "Can you rebuild focus after months of scrolling?",
        "Yes, and faster than people expect, because the mechanism is habit and environment rather than damage. Expect the first week of protected blocks to feel worse before it feels better — the restlessness is the point at which the old habit is being refused. Keep the blocks short, keep the conditions identical, and measure focused minutes rather than how it felt.",
      ],
    ],
    sources: [
      "Leroy S., 'Why is it so hard to do my work?' (2009) — attention residue after a task switch.",
      "Ward A.F. et al., 'Brain Drain: The Mere Presence of One's Own Smartphone' (2017) — a visible phone costs cognitive capacity.",
      "Newport C., Deep Work (2016) — deep work as a trainable, schedulable practice.",
      "Cirillo F., The Pomodoro Technique — the 25/5 interval structure.",
    ],
    article: true,
    cta: { href: "/focus", label: "Start a 25 minute focus block — free" },
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
    lastReviewed: GUIDE_LIBRARY_REVIEWED,
    title: "Pomodoro technique: the complete guide (2026)",
    description:
      "Complete guide to the Pomodoro Technique: how 25/5 sprints work, mistakes to avoid, longer deep-work intervals, and the best free timer app.",
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
    lastReviewed: GUIDE_LIBRARY_REVIEWED,
    title: "Best study techniques, ranked by evidence (2026)",
    description:
      "The most effective study techniques ranked by evidence — active recall, spaced repetition, interleaving, elaboration — and how to combine them into a system.",
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
    faq: [
      [
        "What is the single most effective study technique?",
        "Practice testing — closing the book and reconstructing the material from memory. In the largest review of learning techniques it was rated high utility across ages, materials and test formats, and it beats rereading by a wide margin. If you only change one habit, make the last ten minutes of every session a blank-page recall.",
      ],
      [
        "Is spaced repetition worth the setup cost?",
        "For anything you need to remember for more than a few weeks, yes — it is the other high-utility technique, and the expanding schedule is what makes a memory durable rather than temporary. The setup is the friction, so start with one subject and let the schedule be simple: same day, next day, three days, a week, a month.",
      ],
      [
        "Why does rereading feel effective when it isn't?",
        "Because it produces fluency: the text becomes easy to process and that ease is misread as knowledge. Recognition is not retrieval, and an exam asks for retrieval. The uncomfortable techniques feel worse precisely because they require the effort that encoding needs — which is a useful rule of thumb, since the method that feels most productive is usually the least effective.",
      ],
      [
        "Should I interleave topics or block them?",
        "Interleave once a topic is basically understood. Blocking — many problems of one type in a row — is better while you are still learning the procedure, because it removes the need to choose a method. Mixing types afterwards is what teaches you to recognise which method applies, which is what an exam actually tests.",
      ],
    ],
    sources: [
      "Dunlosky J. et al., 'Improving Students' Learning With Effective Learning Techniques' (2013) — the evidence hierarchy this page is ordered by.",
      "Cepeda N.J. et al., 'Distributed Practice in Verbal Recall Tasks' (2006) — the spacing effect.",
      "Roediger H.L. & Karpicke J.D., 'Test-Enhanced Learning' (2006) — testing as a learning event, not only a measurement.",
    ],
    article: true,
    cta: { href: "/focus", label: "Start a study session — free" },
    related: [
      "/feynman-technique|The Feynman technique",
      "/deep-study-guide|Deep study guide",
      "/study-method-quiz|Find your study method (quiz)",
      "/guides|All guides",
    ],
  },
  {
    path: "/adhd-focus-tips",
    title: "How to Focus with ADHD: 15 Working Strategies",
    description:
      "Practical focus strategies that work with an ADHD brain — body doubling, the ten-minute rule, visible timers, immediate rewards and structure.",
    h1: "How to focus with ADHD: 15 strategies that work",
    lead: "ADHD isn't a willpower problem — it's a dopamine and attention-regulation difference. These strategies work with your brain instead of against it.",
    // Answer-first: the whole method in one quotable block, matching the
    // paragraph the page renders above its table of contents.
    answerFirst:
      "Focus with ADHD improves when starting is made cheap, time is made visible and finishing is rewarded immediately. Practically that means a ten-minute first block, a timer you can see, one tab open, body doubling where possible, and a real break afterwards. The fifteen strategies below are ordered by how much of that they solve.",
    sections: [
      {
        h: "Why does focus feel different with ADHD?",
        p: [
          "ADHD affects the executive functions: task initiation, working memory, time perception, and the regulation of attention and motivation. Two things follow. First, interest, novelty, urgency and challenge engage the ADHD brain — importance does not. A boring-but-critical task can feel impossible to start while a fascinating one absorbs you for hours.",
          "Second, dopamine signalling typically runs lower, so the reward for starting something tedious feels distant and weak. That is why shame-based motivation backfires: the problem was never effort or character. The fix is engineering — an environment where starting is easy, stimulation is managed and finishing is rewarded.",
        ],
      },
      {
        h: "Which 15 strategies actually work?",
        p: [
          "The ones that lower the cost of starting: body doubling (working alongside someone, in person or in a study room), the ten-minute rule, laughably small first steps, and capture lists so working memory is not holding the plan.",
          "The ones that make time visible: an external timer you can see rather than a phone clock, alarms as bookends around a block, and calendar time blocking instead of a to-do list with no hours attached.",
          "The ones that supply dopamine on schedule: immediate rewards at the end of a block, designed urgency that is chosen rather than panicked, novelty in the environment, and accountability to a person who will notice.",
          "And the ones that protect capacity: sleep at a consistent wake time, movement before a block, single-tab working, real non-phone breaks, energy-matched scheduling of hard tasks, implementation intentions written the night before, and professional treatment where appropriate.",
        ],
      },
      {
        h: "How do you build a daily focus system in 4 steps?",
        p: [
          "One ten-minute session before anything else, a visible timer around each block with a real break after it, a two-minute evening review that writes down tomorrow's first step, and a consistent wake time. Start absurdly small and grow the loop weekly — a system that survives a bad day is worth more than one that needs a good one.",
        ],
      },
      {
        h: "Which ADHD focus myths should you drop?",
        p: [
          "“Try harder” — effort is not the missing ingredient; structure and dopamine are. “You just need discipline” — discipline is finite in every brain and ADHD taxes it twice. “Hyperfocus means you can focus when you want to” — hyperfocus is interest-driven and involuntary, and it burns out the evening it swallows. “Music and video always distract” — for some ADHD brains a controlled level of background stimulation improves regulation, so experiment and measure.",
        ],
      },
    ],
    article: true,
    faq: [
      ["Can people with ADHD do deep work?", "Yes — usually in shorter blocks and with more external structure. Find your workable interval (often 10–25 minutes), protect it from distractions, and repeat it with real breaks. Hyperfocus can carry you further when a task engages you."],
      ["What is body doubling and why does it help ADHD?", "Body doubling is working alongside another person, in person or virtually. The quiet social pressure of being seen working helps regulate attention and task initiation — it's one of the most consistently reported-effective ADHD strategies."],
      ["How long should a Pomodoro be with ADHD?", "Start with 10–15 minutes — short enough that starting feels safe — and extend gradually toward 25. The timer's job is to get you started, not to stop you."],
      ["Why do I procrastinate so much with ADHD?", "ADHD procrastination is mostly a dopamine and task-initiation problem, not laziness. Solutions lower activation energy (tiny first steps, the 2-minute rule) or add dopamine (rewards, novelty, urgency, accountability)."],
      ["What is time blindness and how do I manage it?", "Time blindness is difficulty sensing elapsed time or task duration. Externalize it: visible timers, alarms as bookends, calendar time blocking, and short commitments."],
      ["Is this medical advice?", "No. It is workflow design drawn from the clinical literature on executive function. Diagnosis and treatment belong with a clinician who knows you."],
    ],
    related: [
      "/stop-procrastinating|How to stop procrastinating",
      "/adhd-focus-tools|ADHD-friendly focus tools",
      "/body-doubling|Body doubling explained",
      "/10-minute-timer|10 minute timer",
      "/study-with-me|Study with me sessions",
      "/focus-guide|How to focus: complete guide",
      "/study-timer-for-medical-students|Study timer for medical students",
      "/focus-timer-for-programmers|Focus timer for programmers",
      "/guides|All guides",
    ],
    lastReviewed: "2026-09-11",
    sources: [
      "Russell A. Barkley, Taking Charge of ADHD (3rd ed., Guilford Press, 2020) — ADHD as a disorder of self-regulation and executive function rather than of effort.",
      "Volkow N.D. et al., 'Dopamine transporter densities in adults with attention deficit hyperactivity disorder', American Journal of Psychiatry (2009) — reduced dopamine signalling.",
      "American Academy of Pediatrics, Clinical Practice Guideline for the Diagnosis, Evaluation, and Treatment of ADHD (2019) — behavioural interventions alongside medication where prescribed.",
      "Fabiano G.A. et al., 'A meta-analysis of behavioral treatments for attention-deficit/hyperactivity disorder' (2009) — structure, immediate feedback and external cues as the active ingredients.",
    ],
  },
  {
    path: "/stop-procrastinating",
    lastReviewed: GUIDE_LIBRARY_REVIEWED,
    title: "How to Stop Procrastinating: 12 Methods That Work | FocusArx",
    description:
      "Why you procrastinate (it's not laziness) and 12 proven ways to stop — the 2-minute rule, temptation bundling, and implementation intentions.",
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
    lastReviewed: GUIDE_LIBRARY_REVIEWED,
    title: "Study with me: free live sessions, 24/7",
    description:
      "Study with me alongside thousands of learners in live virtual rooms — silent body doubling, synced Pomodoro timers, and free 24/7 accountability.",
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
    lastReviewed: GUIDE_LIBRARY_REVIEWED,
    title: "Focus music: what science actually says (2026)",
    description:
      "Does study music actually help? What research says about lo-fi, binaural beats, noise colors, and silence — plus how to build a playlist that works.",
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
    lastReviewed: GUIDE_LIBRARY_REVIEWED,
    title: "How to Study 2 Hours Deeply, Not 12 Distracted",
    description:
      "The complete deep study guide: science-backed strategies for sustained concentration, memory retention, and peak academic performance.",
    h1: "The deep study guide",
    lead: "Sustained concentration, memory that lasts, and peak academic performance — assembled into one practical playbook.",
    sections: [
      {
        h: "What deep study means",
        p: "Deep study is extended, distraction-free engagement with material, combined with evidence-based encoding: active recall, spaced repetition, and elaboration instead of passive rereading. The distinction that matters is not how long you sat down but what your brain was made to do. Rereading and highlighting feel productive because recognition is easy; they produce almost no durable memory. Retrieval — closing the book and reconstructing the argument from scratch — feels worse and works substantially better.",
      },
      {
        h: "The playbook",
        p: "Structure sessions with warm-up, focused blocks, and retrieval practice; protect attention with environment design; space your reviews; and measure depth rather than hours sat at a desk. Concretely: open with five minutes of reviewing yesterday's notes to re-enter the material, work the hardest content in timed intervals with the phone in another room, then spend the last ten minutes writing down everything you can recall without looking. That closing retrieval is the part most students skip, and it is the part that does the learning.",
      },
      {
        h: "How to structure a deep study block",
        p: "A block has four phases and none of them is optional. Warm-up: two to five minutes of light review, which lowers the friction of starting and primes the relevant material. Focus: one task, one source, a visible timer, and no tab that is not the work — the timer matters because a bounded interval is easier to commit to than an open-ended afternoon. Retrieval: close everything and write or say what you remember, then check. Review: note what you missed and schedule the next retrieval for a longer interval than the last one. Two hours done this way beats six hours of rereading, which is the whole argument of the 2-hour study method.",
      },
      {
        h: "The mistakes that make study feel deep but aren't",
        p: "Rereading and highlighting, because familiarity is mistaken for knowledge. Replaying a lecture at speed instead of attempting a problem. Studying with the solution visible, which turns retrieval into reading. Cramming one subject for eight hours rather than spacing four sessions across a week — distributed practice is one of the most replicated findings in the learning literature. And measuring the day by hours logged rather than by what you could reproduce at the end of it, which is the only measure that predicts an exam.",
      },
      {
        h: "Spacing: the schedule that makes it stick",
        p: "Review at expanding intervals — same day, next day, three days, a week, then a month. Each successful retrieval after a gap strengthens the memory more than the previous one did, which is why the gap is the point rather than an inconvenience. In practice this means your first pass through new material should be the smallest part of your total time, and the reviews should be scheduled before you forget rather than when you feel like it. A study plan built from your exam date and available hours does this arithmetic for you.",
      },
    ],
    faq: [
      [
        "How many hours of deep study per day is realistic?",
        "For most students, two to four genuinely focused hours is a full day, and more than that usually means the later hours were shallow. Deep work is limited by attention, not by willpower: the useful move is to protect two hours completely rather than to sit for eight and check your phone through six of them. Track focused minutes rather than elapsed ones, and increase the protected block gradually as it becomes habitual.",
      ],
      [
        "Is deep study different from the Pomodoro technique?",
        "They operate at different scales and work well together. The Pomodoro technique is an interval structure — 25 minutes on, 5 off — that makes starting cheap and breaks predictable. Deep study is the content of those intervals: retrieval, elaboration and spacing rather than rereading. You can run perfect Pomodoros and learn very little if the intervals are spent passively, which is why the method and the encoding strategy are taught separately.",
      ],
      [
        "How do I know if a study session was actually deep?",
        "Test it at the end. Close the material and write down the argument, the derivation or the definitions from memory; what you can reconstruct is roughly what you learned. A session that ends with you able to reproduce more than at the start was deep, regardless of how it felt. A session that felt productive but leaves you unable to explain the topic without the notes in front of you was recognition, not learning.",
      ],
      [
        "What should I do when I cannot focus at all?",
        "Shrink the commitment rather than fighting it. Agree to ten minutes only, with permission to stop when the timer rings — avoidance is driven by the anticipated cost of a long undefined effort, so lowering that cost is usually enough to begin, and beginning is most of the problem. If the block still will not hold, change the environment: a different room, a library, or a live study room where other people are working. Phone in another room does more than any app.",
      ],
    ],
    sources: [
      "Dunlosky J. et al., 'Improving Students' Learning With Effective Learning Techniques' (2013) — practice testing and distributed practice rated high utility; rereading and highlighting rated low.",
      "Karpicke J.D. & Roediger H.L., 'The Critical Importance of Retrieval for Learning' (2008) — repeated retrieval, not repeated study, is what makes a memory persist.",
      "Cepeda N.J. et al., 'Distributed Practice in Verbal Recall Tasks' (2006) — spacing reviews across sessions beats massing them, across ages and materials.",
      "Ebbinghaus H. (1885) — the forgetting curve, and the original observation that spacing slows it.",
    ],
    article: true,
    cta: { href: "/focus", label: "Start a deep study block — free" },
    related: [
      "/study-techniques|Best study techniques",
      "/two-hour-study-method|The 2-hour study method",
      "/science-of-deep-work|The science of deep work",
      "/focus|Open the focus timer",
      "/guides|All guides",
    ],
  },
  {
    path: "/two-hour-study-method",
    lastReviewed: GUIDE_LIBRARY_REVIEWED,
    title: "The 2-Hour Study Method: Focused Sessions Win",
    description:
      "Master the 2-hour focused study method: warm-up, intense focused study, retrieval practice, and review — the structure that beats scattered, unfocused hours.",
    h1: "The 2-hour study method",
    lead: "A structured two-hour block — warm-up, deep study, retrieval, review — that outperforms scattered, unfocused hours.",
    sections: [
      {
        h: "The structure",
        p: "Warm up with a light review to re-enter the material, work through focused Pomodoro-style intervals on the hardest content, finish with active-recall testing, and close with a brief review that sets up tomorrow's session. The four phases are not equally long: roughly ten minutes of warm-up, eighty minutes of focused work in two or three intervals, twenty minutes of retrieval, and ten minutes of review and planning.",
      },
      {
        h: "Why it works",
        p: "The warm-up lowers entry friction, timed intervals protect depth, retrieval practice is where learning actually consolidates, and the closing review leverages the spacing effect across days. The cap is the point, too: a block with a known end is easier to start than an open-ended evening, and knowing it ends stops the low-grade bargaining that turns an afternoon into nothing.",
      },
      {
        h: "Minute by minute",
        p: "Minutes 0–10, warm-up: read yesterday's summary or the headings of today's material, and write one line about what you are trying to be able to do by the end. Minutes 10–55, first interval: the hardest thing on the list, phone out of the room, one source open. Minutes 55–65, real break — stand up, no screen. Minutes 65–100, second interval: continue, or switch to a problem set if the reading has gone flat. Minutes 100–115, retrieval: everything closed, write what you can reconstruct, then check and mark the gaps. Minutes 115–120, plan: three lines on what tomorrow's block starts with, and when the next review of this material is due.",
      },
      {
        h: "Making the block survive a real day",
        p: "Pick the time before you pick the content, and put it in the calendar as an appointment with a location. Protect the ten minutes before it — that is when most blocks are lost, to a message or a tab opened 'just quickly'. Have the material ready the night before so the block does not start with a search. And when a block is missed, move it rather than dropping it: a plan that collapses after one bad day is a plan that will collapse.",
      },
      {
        h: "Two hours or four?",
        p: "Two hours, once a day, beats four hours twice a week: the spacing between sessions is itself part of the method. If you have more time, run a second block later in the day on different material rather than extending the first one — the retrieval at the end of each block is what consolidates it, and two retrievals beat one. Beyond roughly four focused hours in a day the marginal hour is usually shallow, and it is better spent on review than on new material.",
      },
    ],
    faq: [
      [
        "Why two hours and not four or six?",
        "Because the block has to be repeatable daily, and because focused attention is a limited resource. A two-hour block is something most people can protect every day for months; a six-hour block is something people plan once and abandon by Wednesday. Consistency plus spacing beats intensity, and a shorter daily block gives you both.",
      ],
      [
        "What if I only have 45 minutes today?",
        "Compress, do not skip. Cut the warm-up to three minutes, run one 25-minute interval, and keep the full ten minutes of retrieval at the end — retrieval is the part that consolidates, and it is the part that survives compression. A short block that ends with recall beats a long block that ends with rereading.",
      ],
      [
        "Should I use a timer during the block?",
        "Yes. A visible countdown makes the interval concrete, gives you a reason not to check anything until it rings, and turns 'study for a while' into a bounded commitment you can actually agree to. Pre-arming the length also removes a decision at the moment your motivation is lowest. The focus timer starts a 25, 50 or 90 minute block without an account.",
      ],
      [
        "Does this work for problem-based subjects like maths or physics?",
        "It works better for them than for reading subjects. Replace the reading intervals with problems attempted without the solution visible, and let the retrieval phase be re-attempting the ones you got wrong from a blank page. Reading a worked solution feels like progress and produces very little; struggling at the problem and then checking is what encodes the method.",
      ],
    ],
    sources: [
      "Cepeda N.J. et al., 'Distributed Practice in Verbal Recall Tasks' (2006) — spacing sessions beats massing them, which is the argument for daily blocks.",
      "Karpicke J.D. & Roediger H.L., 'The Critical Importance of Retrieval for Learning' (2008) — the closing retrieval phase is where consolidation happens.",
      "Cirillo F., The Pomodoro Technique — the interval structure the focused phase is built on.",
    ],
    article: true,
    cta: { href: "/focus?duration=50", label: "Start a 50 minute block — free" },
    related: [
      "/pomodoro-guide|Pomodoro technique guide",
      "/study-techniques|Best study techniques",
      "/deep-study-guide|Deep study guide",
      "/study-calculator|Plan your study hours",
      "/guides|All guides",
    ],
  },
  {
    path: "/science-of-deep-work",
    lastReviewed: GUIDE_LIBRARY_REVIEWED,
    title: "The neuroscience of deep work, explained (2026)",
    description:
      "Explore the biological mechanisms behind deep work — myelin, neurotransmitters, attention networks, and how to enter the flow state faster.",
    h1: "The neuroscience of deep work",
    lead: "What actually happens in your brain during deep work — and why focused repetition physically rewires it.",
    sections: [
      {
        h: "The mechanism",
        p: "Repeated focused firing of neural circuits wraps them in myelin, making them faster and more reliable — the biological basis of skill. Neurotransmitters like dopamine and norepinephrine gate attention and motivation. This is why deliberate practice, and not time spent, is what changes performance: the circuit has to be driven hard and specifically to be reinforced, which is the finding Ericsson's work on expert performance rests on.",
      },
      {
        h: "Flow states",
        p: "Flow emerges when challenge slightly exceeds skill with clear goals and immediate feedback. You can engineer the conditions instead of waiting for the mood. Concretely that means: a task with a defined next action rather than a vague intention, difficulty adjusted so it is neither trivial nor hopeless, and some signal of progress inside the session — a problem set completing, a word count rising, a timer counting down. Remove the feedback and flow becomes luck.",
      },
      {
        h: "Why switching costs more than it feels like it does",
        p: "Every task switch leaves attention residue: part of your attention stays on the previous task for some minutes afterwards, degrading the next one. That is why an afternoon of small interruptions produces less than an uninterrupted hour, and why it does not feel that way — the residue is invisible from the inside. Interrupted work also gets finished faster but at a higher stress cost, which is the trade the research on interrupted work describes. The practical implication is brutal and simple: batching shallow work into one block is worth more than any productivity app.",
      },
      {
        h: "What actually restores attention",
        p: "Rest that down-regulates arousal restores it; rest that stimulates does not. A break spent scrolling delivers novelty and dopamine while leaving attention more fragmented than before, which is why the break can make the next block harder rather than easier. Slow exhale-weighted breathing, a short walk, looking at something distant, or two minutes of doing nothing at all reliably work better. The rule to hold onto: a break should lower arousal, not raise it.",
      },
      {
        h: "Designing the environment, not the willpower",
        p: "Willpower is a poor lever because it has to be spent every single time. Environment design spends once. The mere presence of your own smartphone reduces available cognitive capacity even when it is face down and untouched, so the phone leaves the room rather than the desk. Browser tabs that are not the work get closed before the block starts, not resisted during it. And a session with a visible end is easier to enter than an open-ended one, which is the entire reason a timer helps. None of this is discipline; it is removing the decisions.",
      },
    ],
    faq: [
      [
        "How long does it take to get into deep work?",
        "Most people need somewhere between five and twenty minutes to settle, and it is longer after an interruption than from a cold start. That settling cost is per session, not per hour, which is why one four-hour block produces more than four one-hour blocks. It also means ending a session the moment it gets interesting is expensive: you paid the entry cost and got none of the depth.",
      ],
      [
        "Is deep work the same as flow?",
        "No, though they overlap. Deep work is a category of effortful, undistracted, cognitively demanding work — you can be doing deep work while finding it hard and unpleasant. Flow is a subjective state of effortless absorption that sometimes appears inside deep work when challenge and skill are well matched. Treating flow as the goal is a trap: it is a by-product, and chasing the feeling leads to easier tasks.",
      ],
      [
        "Can you train yourself to focus for longer?",
        "Yes, in the same way you train endurance: by progressively extending the protected block and keeping the conditions constant. Start with an interval you can genuinely hold — 15 or 25 minutes — and lengthen it by a few minutes once it feels easy. What you cannot do is jump from a fragmented day to a four-hour block on willpower alone; the environment and the timer do most of that work.",
      ],
      [
        "Does music help or hurt concentration?",
        "It depends on the task and the music. Lyrics reliably interfere with language-based work — reading, writing, learning vocabulary — because they compete for the same processing. Instrumental, predictable, low-novelty audio can help by masking a noisy environment and giving the attentional system something boring to settle on. New and interesting music hurts almost everything. If you cannot tell whether it is helping, run a week without it and compare what you finish.",
      ],
    ],
    sources: [
      "Leroy S., 'Why is it so hard to do my work?' (2009) — attention residue: a previous task keeps consuming attention after a switch.",
      "Mark G., Gudith D. & Klocke U., 'The Cost of Interrupted Work: More Speed and Stress' (2008) — interrupted work is completed faster but at higher stress.",
      "Ward A.F. et al., 'Brain Drain: The Mere Presence of One's Own Smartphone' (2017) — a phone in sight reduces available cognitive capacity even when ignored.",
      "Ericsson K.A. et al., 'The Role of Deliberate Practice in the Acquisition of Expert Performance' (1993) — specific, effortful practice drives improvement.",
    ],
    article: true,
    cta: { href: "/focus", label: "Start a focus session — free" },
    related: [
      "/focus-guide|How to focus: complete guide",
      "/deep-study-guide|Deep study guide",
      "/focus-music|What music helps concentration",
      "/breathe|2-minute breathing reset",
      "/guides|All guides",
    ],
  },
  {
    path: "/feynman-technique",
    lastReviewed: GUIDE_LIBRARY_REVIEWED,
    title: "The Feynman technique: learn any subject faster",
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
        p: "Explaining forces retrieval and elaboration — the two strongest learning techniques — and exposes illusory comprehension, the 'I recognize it so I know it' trap that rereading hides. The blank page is the whole mechanism: with the source open you can paraphrase without understanding, and you will. Without it, the gaps announce themselves immediately.",
      },
      {
        h: "Doing it properly, step by step",
        p: "Step one: write the concept at the top of a blank page, and underneath it write what you expect to be able to explain — one sentence defining the boundary. Step two: explain it out loud or in writing using only everyday words, and ban the technical terms of the subject; where you are tempted to reach for jargon, that is usually where the understanding is thinnest. Step three: when you stall, mark the exact point with a question mark and go back to the source for that one point only, then start the explanation again from the top rather than patching the hole. Step four: build an analogy and then attack it — every analogy breaks somewhere, and finding where it breaks is a more precise test of understanding than the analogy itself.",
      },
      {
        h: "The three failure modes",
        p: "Reciting: reproducing the textbook's phrasing from memory, which tests recall of wording rather than understanding — the fix is the vocabulary ban. Patching: filling a gap and moving on, which leaves the explanation held together by a step you still cannot justify — the fix is restarting from the top. Over-analogising: reaching for a metaphor before you can state the mechanism plainly, which makes the explanation sound good and stay fragile. All three feel like progress, which is why the technique needs the blank page as an honest referee.",
      },
      {
        h: "Where it fits in a study session",
        p: "Use it at the end of a block, not the beginning: it is a test of what a session produced, and running it as the retrieval phase costs nothing extra. It works best on concepts with a mechanism — a process, a proof, a causal chain — and less well on pure lists, where spaced flashcards are the better tool. For exam preparation, write the explanation as an answer to a past-paper question: that combines the elaboration benefit with practice at the format you will be marked in.",
      },
    ],
    faq: [
      [
        "How long should a Feynman explanation take?",
        "Five to fifteen minutes per concept. If it takes much longer you have chosen too large a unit — split it, because 'explain thermodynamics' is not a concept and 'explain why entropy increases in an isolated system' is. The technique works on units small enough that a single gap is identifiable.",
      ],
      [
        "Do I have to write it down, or can I say it out loud?",
        "Either works, and out loud is faster, but writing leaves something you can revisit and it makes the stalls unambiguous — you can see the sentence you could not finish. The strongest version is to explain it to another person, or to a study room, because a listener asks the question you were avoiding.",
      ],
      [
        "Does this work for maths and programming?",
        "Yes, with one adjustment: explain the derivation or the code line by line, saying why each step follows from the last, and then close the source and reproduce it from a blank page. Being able to narrate a solution you are looking at is not the same as being able to produce it, and the blank-page step is what separates the two.",
      ],
      [
        "How is this different from active recall?",
        "Active recall is retrieving a fact or an answer; the Feynman technique is reconstructing a mechanism in your own words and simplifying it. Recall answers 'what is it', Feynman answers 'why does it follow'. They compose: recall first to find what you have lost, Feynman on the concepts that survived to check they survived properly.",
      ],
    ],
    sources: [
      "Dunlosky J. et al., 'Improving Students' Learning With Effective Learning Techniques' (2013) — elaborative interrogation and self-explanation rated effective; rereading rated low.",
      "Karpicke J.D. & Roediger H.L., 'The Critical Importance of Retrieval for Learning' (2008) — explaining without the source is retrieval, which is why the blank page matters.",
    ],
    article: true,
    cta: { href: "/focus", label: "Start a study block — free" },
    related: [
      "/study-techniques|Best study techniques",
      "/deep-study-guide|Deep study guide",
      "/focus|Open the focus timer",
      "/guides|All guides",
    ],
  },
  {
    path: "/study-method-quiz",
    title: "3-question study method quiz: find your system",
    description:
      "Take the free 2-minute study method quiz. Discover whether active recall, spaced repetition, or Pomodoro best matches your learning style.",
    h1: "Which study method works best for you?",
    lead: "Two minutes, a handful of questions — and a study method matched to your brain, schedule, and goals.",
    sections: [
      {
        h: "What the quiz covers",
        p: "Your attention span, deadline pressure, subject mix, and preferred session length. The result maps you to the technique family — Pomodoro intervals, deep blocks, recall-first, or social study — most likely to stick.",
      },
      {
        h: "The three questions",
        p: "How long you can focus before feeling restless, what your study environment is actually like, and what today's goal is — clearing small tasks, learning something new, or producing work like writing and code. Three questions is not much, and it is deliberate: the answers that decide a method are the ones you already know, and a forty-item instrument would mostly measure how patient you are. Each answer scores towards Pomodoro, Flowtime or deep work, and the highest score wins.",
      },
      {
        h: "What to do with the result",
        p: "Run it for a week before judging it. A short-attention, noisy-environment answer points at 25-minute Pomodoro intervals because the break is built in and the interval is short enough to agree to; a long-attention, quiet-environment answer points at 50–90 minute deep blocks where the settling cost is paid once. If the recommendation feels wrong after a week, take the quiz again with the other environment in mind — the method should match the conditions you actually study in, not the ones you wish you had.",
      },
    ],
    cta: { href: "/study-method-quiz", label: "Take the 2-minute quiz" },
    related: [
      "/study-techniques|Best study techniques",
      "/study-calculator|Study time calculator",
      "/guides|All guides",
    ],
  },
  {
    path: "/study-calculator",
    title: "Study time calculator: plan your sessions (2026)",
    description:
      "Free study time calculator: enter your exam date, topics, and available hours to get a personalized, retention-optimized study schedule.",
    h1: "Study time calculator",
    lead: "Enter your exam date, topics, and available hours — get a personalized study schedule optimized for retention, not cramming.",
    sections: [
      {
        h: "What it does",
        p: "The calculator distributes your topics across the days you actually have, front-loads harder material, schedules spaced reviews at expanding intervals, and balances daily load so the plan survives contact with real life.",
      },
      {
        h: "What to put in it",
        p: "The real exam date, not the one you are aiming at; the honest number of hours you can study on a normal weekday and on a weekend day; and the topic list with a rough difficulty judgement for each. Understating your hours is the one error worth making on purpose — a plan built on six hours a day that you only manage three collapses in the first week, and a collapsed plan is worse than a modest one because it also costs you the belief that planning works.",
      },
      {
        h: "Why it schedules reviews",
        p: "Because the first pass through material is the cheapest part of learning it and the part most students over-invest in. Reviews spaced at expanding intervals — next day, three days, a week, a month — are what convert a topic you have seen into one you can recall under exam conditions, and doing that arithmetic by hand across fifteen topics is why people end up cramming instead. The calculator puts the reviews in the diary so they happen before the forgetting does.",
      },
    ],
    cta: { href: "/study-calculator", label: "Build my study plan" },
    related: [
      "/study-method-quiz|Study method quiz",
      "/two-hour-study-method|The 2-hour study method",
      "/guides|All guides",
    ],
  },
  {
    path: "/virtual-study-room",
    lastReviewed: GUIDE_LIBRARY_REVIEWED,
    title: "Virtual Study Room — Study With Strangers | FocusArx",
    description:
      "Join a free virtual study room and study online with strangers. Live 24/7 rooms for JEE, NEET, UPSC & coding — browse free, accountability included.",
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
      {
        h: "Rooms for every subject",
        p: "Public rooms are organized by subject — JEE and engineering, NEET and medical, UPSC, coding and computer science, language learning, and general study — so you focus alongside people working on the same material.",
      },
      {
        h: "Privacy and safety",
        p: "Cameras are optional and off by default; nobody sees your screen. Rooms are moderated, with one-tap reporting and clear conduct rules — see the room safety page for the full policy.",
      },
    ],
    article: true,
    // Mirrors the visible FAQ rendered by src/pages/virtual-study-room.tsx —
    // FAQPage JSON-LD must describe content the reader can actually see.
    faq: [
      [
        "What is a virtual study room?",
        "A virtual study room is an online space where people study at the same time with a shared timer and live presence. You see that others are working, they see that you are — that mutual visibility (often called body doubling) makes it easier to start and to keep going.",
      ],
      [
        "Do I need my camera on?",
        "No. Cameras are optional and off by default in FocusArx rooms. Most people study with cameras off — presence and the shared timer do the work.",
      ],
      [
        "Is it free?",
        "Yes. Browsing rooms is free without an account, and joining rooms is free with a free account. There is no trial countdown and no credit card.",
      ],
      [
        "Who are the rooms for?",
        "Students preparing for exams (JEE, NEET, UPSC, GATE, board exams), university students, self-learners, and remote workers who focus better with company. Rooms are organized by subject so you can study alongside people working on the same thing.",
      ],
      [
        "Is it safe?",
        "Rooms are moderated, reporting is one tap away, and cameras are off by default. Read the full moderation and safety policy on our room safety page.",
      ],
    ],
    related: [
      "/study-with-me|Study with me sessions",
      "/body-doubling|Body doubling guide",
      "/pomodoro-guide|Pomodoro technique guide",
      "/safety|Room safety and moderation",
      "/guides|All guides",
    ],
  },

  // ── Public gamification / wellness ────────────────────────────
  {
    path: "/study-rooms",
    title: "Live study rooms: focus alongside others free",
    description:
      "Browse and join live FocusArx study rooms — synchronized Pomodoro timers, live presence, and instant accountability. Free, 24/7.",
    h1: "Live study rooms",
    lead: "Browse public rooms, see who's focusing right now, and join in one click — or create a private room for your friends.",
    sections: [
      {
        h: "What a study room is",
        p: "A live room is a shared timer with other people attached. Everyone in it runs the same interval at the same time, you can see who is in a session and who is on a break, and there is a chat for the moments between blocks. Nothing is broadcast and no camera is involved unless you turn the optional attention monitor on for yourself — the accountability is the presence of other people working, which is the part that turns out to matter.",
      },
      {
        h: "Why it works",
        p: "This is body doubling: doing a task alongside someone else makes starting easier and stopping less tempting, and it works even when the other person never speaks to you. It is one of the more reliable interventions for people who can focus in a library and not at home, and for ADHD brains that need external structure rather than internal resolve. A room also gives a session a start time, which removes the negotiation about when to begin.",
      },
      {
        h: "Creating a room",
        p: "Set a name, an optional topic or exam, the mode (Pomodoro by default), the interval length, an ambience track, a participant cap and whether the room is public or private. Public rooms appear in the browse list; private rooms are reachable by link, which is what you want for a study group or a class. Rooms are free and run around the clock, so there is usually somebody in one at any hour you study.",
      },
    ],
    cta: { href: "/study-rooms", label: "Browse live rooms" },
    related: ["/virtual-study-room|About virtual study rooms", "/study-with-me|Study with me guide", "/body-doubling|What body doubling is", "/focus|Open the timer"],
  },
  {
    path: "/leaderboard",
    title: "Focus leaderboard: rank your deep work free",
    description:
      "See who's leading the FocusArx leaderboard — top focus champions ranked by XP, streaks, and total focused time. Updated live.",
    h1: "FocusArx leaderboard",
    lead: "Top focus champions ranked by XP, streaks, and total focused time — updated live.",
    sections: [
      {
        h: "How the ranking works",
        p: "Two boards: This Week, which resets and is the one worth caring about, and All Time. You earn XP for completing focus sessions, for keeping a streak alive and for finishing missions, so the board measures focused work rather than time spent with a tab open. A weekly reset matters — an all-time board is won by whoever started earliest, while a weekly one can be entered by anybody on a Monday.",
      },
      {
        h: "Why a leaderboard helps at all",
        p: "Comparison is a cheap and honest source of motivation for some people and a source of misery for others, and it is worth knowing which you are. Used well, the board answers a specific question — did I do more than last week — rather than the corrosive one. If it makes you feel behind, ignore it: the streak and your own session history carry the same information without the ranking.",
      },
    ],
    cta: { href: "/focus", label: "Start a session and get on the board" },
    related: relatedFor("/leaderboard", ["/signup|Join and compete", "/achievements|Achievements", "/premium|Premium"], COMPANY_LINKS.slice(0, 6)),
  },
  {
    path: "/achievements",
    title: "Achievements and badges for focused work",
    description:
      "Explore FocusArx achievements — 65+ badges across focus time, streaks, session quality, missions, social, and special milestones.",
    h1: "FocusArx achievements",
    lead: "65+ badges across focus time, streaks, session quality, missions, social, and special milestones.",
    sections: [],
    related: relatedFor("/achievements", ["/leaderboard|Leaderboard", "/signup|Start earning badges", "/premium|Premium"], COMPANY_LINKS.slice(0, 6)),
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
      {
        h: "The three patterns, and when to use each",
        p: "Box breathing, 4-4-4-4, is the default: inhale four, hold four, exhale four, hold four. It is even and slightly alerting, which makes it the right choice before a block rather than after one. The 4-7-8 pattern — inhale four, hold seven, exhale eight — puts the exhale twice the length of the inhale and is the more sedating of the two, so use it at the end of a session or when the mind will not shut up. The 2-2-2 quick reset is short enough to run between two tasks without losing your place, which makes it the one you will actually use.",
      },
      {
        h: "Getting something out of two minutes",
        p: "Sit with your feet on the floor and let the exhale be longer than feels natural; the exhale is where the effect lives. Follow the animated guide rather than counting, because counting is a second task and the point is to have no tasks. If two minutes feels pointless, run it twice — the second round is usually where the shoulders drop. Run it before a session to start clean, and after one to stop the next task inheriting the last one's residue.",
      },
    ],
    cta: { href: "/breathe", label: "Start the 2-minute reset" },
    related: relatedFor("/breathe", ["/break-free|60-second scroll reset", "/focus-guide|How to focus: complete guide", "/focus-music|Focus music guide", "/guides|All guides"], COMPANY_LINKS.slice(0, 1)),
  },
  {
    path: "/break-free",
    title: "Break free from a distraction spiral (free)",
    description:
      "Caught in a scroll spiral? A free 60-second reset that gets you out of the loop and back into your work — no shame, just a protocol.",
    h1: "Break free from the distraction spiral",
    lead: "You're 60 seconds of deliberate action away from ending the scroll loop. No shame — just a protocol that works.",
    sections: [
      {
        h: "What this page is",
        p: "A short protocol for the moment you notice you have been scrolling for forty minutes and cannot seem to stop. It is not an article and it is not a lecture. It runs you through naming the urge, sitting with it rather than fighting it, logging how you actually feel, and making one small pledge you can keep — the whole thing takes about a minute, which is the point, because a long intervention is no use at the moment the loop has hold of you.",
      },
      {
        h: "Why urge surfing rather than willpower",
        p: "An urge is a wave: it rises, peaks and falls on its own if you do not feed it. Fighting it head-on usually fails because the fight is itself a form of engagement. Urge surfing asks you to notice the pull, describe it, and wait — most urges crest within a few minutes. Pairing that with a mood check-in works because the scroll is usually solving something else: boredom, anxiety, avoidance of a task that feels undefined. Naming the actual feeling gives you a better option than the feed.",
      },
      {
        h: "The streak and the pledge wall",
        p: "Every time you run the protocol it counts, and the milestones are marked at the intervals where things genuinely change — a week, a month, two months. The pledge wall shows what other people committed to and when, which is a quieter form of accountability than a leaderboard: nobody is ranked, you are just not the only one doing this tonight.",
      },
    ],
    cta: { href: "/break-free", label: "Run the 60-second reset" },
    related: relatedFor("/break-free", ["/stop-scrolling|How to stop scrolling", "/stop-procrastinating|How to stop procrastinating", "/breathe|Breathing reset", "/guides|All guides"], COMPANY_LINKS.slice(0, 1)),
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
    related: relatedFor("/privacy", POLICY_LINKS, ["/contact|Contact us"], COMPANY_LINKS.slice(0, 1)),
  },
  {
    path: "/terms",
    title: "Terms of Service | FocusArx",
    description: "The terms governing your use of the FocusArx AI productivity platform.",
    h1: "FocusArx terms of service",
    lead: "The agreement between you and FocusArx when you use the platform.",
    sections: [],
    related: relatedFor("/terms", POLICY_LINKS, COMPANY_LINKS.slice(0, 1)),
  },
  {
    path: "/cookie-policy",
    title: "Cookie Policy | FocusArx",
    description: "How FocusArx uses cookies — minimal, for authentication and analytics. No third-party tracking cookies.",
    h1: "FocusArx cookie policy",
    lead: "We use the minimum number of cookies needed to keep you signed in and improve the product.",
    sections: [],
    related: relatedFor("/cookie-policy", POLICY_LINKS, COMPANY_LINKS.slice(0, 1)),
  },
  {
    path: "/acceptable-use",
    title: "Acceptable Use Policy | FocusArx",
    description: "Guidelines for responsible use of the FocusArx platform and community standards.",
    h1: "FocusArx acceptable use policy",
    lead: "The short list of things that keep FocusArx safe and useful for everyone.",
    sections: [],
    related: relatedFor("/acceptable-use", POLICY_LINKS, ["/contact|Report a problem"], COMPANY_LINKS.slice(0, 1)),
  },
  {
    path: "/ai-policy",
    title: "AI Policy | How We Use AI",
    description: "How FocusArx uses artificial intelligence — our AI features, data handling, and privacy-first approach to machine learning.",
    h1: "How FocusArx uses AI",
    lead: "Where AI appears in the product, what it does and doesn't touch, and the privacy-first rules it operates under.",
    sections: [],
    related: relatedFor("/ai-policy", POLICY_LINKS, ["/focus-guide|How to focus guide"], COMPANY_LINKS.slice(0, 1)),
  },

  // ── Tool landing pages with bespoke components ────────────────
  // These have hand-written page components rather than the shared
  // seo-landing renderer, but they still need prerender entries or crawlers
  // that do not run JavaScript see the homepage <title> on these URLs.
  {
    path: "/focus-timer",
    title: "Free focus timer: Pomodoro and deep work (2026)",
    description:
      "Free focus timer with Pomodoro, deep work sessions, ambient sound and XP. Track completion, streaks and your focus score. No credit card required.",
    h1: "Free Focus Timer for Deep Work",
    lead: "Start a Pomodoro or a custom 10–180 minute deep work session. Every completed session is scored, stored and folded into your streak.",
    answerFirst:
      "A focus timer bounds a block of work so starting is cheap and stopping is deliberate. FocusArx runs Pomodoro and custom-length sessions in the browser, scores each one, and tracks completion, streaks and focus quality over time.",
    software: {
      name: "FocusArx Focus Timer",
      category: "ProductivityApplication",
      description:
        "Focus and deep work timer with session scoring, streaks, ambient sound and progress analytics.",
    },
    sections: [
      {
        h: "What the free timer includes",
        p: "25-minute Pomodoro sessions, basic task tracking, streaks, one pet, a starter city, daily quests and public study rooms. No credit card and no trial countdown.",
      },
      {
        h: "What Premium adds",
        p: "Custom 10–180 minute presets, session sequences, fullscreen zen mode, sound mixing, intentions and reflections, saved templates, and 180-day analytics with export. Premium is unlocked with Focus Tokens earned from completed sessions rather than purchased.",
      },
      {
        h: "How Focus Tokens work",
        p: "You earn 50 tokens for each focus session of 25 minutes or more (capped at 10 per day), plus bonuses for daily and weekly quests and streaks. Spend them on Premium, pets and cosmetics. The ledger is server-authoritative and idempotent — no real money is involved anywhere.",
      },
    ],
    faq: [
      ["Is the focus timer free?", "Yes. The core timer, tasks, streaks and public rooms are free forever. Premium unlocks with Focus Tokens earned from completed sessions."],
      ["How long can a session be?", "The default is 25 minutes. Premium presets allow 10 to 180 minutes for deep-work blocks."],
      ["Do I need an account?", "Only to save sessions, streaks and analytics. The timer runs without one."],
    ],
    cta: { href: "/focus", label: "Start a free focus session" },
    related: ["/pomodoro-timer|Pomodoro timer", "/study-timer|Study timer", "/deep-work-guide|Deep work guide", "/focus-guide|How to focus"],
    lastReviewed: "2026-08-29",
  },
  {
    path: "/focus",
    title: "FocusArx focus timer: start a session free",
    description:
      "The FocusArx focus app: a free online timer with tasks, streaks and session scoring.",
    h1: "Focus, running in your browser",
    lead: "One screen: the time that is left, the task you picked, and a Start button. Guests can run a full session with no account; signing in later saves history, streaks and analytics.",
    answerFirst:
      "The /focus app is the usable timer itself, not a page about a timer. Open /focus?duration=25&task=Revise+thermo to pre-arm a 25-minute slice with a task attached.",
    software: {
      name: "FocusArx Focus App",
      category: "ProductivityApplication",
      description:
        "Guest-first focus timer with tasks, streaks, session scoring and deep links.",
    },
    sections: [
      {
        h: "How a session works",
        p: "Pick a duration or follow a link with one baked in. Press Start once — the timer is deadline-based, so background tabs, screen lock and sleep do not skew it. Pausing preserves the slice; completing records minutes, XP and streak progress.",
      },
      {
        h: "Guests and accounts",
        p: "Guests keep the current session across refresh and close on the same device. Signing in adds cloud history, streaks across devices, the AI coach and study rooms; local history is imported once, never overwritten.",
      },
    ],
    faq: [
      ["Do I need an account to use /focus?", "No. The timer runs fully for guests. An account adds cloud history, streaks, AI coaching and rooms."],
      ["Can I link to a pre-set timer?", "Yes. /focus?duration=25&task=Revise+thermo arms a 25-minute slice with the task attached. Links from Instagram use /go/ig."],
      ["Does the timer survive a locked phone?", "Yes. Remaining time derives from a wall-clock deadline, and the server re-verifies durations on save."],
    ],
    cta: { href: "/signup", label: "Save sessions with a free account" },
    related: ["/focus-timer|Focus timer guide", "/pomodoro-timer|Pomodoro timer", "/study-timer|Study timer", "/pricing|Pricing — free forever"],
    lastReviewed: "2026-09-04",
  },
  {
    path: "/changelog",
    title: "Changelog",
    description:
      "What shipped in FocusArx lately: timer reliability fixes, streaks in your timezone, the /focus app and Instagram funnel.",
    h1: "Changelog",
    lead: "What shipped lately, newest first. Short sentences. No hype.",
    sections: [
      {
        h: "Unreleased",
        p: "Guest timer sessions survive refresh and close. One tab runs the timer at a time. Streaks use your timezone. The public /focus app accepts deep links, and /go/ig arms it for Instagram traffic.",
      },
      {
        h: "Version 1.0 and earlier",
        p: "Apple-style interface pass, prerendered SEO pages with exam guides, server-verified sessions, guest accounts, server-only AI with budgets, and an installable PWA shell.",
      },
    ],
    faq: [
      [
        "How often does FocusArx ship?",
        "Most weeks. Reliability fixes go out as they are verified rather than waiting for a batch, and larger features land when the contract tests around them are green. The changelog is written from what merged, not from what was intended, so an entry is a record rather than a promise.",
      ],
      [
        "Why does the changelog look so plain?",
        "On purpose. Each entry says what changed and who it affects, in one or two sentences, because a changelog is read by people checking whether their bug was fixed. Marketing copy in a changelog is noise at exactly the moment someone is looking for a fact.",
      ],
    ],
    related: ["/focus|Focus app", "/roadmap|Product roadmap", "/pricing|Pricing"],
    lastReviewed: "2026-09-04",
  },
  {
    path: "/search",
    // Mirrors PAGE_SEO.search: internal search results stay out of the index
    // and out of the sitemap (see artifacts/api-server/src/routes/sitemap.ts).
    noindex: true,
    title: "Search Guides, Tools & Features",
    description:
      "Search every FocusArx guide, study tool and feature — Pomodoro timers, study rooms, focus guides, calculators and exam prep.",
    h1: "Search FocusArx",
    lead: "Find a guide, a tool or a feature across the whole FocusArx library.",
    answerFirst:
      "FocusArx search covers the full guide library, the free tools and the product features. Start with the guide library if you are browsing, or jump straight to the Pomodoro timer if you want to start a session now.",
    sections: [
      {
        h: "Popular destinations",
        p: "The guide library, the Pomodoro timer, the study time calculator, live study rooms, and the exam prep hub.",
      },
    ],
    cta: { href: "/guides", label: "Browse the guide library" },
    related: ["/guides|All guides", "/pomodoro-timer|Pomodoro timer", "/exam|Exam prep hub", "/study-rooms|Live study rooms"],
  },

  // ── Comparison / alternative pages ────────────────────────────
  // Generated from COMPARISONS in src/content/seo-pages.mjs so the
  // prerendered copy, the rendered page (src/pages/comparison.tsx) and the
  // sitemap can never disagree about what a comparison says.
  ...COMPARISON_PATHS.map((path) => {
    const slug = path.replace(/^\/comparison\//, "");
    const c = Object.values(COMPARISONS).find((x) => x.slug === slug);
    return {
      path,
      title: c.title,
      description: c.description,
      h1: c.title,
      lead: c.lead,
      // ── Feature table ────────────────────────────────────────────────
      // The rendered page (src/pages/comparison.tsx) draws this table from
      // `c.rows`, but the prerendered document used to carry only the two prose
      // verdicts — so a crawler that does not execute JavaScript saw a
      // different page than a visitor, and every row label was absent from the
      // HTML that actually gets indexed. The table is declared here from the
      // SAME `COMPARISONS` entry the React page reads, so the two cannot drift:
      // there is no second list to keep in step.
      //
      // Cells are emitted as text, never as an icon: `true`/`false` become
      // Yes/No. A tick glyph in a `<td>` is invisible to a text extractor, and
      // screen readers announce the SVG's title rather than the capability.
      table: {
        caption: `FocusArx compared with ${c.name}`,
        // Column headers, in order, after the row-label column.
        columns: ["FocusArx", c.name],
        // [rowLabel, focusarxCell, competitorCell] — verbatim from the page.
        rows: c.rows.map(([label, ours, theirs]) => [
          label,
          cellText(ours),
          cellText(theirs),
        ]),
      },
      sections: [
        {
          h: `When FocusArx is the better fit`,
          p: c.whenOurs,
          // The page renders `c.ours` as a checklist under this paragraph; the
          // prerenderer flattened it away.
          bullets: c.ours,
        },
        {
          h: `When ${c.name} is the better fit`,
          p: c.whenTheirs,
          bullets: c.theirs,
        },
      ],
      faq: [
        [`When should I choose FocusArx over ${c.name}?`, c.whenOurs],
        [`When should I choose ${c.name} over FocusArx?`, c.whenTheirs],
      ],
      article: true,
      lastReviewed: COMPARISONS_REVIEWED,
      // Every sibling comparison, not the first three. The live page
      // (src/pages/comparison.tsx) already renders the full set; truncating it
      // here meant two of the six comparisons had no inbound link at all in the
      // prerendered HTML.
      related: relatedFor(
        path,
        COMPARISON_PATHS.map((p) => `${p}|${Object.values(COMPARISONS).find((x) => `/comparison/${x.slug}` === p).title}`),
        ["/focus-guide|How to focus", "/guides|All guides", "/pomodoro-timer|Pomodoro timer"],
      ),
    };
  }),

  // ── Exam guide cluster (Workstream E) ─────────────────────
  {
    path: "/exam",
    // The hub belongs to the exam cluster and was reviewed with it.
    lastReviewed: EXAM_CLUSTER_REVIEWED,
    title: EXAM_HUB.title,
    description: EXAM_HUB.description,
    h1: EXAM_HUB.h1,
    lead: EXAM_HUB.lead,
    sections: EXAM_HUB.sections,
    faq: EXAM_HUB.faq,
    // EXAM_HUB.related is derived in src/content/exam/index.mjs: every exam
    // guide plus its dedicated timer page.
    related: relatedFor("/exam", EXAM_HUB.related, COMPANY_LINKS.slice(0, 1)),
  },
  ...EXAM_GUIDES.map((g) => ({
    path: `/exam/${g.slug}`,
    // Content files own their headings in full; the search-result copy is bounded
    // here so an authored 180-character description is clipped by us, at a clause
    // boundary, instead of mid-sentence by Google.
    title: clampText(g.title.replace(/\s*[|—–]\s*FocusArx\s*$/, ""), PAGE_TITLE_BUDGET, { fullStop: false }),
    description: clampText(g.description, DESCRIPTION_BUDGET),
    h1: g.h1,
    lead: g.lead,
    sections: g.sections,
    faq: g.faq,
    article: true,
    ogImage: examOgImage(g.title.replace(/\s*\|\s*FocusArx.*$/i, ""), g.lead),
    related: g.related,
    // The cluster was reviewed as a set when the nine state, professional and
    // international guides joined it. A date nobody can stand behind is worse
    // than no date, so it is the review date rather than the build date.
    lastReviewed: EXAM_CLUSTER_REVIEWED,
  })),

  // ── Blog (one source: src/content/blog.mjs — extend there) ────
  {
    path: "/blog",
    title: "FocusArx blog: focus, deep work, study science",
    description:
      "Short essays on focus, deep work and study science: why 25 minutes works, attention residue, and body doubling.",
    h1: "Blog",
    lead: "Short essays on attention and studying. Each one ends in something you can do today.",
    sections: [
      {
        h: "What this blog is for",
        p: "One idea per post, argued from a source you can check, and closed with something you can do in the next hour. That constraint is deliberate: a 900-word essay you act on today beats a 4,000-word guide you bookmark and never open. Where a topic needs the long treatment it becomes a guide in the library instead, and the posts link to it.",
      },
      ...BLOG_POSTS.map((p) => ({ h: p.h1, p: p.lead })),
    ],
    faq: [
      [
        "How often do you publish?",
        "Irregularly, and on purpose. A post goes up when there is a claim worth making and a source behind it, not to a calendar. There is an RSS feed at /feed.xml if you would rather be told than check.",
      ],
      [
        "Are these posts written by an AI?",
        "They are written and maintained by the people who build the product, and every claim that comes from research names the paper or the book so you can read it yourself. The editorial standards page sets out what we will and will not publish, including the rule against inventing citations.",
      ],
    ],
    related: relatedFor("/blog", [...BLOG_POSTS.map((p) => `/blog/${p.slug}|${p.h1}`), "/focus|Focus app"], ALL_GUIDE_LINKS.slice(0, 6), COMPANY_LINKS.slice(0, 1)),
    lastReviewed: "2026-09-05",
  },
  ...BLOG_POSTS.map((p) => ({
    path: `/blog/${p.slug}`,
    title: clampText(p.title.replace(/\s*[|—–]\s*FocusArx\s*$/, ""), PAGE_TITLE_BUDGET, { fullStop: false }),
    description: clampText(p.description, DESCRIPTION_BUDGET),
    h1: p.h1,
    lead: p.lead,
    // Publication date and reading time: the byline renders them and the
    // BlogPosting schema needs a real datePublished rather than the build date.
    date: p.date,
    readMin: p.readMin,
    sections: p.sections,
    faq: p.faq,
    article: true,
    related: [
      ...BLOG_POSTS.filter((q) => q.slug !== p.slug).map((q) => `/blog/${q.slug}|${q.h1}`),
      // The tools and guides the essay argues for — mirrors `post.related`
      // rendered by src/pages/blog-post.tsx, so the prerendered document and the
      // live page carry the same outbound links.
      ...(p.related || []),
      "/focus|Focus app",
    ],
    lastReviewed: p.date,
  })),

  // ── Programmatic exam funnels (one source each: exam/*.mjs + exam-funnel.mjs)
  ...EXAM_GUIDES.filter((g) => FUNNEL_ANGLES[g.slug]).map((g) => {
    const funnel = FUNNEL_ANGLES[g.slug];
    const examName = g.exam?.name ?? g.h1;
    // Title, H1 and description all come from exam/derive.mjs, which the client
    // page renders from too — one derivation, so the static document and the
    // hydrated page cannot disagree. The label is the exam's short name: the
    // full one ("NDA & NA (National Defence Academy / Naval Academy)") used to
    // be clamped into a title reading "…(National Defence", and a title cut
    // mid-parenthesis is worse in the SERP than a plainer one.
    return {
      path: `/pomodoro-timer-for/${g.slug}`,
      title: funnelTitle(g.slug),
      description: funnelDescription(g.slug),
      h1: funnelHeading(g.slug),
      lead: funnel.angle,
      sections: g.sections.slice(0, 3),
      faq: g.faq?.slice(0, 3),
      // Its own guide, the other exam timers, and the hub — mirroring the
      // sibling list src/pages/exam-funnel.tsx renders.
      related: relatedFor(
        `/pomodoro-timer-for/${g.slug}`,
        [
          `/exam/${g.slug}|Full ${examName} guide`,
          "/exam|Exam prep hub",
          "/pomodoro-timer|Pomodoro timer",
          "/focus|Focus app",
        ],
        EXAM_GUIDES.filter((other) => FUNNEL_ANGLES[other.slug] && other.slug !== g.slug).map(
          (other) => `/pomodoro-timer-for/${other.slug}|${funnelHeading(other.slug)}`,
        ),
      ),
      lastReviewed: "2026-09-05",
    };
  }),

  // ── Intent pages: tools, cluster spokes, trust ────────────────
  // Generated from src/content/seo-pages.mjs. That file is imported by the
  // client page (src/pages/seo-landing.tsx) as well, so the static HTML a
  // crawler reads and the page a visitor sees are the same text — no
  // cloaking, and no second copy to keep in sync.
  ...Object.entries(SEO_PAGES).map(([path, e]) => ({
    path,
    title: e.title,
    description: e.description,
    h1: e.h1,
    lead: e.lead,
    answerFirst: e.answerFirst,
    sections: e.sections,
    faq: e.faq,
    howTo: e.howTo,
    software: e.software,
    article: e.kind === "guide",
    lastReviewed: e.lastReviewed,
    sources: e.sources,
    cta: e.cta,
    related: e.related,
  })),

  // ── Localized editions ────────────────────────────────────────
  // Ten pages in five markets (India, US, Hindi, Spanish, Brazilian
  // Portuguese), written in src/content/locale-pages.mjs. They carry two extra
  // keys the prerenderer consumes: `lang` for <html lang> and `ogLocale` for
  // og:locale. Everything else — title budget, FAQ schema, byline, citation
  // registry, content-depth gate — applies to them exactly as it does to the
  // English pages, which is the point: a localized page is held to the same
  // standard rather than waved through as "translated".
  ...localeRouteEntries(),
];

// ── Discovery links ──────────────────────────────────────────────────
/**
 * Valuable pages that are easy to orphan, rotated across every prerendered
 * route.
 *
 * A page whose only inbound links are a sitemap entry is crawled rarely and
 * ranks as though it were optional — that is what the orphan gate in
 * scripts/seo-validate.mjs exists to catch. Rotating two of these into each
 * route's "Keep reading" block spreads link equity deterministically (index
 * order, so builds are reproducible) instead of relying on every author to
 * remember the thin pages. These are real pages with real copy, and the same
 * `related` array is what src/pages/seo-landing.tsx renders for visitors.
 */
const DISCOVERY_ROTATION = [
  "/stop-scrolling|How to stop scrolling",
  "/adhd-focus-tools|ADHD-friendly focus tools",
  "/feynman-technique|The Feynman technique",
  "/leaderboard|Focus leaderboard",
  "/two-hour-study-method|The 2-hour study method",
  "/body-doubling|Body doubling explained",
  "/blog|FocusArx blog",
  "/achievements|Achievements and badges",
  "/study-method-quiz|Study method quiz",
  "/break-free|60-second scroll reset",
];

{
  ROUTES.forEach((entry, index) => {
    const path = entry.path === "" ? "/" : entry.path;
    const existing = new Set((entry.related || []).map((pair) => String(pair).split("|")[0]));
    existing.add(path);
    const picks = [
      DISCOVERY_ROTATION[index % DISCOVERY_ROTATION.length],
      DISCOVERY_ROTATION[(index + 4) % DISCOVERY_ROTATION.length],
    ].filter((pair) => {
      const href = String(pair).split("|")[0];
      if (existing.has(href)) return false;
      existing.add(href);
      return true;
    });
    if (picks.length > 0) entry.related = [...(entry.related || []), ...picks];
  });
}
