import { useEffect } from "react";

interface PageSEOProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  keywords?: string;
  noindex?: boolean;
  structuredData?: object | object[];
}

// Single source of truth for the canonical origin. Defaults to the production
// domain but can be overridden per deployment via VITE_APP_URL so canonical /
// og:url / og:image URLs never drift out of sync with where the app is hosted.
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
  noindex = false,
  structuredData,
}: PageSEOProps) {
  useEffect(() => {
    const prevTitle = document.title;
    const fullTitle = title.includes("FocusArx") ? title : `${title} | FocusArx`;
    const canonicalUrl = canonical ? `${BASE_URL}${canonical}` : BASE_URL;

    document.title = fullTitle;

    setMeta("description", description);
    setMeta("robots", noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
    if (keywords) setMeta("keywords", keywords);

    setLink("canonical", canonicalUrl);

    setMeta("og:title", fullTitle, "property");
    setMeta("og:description", description, "property");
    setMeta("og:url", canonicalUrl, "property");
    setMeta("og:image", ogImage, "property");
    setMeta("og:image:width", "1200", "property");
    setMeta("og:image:height", "630", "property");
    setMeta("og:image:alt", fullTitle, "property");
    setMeta("og:type", ogType, "property");
    setMeta("og:site_name", "FocusArx", "property");
    setMeta("og:locale", "en_US", "property");

    setMeta("twitter:title", fullTitle, "name");
    setMeta("twitter:description", description, "name");
    setMeta("twitter:image", ogImage, "name");
    setMeta("twitter:card", "summary_large_image", "name");
    setMeta("twitter:site", "@focusarx", "name");
    setMeta("twitter:creator", "@focusarx", "name");

    if (structuredData) {
      const arr = Array.isArray(structuredData) ? structuredData : [structuredData];
      arr.forEach((sd, i) => setStructuredData(`page-sd-${i}`, sd));
    }

    // Add Breadcrumb Schema automatically based on path
    if (canonical && canonical !== "/") {
      const parts = canonical.split("/").filter(Boolean);
      const breadcrumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": BASE_URL
          },
          ...parts.map((p, i) => ({
            "@type": "ListItem",
            "position": i + 2,
            "name": p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, " "),
            "item": `${BASE_URL}/${parts.slice(0, i + 1).join("/")}`
          }))
        ]
      };
      setStructuredData("breadcrumb-sd", breadcrumbs);
    }

    return () => {
      document.title = prevTitle;
      if (structuredData) {
        const arr = Array.isArray(structuredData) ? structuredData : [structuredData];
        arr.forEach((_sd, i) => removeStructuredData(`page-sd-${i}`));
      }
      removeStructuredData("breadcrumb-sd");
    };
  }, [title, description, canonical, ogImage, ogType, keywords, noindex, structuredData]);

  return null;
}

