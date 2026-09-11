import { useEffect } from "react";
import { clampText, composeTitle, DESCRIPTION_BUDGET, HREFLANG_LOCALES } from "@/lib/seo-text.mjs";
import { breadcrumbListSchema, breadcrumbTrail } from "@/lib/breadcrumbs.mjs";

interface PageSEOProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  keywords?: string;
  /**
   * Label for the last breadcrumb crumb — pass the page's H1. Defaults to the
   * composed title with the brand suffix stripped, which is often too long and
   * sometimes mid-sentence (a manifest title is clamped for search results).
   * The visible trail in components/Breadcrumbs.tsx must say the same thing.
   */
  breadcrumbLabel?: string;
  noindex?: boolean;
  structuredData?: object | object[];
}

// Single source of truth for the canonical origin. Defaults to the production
// domain but can be overridden per deployment via VITE_APP_URL so canonical /
// og:url / og:image URLs never drift out of sync with where the app is hosted.
// Canonical host is www: the apex 308-redirects here (vercel.json + the Vercel
// primary-domain setting), so every canonical must be www or it points at a
// redirect and Google drops the page.
const BASE_URL = (import.meta.env.VITE_APP_URL || "https://www.focusarx.site").replace(/\/+$/, "");
const DEFAULT_OG_IMAGE = `${BASE_URL}/opengraph.jpg`;

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

// Audience annotations for the single English edition: India first, then the
// wider English-speaking world, with x-default as the fallback. All four point
// at the current page because there is one edition, not four — index.html and
// scripts/prerender.mjs emit the same cluster, so the DOM after navigation and
// the static HTML a crawler reads can never disagree.
function setHreflang(url: string | null) {
  const existing = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]'),
  );

  if (url === null) {
    existing.forEach((el) => el.remove());
    return;
  }

  // Fast path: the cluster is already there in the right order (the static
  // build wrote it, or a previous route did), so a navigation only rewrites
  // four href attributes.
  const inOrder = HREFLANG_LOCALES.map((locale, i) => {
    const el = existing[i];
    return el && el.getAttribute("hreflang") === locale ? el : null;
  });
  if (inOrder.every((el) => el !== null) && existing.length === HREFLANG_LOCALES.length) {
    inOrder.forEach((el) => el!.setAttribute("href", url));
    return;
  }

  // Otherwise rebuild the whole cluster, in locale order, immediately after
  // the canonical — which is where the prerendered documents put it. Inserting
  // each element after the canonical instead of after the previous one reverses
  // the cluster, so the anchor moves as we go.
  existing.forEach((el) => el.remove());
  let anchor: Element | null = document.querySelector('link[rel="canonical"]');
  for (const locale of HREFLANG_LOCALES) {
    const el = document.createElement("link");
    el.setAttribute("rel", "alternate");
    el.setAttribute("hreflang", locale);
    el.setAttribute("href", url);
    if (anchor?.nextSibling) anchor.parentNode?.insertBefore(el, anchor.nextSibling);
    else document.head.appendChild(el);
    anchor = el;
  }
}

function setStructuredData(id: string, data: object) {
  let el = document.querySelector(`script[data-seo-id="${id}"]`) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.setAttribute("type", "application/ld+json");
    el.setAttribute("data-seo-id", id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data, null, 2);
}

function removeStructuredData(id: string) {
  const el = document.querySelector(`script[data-seo-id="${id}"]`);
  if (el) el.remove();
}

