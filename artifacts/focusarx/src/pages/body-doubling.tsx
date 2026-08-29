import SeoLandingPage from "@/pages/seo-landing";

// Content, FAQ, schema and internal links all live in
// src/content/seo-pages.mjs — the same file the build-time prerenderer
// reads, so the static HTML and the rendered page can never disagree.
export default function BodyDoublingPage() {
  return <SeoLandingPage path="/body-doubling" />;
}