export const PAGE_SEO: Record<string, Omit<PageSEOProps, "canonical"> & { canonical: string }> = {
  home: {
    canonical: "/",
    title: "FocusArx — AI Pomodoro Timer & Deep Work Tracker",
    description: "The AI focus timer 50,000+ people use to build real deep work habits — free, gamified, and built to stick.",
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
    title: "About FocusArx | AI Productivity Platform Mission & Story",
    description: "Learn about FocusArx — the AI productivity platform built to help students and professionals build deep focus habits. Our mission, values, and team.",
    keywords: "about FocusArx, FocusArx mission, FocusArx team, FocusArx story, AI productivity company",
  },
  contact: {
    canonical: "/contact",
    title: "Contact FocusArx | Support, Feedback & Enquiries",
    description: "Get in touch with the FocusArx team for support, feedback, feature requests, or business enquiries. We reply within 24 hours.",
    keywords: "contact FocusArx, FocusArx support, FocusArx email, FocusArx help",
  },
  support: {
    canonical: "/support",
    title: "FocusArx Help Center | FAQ & Support",
    description: "Find answers to common questions about FocusArx — Pomodoro timer, focus sessions, AI coaching, account, and more. Get help fast.",
    keywords: "FocusArx help, FocusArx FAQ, FocusArx support center, FocusArx questions, how to use FocusArx",
  },
  pricing: {
    canonical: "/pricing",
    title: "FocusArx — Free Forever | Deep Work Features",
    description: "FocusArx is completely free. Unlock unlimited AI coaching, advanced Focus DNA insights, and exclusive themes with Premium — activated using coins you earn by focusing.",
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
    description: "FocusArx Privacy Policy. How we collect, use, and protect your data. Webcam data never leaves your device. Read our full privacy policy.",
    keywords: "FocusArx privacy policy, FocusArx data, FocusArx GDPR",
  },
  terms: {
    canonical: "/terms",
    title: "Terms of Service | FocusArx",
    description: "FocusArx Terms of Service. Read the full terms governing your use of the FocusArx AI productivity platform.",
    keywords: "FocusArx terms of service, FocusArx terms, FocusArx conditions",
  },
  focusGuide: {
    canonical: "/focus-guide",
    title: "How to Focus: The Complete Science-Based Guide (2026) | FocusArx",
    description: "Learn how to focus and master deep work. Science-backed methods — Pomodoro technique, time blocking, flow state — plus a practical system to build unbreakable focus habits.",
    keywords: "how to focus, improve focus, deep work, how to concentrate, focus guide, build focus habits, Pomodoro method, flow state, FocusArx focus guide",
  },
  pomodoroGuide: {
    canonical: "/pomodoro-guide",
    title: "Pomodoro Technique Guide 2026 | Best Pomodoro Timer App | FocusArx",
    description: "Complete guide to the Pomodoro Technique. Learn how to use the Pomodoro method with FocusArx — the best free AI-powered Pomodoro timer app for students and professionals.",
    keywords: "Pomodoro technique, Pomodoro timer, Pomodoro method, best Pomodoro app, Pomodoro guide, FocusArx Pomodoro, study Pomodoro",
  },
  studyTechniques: {
    canonical: "/study-techniques",
    title: "Best Study Techniques 2026 | Science-Backed Study Methods | FocusArx",
    description: "Discover the most effective study techniques — active recall, spaced repetition, Feynman technique, and more. Learn how FocusArx supercharges every method with AI.",
    keywords: "study techniques, best study methods, active recall, spaced repetition, effective studying, study tips, student productivity techniques, FocusArx study",
  },
  virtualStudyRoom: {
    canonical: "/virtual-study-room",
    title: "Virtual Study Room | Study with Others Online | FocusArx",
    description: "Join a virtual study room and study with thousands of other learners online. FocusArx live study rooms add accountability, social focus energy, and real-time productivity.",
    keywords: "virtual study room, study with others online, online study room, co-study app, study accountability, group study online, FocusArx study rooms",
  },
  roadmap: {
    canonical: "/roadmap",
    title: "Product Roadmap | What's Next for FocusArx",
    description: "Explore the FocusArx product roadmap. See upcoming features, recent releases, and how we're building the world's best AI productivity platform.",
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
    title: "Your Command Center | FocusArx Dashboard",
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
    title: "The Neuroscience of Deep Work | How Focus Rewires Your Brain",
    description: "Explore the biological mechanisms behind deep work. Learn about myelin, neurotransmitters, and how FocusArx helps you enter the flow state faster.",
    keywords: "science of focus, deep work neuroscience, myelin study, flow state biology, FocusArx science",
  },
  feynmanTechnique: {
    canonical: "/feynman-technique",
    title: "The Feynman Technique | Master Any Subject Faster | FocusArx",
    description: "Learn the Feynman Technique — the ultimate method for rapid learning. 4 simple steps to understand complex topics by teaching them to others.",
    keywords: "feynman technique, rapid learning, study methods, richard feynman, how to learn anything",
  },
  deepStudyGuide: {
    canonical: "/deep-study-guide",
    title: "Deep Study Guide 2026 | Master Deep Learning Techniques | FocusArx",
    description: "The complete deep study guide. Science-backed strategies for sustained concentration, memory retention, and peak academic performance.",
    keywords: "deep study, study guide, how to study effectively, deep learning techniques, concentration tips",
  },
  twoHourStudyMethod: {
    canonical: "/two-hour-study-method",
    title: "The 2-Hour Study Method: Structure Deep Study Sessions | FocusArx",
    description: "Master the 2-hour focused study method. Structure your sessions for maximum retention with timed intervals, active recall, and strategic breaks.",
    keywords: "2 hour study method, study session structure, timed studying, focus blocks",
  },
  studyMethodQuiz: {
    canonical: "/study-method-quiz",
    title: "Which Study Method Works Best for You? | Free Quiz | FocusArx",
    description: "Take our free study method quiz. Discover whether active recall, spaced repetition, or the Pomodoro technique matches your learning style.",
    keywords: "study method quiz, which study method, learning style quiz, best study technique quiz",
  },
  studyCalculator: {
    canonical: "/study-calculator",
    title: "Study Time Calculator | Plan Your Study Sessions | FocusArx",
    description: "Free study time calculator. Input your exam date, topics, and hours available — get a personalized study schedule optimized for retention.",
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
    description: "How FocusArx uses cookies. We use minimal cookies for authentication and analytics — no third-party tracking cookies.",
    keywords: "FocusArx cookies, FocusArx cookie policy",
  },
  acceptableUse: {
    canonical: "/acceptable-use",
    title: "Acceptable Use Policy | FocusArx",
    description: "FocusArx Acceptable Use Policy. Guidelines for responsible use of the platform and community standards.",
    keywords: "FocusArx acceptable use, FocusArx community guidelines",
  },
  aiPolicy: {
    canonical: "/ai-policy",
    title: "AI Policy | How FocusArx Uses AI | FocusArx",
    description: "How FocusArx uses artificial intelligence. Our AI features, data handling, and privacy-first approach to machine learning.",
    keywords: "FocusArx AI, FocusArx artificial intelligence, AI privacy, how AI works FocusArx",
  },
  leaderboard: {
    canonical: "/leaderboard",
    title: "Leaderboard | Top Focus Champions | FocusArx",
    description: "See who's leading the FocusArx leaderboard. Top focus champions ranked by XP, streaks, and total focus time.",
    keywords: "FocusArx leaderboard, top students, focus champions, productivity ranking",
  },
  signup: {
    canonical: "/signup",
    title: "Sign Up Free | FocusArx",
    description: "Create your free FocusArx account. No credit card required. Start tracking your focus sessions in 30 seconds.",
    keywords: "sign up FocusArx, create account, free focus app registration",
  },
  guides: {
    canonical: "/guides",
    title: "All Focus & Study Guides | Free Productivity Library | FocusArx",
    description: "Browse every free FocusArx guide — Pomodoro technique, deep work, study techniques, ADHD focus, beating procrastination, study music, and more. Science-backed and practical.",
    keywords: "study guides, focus guides, productivity guides, free study resources, how to focus, how to study",
  },
  adhdFocus: {
    canonical: "/adhd-focus-tips",
    title: "How to Focus with ADHD: 15 Science-Backed Strategies (2026) | FocusArx",
    description: "Practical focus strategies that actually work for ADHD brains — body doubling, the 10-minute rule, dopamine-friendly rewards, timers, and how to build study habits that stick.",
    keywords: "how to focus with ADHD, ADHD study tips, ADHD concentration, focus strategies ADHD, ADHD productivity, ADHD time blindness, body doubling study",
  },
  stopProcrastinating: {
    canonical: "/stop-procrastinating",
    title: "How to Stop Procrastinating: 12 Methods That Work | FocusArx",
    description: "Why you procrastinate (it's not laziness) and 12 proven ways to stop — the 2-minute rule, temptation bundling, implementation intentions, and systems that make starting easy.",
    keywords: "how to stop procrastinating, stop procrastination, why do I procrastinate, procrastination help, overcome procrastination, 2 minute rule, motivation to study",
  },
  studyWithMe: {
    canonical: "/study-with-me",
    title: "Study With Me: Live Virtual Study Sessions | FocusArx",
    description: "Study with me and thousands of other learners in live virtual study rooms. Real-time accountability, Pomodoro sync, and the body-doubling effect that makes focusing easier.",
    keywords: "study with me, study with me online, virtual study session, body doubling, study live with others, pomodoro study with me, study together online",
  },
  focusMusic: {
    canonical: "/focus-music",
    title: "Best Music for Studying & Focus: What Science Says | FocusArx",
    description: "Does study music actually help? What the research really says about focus music, lo-fi, binaural beats, and silence — plus how to build a playlist that deepens concentration.",
    keywords: "focus music, study music, music for concentration, lo fi study music, binaural beats focus, best music for studying, music while working",
  },
  search: {
    canonical: "/search",
    title: "Search FocusArx | Find Guides, Features & Tools",
    description: "Search all FocusArx guides, study tools, and features — from Pomodoro timers and study rooms to focus guides and calculators.",
    keywords: "search FocusArx, find study guides, focus tools",
  },
};