export function PageSEO({
  title,
  description,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  keywords,
  breadcrumbLabel,
  noindex = false,
  structuredData,
}: PageSEOProps) {
  useEffect(() => {
    const prevTitle = document.title;
    const fullTitle = composeTitle(title);
    // `canonical` is a path ("/blog/x"). If a caller passes an absolute URL by
    // mistake, use it as-is — prepending the base would emit a garbage
    // "https://www.…https://…" canonical (shipped once on the blog, funnel and
    // two guide pages before the call sites were fixed to paths).
    const canonicalUrl = !canonical
      ? BASE_URL
      : /^https?:\/\//i.test(canonical)
        ? canonical
        : `${BASE_URL}${canonical}`;

    document.title = fullTitle;

    const finalDescription = clampText(description, DESCRIPTION_BUDGET);
    setMeta("description", finalDescription);
    setMeta("robots", noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
    if (keywords) setMeta("keywords", keywords);

    setLink("canonical", canonicalUrl);
    setHreflang(noindex ? null : canonicalUrl);

    setMeta("og:title", fullTitle, "property");
    setMeta("og:description", finalDescription, "property");
    setMeta("og:url", canonicalUrl, "property");
    setMeta("og:image", ogImage, "property");
    setMeta("og:image:width", "1200", "property");
    setMeta("og:image:height", "630", "property");
    setMeta("og:image:alt", fullTitle, "property");
    setMeta("og:type", ogType, "property");
    setMeta("og:site_name", "FocusArx", "property");
    setMeta("og:locale", "en_US", "property");

    setMeta("twitter:title", fullTitle, "name");
    setMeta("twitter:description", finalDescription, "name");
    setMeta("twitter:image", ogImage, "name");
    setMeta("twitter:card", "summary_large_image", "name");
    setMeta("twitter:site", "@focusarx", "name");
    setMeta("twitter:creator", "@focusarx", "name");

    if (structuredData) {
      const arr = Array.isArray(structuredData) ? structuredData : [structuredData];
      arr.forEach((sd, i) => setStructuredData(`page-sd-${i}`, sd));
    }

    // Breadcrumb schema, derived from the same trail the visible breadcrumbs
    // render (components/Breadcrumbs.tsx) and the same trail the prerenderer
    // writes into the static document. Three renderers, one derivation — a
    // visible trail that disagrees with the structured data is how the rich
    // result gets dropped.
    if (canonical && canonical !== "/") {
      setStructuredData(
        "breadcrumb-sd",
        breadcrumbListSchema(breadcrumbTrail(canonical, { title: breadcrumbLabel ?? title }), BASE_URL),
      );
    }

    return () => {
      document.title = prevTitle;
      if (structuredData) {
        const arr = Array.isArray(structuredData) ? structuredData : [structuredData];
        arr.forEach((_sd, i) => removeStructuredData(`page-sd-${i}`));
      }
      removeStructuredData("breadcrumb-sd");
    };
  }, [title, description, canonical, ogImage, ogType, keywords, breadcrumbLabel, noindex, structuredData]);

  return null;
}

export const PAGE_SEO: Record<string, Omit<PageSEOProps, "canonical"> & { canonical: string }> = {
  home: {
    canonical: "/",
    title: "FocusArx — AI Pomodoro Timer & Deep Work Tracker",
    // No user count here. "50,000+ people" was unsourced — no counting
    // definition, no period, no way for a reader to check it. Any number we
    // publish has to appear on the /evidence claim ledger first.
    description: "Free AI focus timer and deep work tracker — Pomodoro sessions, focus scores, streaks, live study rooms and an AI coach. No credit card required.",
    keywords: "focus timer, AI focus timer, Pomodoro timer, deep work app, AI productivity coach, focus streak tracker, gamified productivity, free study timer",
  },
  profiles: {
    canonical: "/profiles",
    title: "Focus Profiles | Custom Network Blockers | FocusArx",
    description: "Create custom network focus profiles. Automatically block social media and distracting domains based on your location or task. Precision focus control.",
    keywords: "website blocker, focus profiles, block reddit, study mode, distraction free browsing",
  },
  about: {
    canonical: "/about",
    title: "About FocusArx: why we built a focus timer",
    description: "FocusArx helps students and professionals build unbreakable focus habits with an AI-powered, gamified deep-work platform.",
    keywords: "about FocusArx, FocusArx mission, FocusArx team, FocusArx story, AI productivity company",
  },
  contact: {
    canonical: "/contact",
    title: "Contact & Support",
    description: "Get in touch with the FocusArx team for support, feedback, feature requests, or business enquiries. We reply within 24 hours.",
    keywords: "contact FocusArx, FocusArx support, FocusArx email, FocusArx help",
  },
  support: {
    canonical: "/support",
    title: "Help centre: FAQs, fixes and how to reach us",
    description: "Answers to common questions about FocusArx — the Pomodoro timer, focus sessions and scores, AI coaching, streaks and coins, study rooms, accounts, and privacy.",
    keywords: "FocusArx help, FocusArx FAQ, FocusArx support center, FocusArx questions, how to use FocusArx",
  },
  pricing: {
    canonical: "/pricing",
    title: "FocusArx pricing: free plan, or premium coins",
    description: "FocusArx is completely free forever. Unlock Premium — advanced AI coaching, exclusive themes, deep insights — with coins you earn by focusing. No subscriptions.",
    keywords: "FocusArx free, free focus timer, free study app, deep work features, FocusArx premium coins",
  },
  onboarding: {
    canonical: "/onboarding",
    title: "Onboarding | Calibrate Your Focus DNA | FocusArx",
    description: "Initialize your deep work environment. We'll calibrate your focus goals and study style for peak performance.",
    keywords: "onboarding, focus setup, productivity calibration",
  },
  forgeRoom: {
    canonical: "/forge-room",
    title: "Forge Room | Live Collective Flow | FocusArx",
    description: "Study alongside thousands of elite learners in the Forge Room. Real-time group resonance and collective focus multipliers.",
    keywords: "virtual study room, group study online, focus together, online library",
  },
  privacy: {
    canonical: "/privacy",
    title: "Privacy Policy | FocusArx",
    description: "How FocusArx collects, uses, and protects your data. Optional webcam attention monitoring is processed on-device — video never leaves your browser.",
    keywords: "FocusArx privacy policy, FocusArx data, FocusArx GDPR",
  },
  terms: {
    canonical: "/terms",
    title: "Terms of Service | FocusArx",
    description: "The terms governing your use of the FocusArx AI productivity platform.",
    keywords: "FocusArx terms of service, FocusArx terms, FocusArx conditions",
  },
  focusGuide: {
    canonical: "/focus-guide",
    title: "How to focus: a science-based system (2026)",
    description: "Learn how to focus and master deep work — Pomodoro technique, time blocking, and flow state — plus a practical system to build unbreakable focus.",
    keywords: "how to focus, improve focus, deep work, how to concentrate, focus guide, build focus habits, Pomodoro method, flow state, FocusArx focus guide",
  },
  pomodoroGuide: {
    canonical: "/pomodoro-guide",
    title: "Pomodoro technique: the complete guide (2026)",
    description: "Complete guide to the Pomodoro Technique: how 25/5 sprints work, mistakes to avoid, longer deep-work intervals, and the best free timer app.",
    keywords: "Pomodoro technique, Pomodoro timer, Pomodoro method, best Pomodoro app, Pomodoro guide, FocusArx Pomodoro, study Pomodoro",
  },
  studyTechniques: {
    canonical: "/study-techniques",
    title: "Best study techniques, ranked by evidence (2026)",
    description: "The most effective study techniques ranked by evidence — active recall, spaced repetition, interleaving, elaboration — and how to combine them into a system.",
    keywords: "study techniques, best study methods, active recall, spaced repetition, effective studying, study tips, student productivity techniques, FocusArx study",
  },
  virtualStudyRoom: {
    canonical: "/virtual-study-room",
    title: "Virtual study room: focus with others, free",
    description: "Join a free virtual study room and focus with other learners online. Synchronized Pomodoro timers, live presence, 24/7 rooms, cameras optional.",
    keywords: "virtual study room, study with others online, online study room, co-study app, study accountability, group study online, FocusArx study rooms",
  },
  roadmap: {
    canonical: "/roadmap",
    title: "FocusArx Product Roadmap | What's Next",
    description: "See what's shipping next on FocusArx — upcoming features, recent releases, and the direction of the platform. Updated weekly.",
    keywords: "FocusArx roadmap, FocusArx features, FocusArx upcoming, FocusArx future",
  },
  analytics: {
    canonical: "/analytics",
    title: "Focus Analytics | Deep Focus Data & Insights",
    description: "Deep dive into your focus data. Visualize your productivity trends, best focus hours, and performance streaks with FocusArx analytics.",
    keywords: "focus analytics, productivity data, study patterns, focus trends, FocusArx data",
  },
  dashboard: {
    canonical: "/dashboard",
    title: "Dashboard | Your Command Center",
    description: "Manage your deep focus sessions, track daily goals, and see your academic city grow in real-time from your FocusArx dashboard.",
    keywords: "productivity dashboard, focus command center, daily goals, FocusArx home",
  },
  city: {
    canonical: "/city",
    title: "Focus City | Build Your Academic Civilization",
    description: "Watch your study hours turn into a thriving digital city. Unlock buildings, increase your population, and evolve your civilization with every focus session.",
    keywords: "gamified productivity, focus city, study rewards, virtual city, FocusArx gamification",
  },
  scienceOfDeepWork: {
    canonical: "/science-of-deep-work",
    title: "The neuroscience of deep work, explained (2026)",
    description: "Explore the biological mechanisms behind deep work — myelin, neurotransmitters, attention networks, and how to enter the flow state faster.",
    keywords: "science of focus, deep work neuroscience, myelin study, flow state biology, FocusArx science",
  },
  feynmanTechnique: {
    canonical: "/feynman-technique",
    title: "The Feynman technique: learn any subject faster",
    description: "Learn the Feynman Technique — the ultimate method for rapid learning. Four simple steps to understand complex topics by explaining them simply.",
    keywords: "feynman technique, rapid learning, study methods, richard feynman, how to learn anything",
  },
  deepStudyGuide: {
    canonical: "/deep-study-guide",
    title: "How to Study 2 Hours Deeply, Not 12 Distracted",
    description: "The complete deep study guide: science-backed strategies for sustained concentration, memory retention, and peak academic performance.",
    keywords: "deep study, study guide, how to study effectively, deep learning techniques, concentration tips",
  },
  twoHourStudyMethod: {
    canonical: "/two-hour-study-method",
    title: "The 2-Hour Study Method: Focused Sessions Win",
    description: "Master the 2-hour focused study method: warm-up, intense focused study, retrieval practice, and review — the structure that beats scattered, unfocused hours.",
    keywords: "2 hour study method, study session structure, timed studying, focus blocks",
  },
  studyMethodQuiz: {
    canonical: "/study-method-quiz",
    title: "3-question study method quiz: find your system",
    description: "Take the free 2-minute study method quiz. Discover whether active recall, spaced repetition, or Pomodoro best matches your learning style.",
    keywords: "study method quiz, which study method, learning style quiz, best study technique quiz",
  },
  studyCalculator: {
    canonical: "/study-calculator",
    title: "Study time calculator: plan your sessions (2026)",
    description: "Free study time calculator: enter your exam date, topics, and available hours to get a personalized, retention-optimized study schedule.",
    keywords: "study time calculator, study schedule planner, exam study planner, how many hours to study",
  },
  dataDeletion: {
    canonical: "/data-deletion",
    title: "Data Deletion Request | FocusArx",
    description: "Request deletion of your FocusArx account and all associated data. We process all deletion requests within 30 days.",
    keywords: "FocusArx delete account, FocusArx data deletion, delete my data",
    noindex: true,
  },
  cookiePolicy: {
    canonical: "/cookie-policy",
    title: "Cookie Policy | FocusArx",
    description: "How FocusArx uses cookies — minimal, for authentication and analytics. No third-party tracking cookies.",
    keywords: "FocusArx cookies, FocusArx cookie policy",
  },
  acceptableUse: {
    canonical: "/acceptable-use",
    title: "Acceptable Use Policy | FocusArx",
    description: "Guidelines for responsible use of the FocusArx platform and community standards.",
    keywords: "FocusArx acceptable use, FocusArx community guidelines",
  },
  aiPolicy: {
    canonical: "/ai-policy",
    title: "AI Policy | How We Use AI",
    description: "How FocusArx uses artificial intelligence — our AI features, data handling, and privacy-first approach to machine learning.",
    keywords: "FocusArx AI, FocusArx artificial intelligence, AI privacy, how AI works FocusArx",
  },
  leaderboard: {
    canonical: "/leaderboard",
    title: "Focus leaderboard: rank your deep work free",
    description: "See who's leading the FocusArx leaderboard — top focus champions ranked by XP, streaks, and total focused time. Updated live.",
    keywords: "FocusArx leaderboard, top students, focus champions, productivity ranking",
  },
  signup: {
    canonical: "/signup",
    title: "Sign Up Free — AI Focus Timer",
    description: "Create your free FocusArx account in 30 seconds. AI Pomodoro timer, focus scores, streaks, live study rooms. No credit card required.",
    keywords: "sign up FocusArx, create account, free focus app registration",
  },
  login: {
    canonical: "/login",
    title: "Log In — AI Focus Timer",
    description: "Log in to FocusArx to continue your focus streaks, sessions, study rooms, and AI productivity coaching.",
    keywords: "log in FocusArx, sign in, FocusArx login",
  },
  guides: {
    canonical: "/guides",
    title: "23 free focus and study guides (2026)",
    description: "Browse every free FocusArx guide — Pomodoro technique, deep work, study techniques, ADHD focus, beating procrastination, study music, and more.",
    keywords: "study guides, focus guides, productivity guides, free study resources, how to focus, how to study",
  },
  adhdFocus: {
    canonical: "/adhd-focus-tips",
    title: "How to Focus with ADHD: 15 Working Strategies",
    description: "Practical focus strategies that actually work for ADHD brains — body doubling, the 10-minute rule, dopamine-friendly rewards, timers, and structure.",
    keywords: "how to focus with ADHD, ADHD study tips, ADHD concentration, focus strategies ADHD, ADHD productivity, ADHD time blindness, body doubling study",
  },
  stopProcrastinating: {
    canonical: "/stop-procrastinating",
    title: "How to Stop Procrastinating: 12 Methods That Work | FocusArx",
    description: "Why you procrastinate (it's not laziness) and 12 proven ways to stop — the 2-minute rule, temptation bundling, and implementation intentions.",
    keywords: "how to stop procrastinating, stop procrastination, why do I procrastinate, procrastination help, overcome procrastination, 2 minute rule, motivation to study",
  },
  studyWithMe: {
    canonical: "/study-with-me",
    title: "Study with me: free live sessions, 24/7",
    description: "Study with me alongside thousands of learners in live virtual rooms — silent body doubling, synced Pomodoro timers, and free 24/7 accountability.",
    keywords: "study with me, study with me online, virtual study session, body doubling, study live with others, pomodoro study with me, study together online",
  },
  focusMusic: {
    canonical: "/focus-music",
    title: "Focus music: what science actually says (2026)",
    description: "Does study music actually help? What research says about lo-fi, binaural beats, noise colors, and silence — plus how to build a playlist that works.",
    keywords: "focus music, study music, music for concentration, lo fi study music, binaural beats focus, best music for studying, music while working",
  },
  search: {
    canonical: "/search",
    title: "Search Guides, Tools & Features",
    description: "Search every FocusArx guide, study tool and feature — Pomodoro timers, study rooms, focus guides, calculators and exam prep.",
    keywords: "search FocusArx, find study guides, focus tools",
    // Internal search results are thin, near-duplicate and unbounded (?q=…) —
    // the classic facet-crawl trap. Keep the page useful for people, out of the
    // index for crawlers, and out of the sitemap.
    noindex: true,
  },
  premium: {
    canonical: "/premium",
    title: "Premium Membership — Unlock with Focus Tokens",
    description: "FocusArx Premium unlocks advanced AI coaching, exclusive themes, deeper Focus DNA insights, and boosts — activated with Focus Coins you earn by focusing.",
    keywords: "FocusArx premium, focus tokens, premium membership, productivity premium, token economy",
  },
  pets: {
    canonical: "/pets",
    title: "Pet Companions | Level 1-20 Bond & Collection | FocusArx",
    description: "Collect focus companions, bond level 1-20, unlock evolutions and accessories. Premium pets, 3D models, seasonal exclusives. Earn tokens with milestones.",
    keywords: "focus pets, study companion, pet collection, gamified pets, 3D pets",
    noindex: true,
  },
  battlePass: {
    canonical: "/battle-pass",
    title: "Battle Pass | 30 Tiers • Free + Premium Tracks | FocusArx",
    description: "28-30 day battle pass with 30 tiers, free and premium tracks unlocked with Focus Tokens only. Claim-all, grace period, no real money.",
    keywords: "battle pass, focus battle pass, token rewards, premium track",
    noindex: true,
  },
  focusTimer: {
    canonical: "/focus-timer",
    title: "Free focus timer: Pomodoro and deep work (2026)",
    description: "Free focus timer with Pomodoro, deep work sessions, ambient sound and XP. Track completion, streaks and your focus score. No credit card required.",
    keywords: "focus timer, pomodoro timer, deep work timer, free focus app",
  },
  focus: {
    canonical: "/focus",
    title: "FocusArx focus timer: start a session free",
    description: "The FocusArx focus app: a free online timer with tasks, streaks and session scoring.",
    keywords: "focus timer, deep work, pomodoro",
    // Indexable: /focus is in sitemap-core.xml, the prerender manifest and
    // robots Allow. A noindex here would deindex a sitemap-listed page.
  },
  quests: {
    canonical: "/quests",
    title: "Quests | Earn Focus Tokens Daily | FocusArx",
    description: "Daily and weekly quests to earn Focus Tokens. Premium gets more quests and streak token bonuses.",
    keywords: "quests, focus tokens, daily quests",
    noindex: true,
  },
  profile: {
    canonical: "/profile",
    title: "Profile | Customization & Progress | FocusArx",
    description: "Your FocusArx profile — stats, achievements, wallet, and premium customization with frames, nameplates, backgrounds, badges, aura, emotes.",
    keywords: "profile, customization, focus stats",
    noindex: true,
  },
};
