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
const BASE_URL = (import.meta.env.VITE_APP_URL || "https://focusarx.site").replace(/\/+$/, "");
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
    title: "FocusArx | AI Productivity Platform & Focus Timer",
    description: "Master your focus with FocusArx. An AI-powered deep-work OS with adaptive Pomodoro sessions, real-time AI coaching, gamified progress, and on-device privacy.",
    keywords: "FocusArx, AI productivity tool, best focus timer, Pomodoro timer, deep work app, study timer, habit tracker, AI study coach, productivity platform",
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
    description: "Find answers to common questions about FocusArx — Pomodoro timer, focus sessions, AI coaching, billing, account, and more. Get help fast.",
    keywords: "FocusArx help, FocusArx FAQ, FocusArx support center, FocusArx questions, how to use FocusArx",
  },
  pricing: {
    canonical: "/pricing",
    title: "FocusArx Pricing | Elite Features for Deep Work",
    description: "FocusArx is free to use. Unlock unlimited AI coaching, advanced Focus DNA insights, and exclusive themes with Premium — activated using coins you earn by focusing.",
    keywords: "FocusArx pricing, productivity app cost, deep work premium, AI study coach price",
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
  refund: {
    canonical: "/refund",
    title: "Refund Policy | FocusArx",
    description: "FocusArx Refund Policy. 7-day full refund on Premium subscriptions. Free tier is always free. Read our complete refund policy.",
    keywords: "FocusArx refund policy, FocusArx refund, FocusArx money back guarantee",
  },
  focusGuide: {
    canonical: "/focus-guide",
    title: "Ultimate Focus Guide 2025 | How to Build Deep Focus Habits | FocusArx",
    description: "Learn how to build powerful deep focus habits with FocusArx. Science-backed techniques, Pomodoro method, flow state, and AI coaching to maximize your productivity.",
    keywords: "focus guide, how to focus, deep focus techniques, focus habits, improve focus, concentration tips, focus app guide, FocusArx focus guide",
  },
  pomodoroGuide: {
    canonical: "/pomodoro-guide",
    title: "Pomodoro Technique Guide 2025 | Best Pomodoro Timer App | FocusArx",
    description: "Complete guide to the Pomodoro Technique. Learn how to use the Pomodoro method with FocusArx — the best free AI-powered Pomodoro timer app for students and professionals.",
    keywords: "Pomodoro technique, Pomodoro timer, Pomodoro method, best Pomodoro app, Pomodoro guide, FocusArx Pomodoro, study Pomodoro",
  },
  studyTechniques: {
    canonical: "/study-techniques",
    title: "Best Study Techniques 2025 | Science-Backed Study Methods | FocusArx",
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
    title: "The Neuro-Science of Deep Work | How Focus Rewires Your Brain",
    description: "Explore the biological mechanisms behind deep work. Learn about myelin, neurotransmitters, and how FocusArx helps you enter the flow state faster.",
    keywords: "science of focus, deep work neuroscience, myelin study, flow state biology, FocusArx science",
  },
  feynmanTechnique: {
    canonical: "/feynman-technique",
    title: "The Feynman Technique | Master Any Subject Faster | FocusArx",
    description: "Learn the Feynman Technique — the ultimate method for rapid learning. 4 simple steps to understand complex topics by teaching them to others.",
    keywords: "feynman technique, rapid learning, study methods, richard feynman, how to learn anything",
  },
};
