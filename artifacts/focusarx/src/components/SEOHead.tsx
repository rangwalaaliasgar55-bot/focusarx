import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
  noIndex?: boolean;
}

const DEFAULT_TITLE = "FocusArx — Deep Focus, Gamified";
const DEFAULT_DESC = "AI-powered Pomodoro focus tracker with gamification, webcam attention monitoring, XP/coins economy, pet companions, Focus City, and study analytics.";
const DEFAULT_IMAGE = "/og-image.png";
const SITE_URL = "https://focusarx.replit.app";

function setMeta(property: string, content: string, isName = false) {
  const attr = isName ? "name" : "property";
  let el = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, property);
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

export function SEOHead({ title, description, image, url, type = "website", noIndex = false }: SEOProps) {
  const fullTitle = title ? `${title} | FocusArx` : DEFAULT_TITLE;
  const desc = description ?? DEFAULT_DESC;
  const img = image ?? DEFAULT_IMAGE;
  const canonicalUrl = url ?? SITE_URL;

  useEffect(() => {
    document.title = fullTitle;

    setMeta("description", desc, true);
    setMeta("keywords", "pomodoro, focus timer, study app, gamification, productivity, deep work, attention tracking, AI study", true);
    setMeta("author", "FocusArx", true);
    setMeta("robots", noIndex ? "noindex,nofollow" : "index,follow", true);
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue("--brand-600").trim();
    if (themeColor) setMeta("theme-color", themeColor, true);

    // Open Graph
    setMeta("og:title", fullTitle);
    setMeta("og:description", desc);
    setMeta("og:image", img);
    setMeta("og:url", canonicalUrl);
    setMeta("og:type", type);
    setMeta("og:site_name", "FocusArx");
    setMeta("og:locale", "en_US");

    // Twitter / X
    setMeta("twitter:card", "summary_large_image", true);
    setMeta("twitter:title", fullTitle, true);
    setMeta("twitter:description", desc, true);
    setMeta("twitter:image", img, true);
    setMeta("twitter:site", "@focusarx", true);
    setMeta("twitter:creator", "@focusarx", true);

    // Canonical
    setLink("canonical", canonicalUrl);
  }, [fullTitle, desc, img, canonicalUrl, type, noIndex]);

  return null;
}

export default SEOHead;
