import { Router } from "express";

const router = Router();

const STATIC_PAGES = [
  { url: "/",             changefreq: "daily",   priority: "1.0" },
  { url: "/dashboard",    changefreq: "daily",   priority: "0.9" },
  { url: "/leaderboard",  changefreq: "hourly",  priority: "0.8" },
  { url: "/achievements", changefreq: "weekly",  priority: "0.8" },
  { url: "/analytics",    changefreq: "daily",   priority: "0.8" },
  { url: "/missions",     changefreq: "daily",   priority: "0.8" },
  { url: "/roadmap",      changefreq: "weekly",  priority: "0.7" },
  { url: "/focus-dna",    changefreq: "weekly",  priority: "0.7" },
  { url: "/forge-room",        changefreq: "monthly", priority: "0.6" },
  { url: "/consequences", changefreq: "weekly",  priority: "0.6" },
  { url: "/break-free",   changefreq: "weekly",  priority: "0.6" },
  { url: "/breathe",      changefreq: "monthly", priority: "0.5" },
  { url: "/pricing",      changefreq: "monthly", priority: "0.7" },
  { url: "/privacy",      changefreq: "yearly",  priority: "0.3" },
  { url: "/terms",        changefreq: "yearly",  priority: "0.3" },
  { url: "/ai-policy",    changefreq: "yearly",  priority: "0.3" },
  { url: "/login",               changefreq: "monthly", priority: "0.6" },
  { url: "/signup",              changefreq: "monthly", priority: "0.7" },
  { url: "/focus-guide",         changefreq: "monthly", priority: "0.9" },
  { url: "/pomodoro-guide",      changefreq: "monthly", priority: "0.9" },
  { url: "/study-techniques",    changefreq: "monthly", priority: "0.8" },
  { url: "/virtual-study-room",  changefreq: "weekly",  priority: "0.8" },
  { url: "/study-rooms",         changefreq: "hourly",  priority: "0.7" },
  { url: "/comparison/focusarx-vs-forest", changefreq: "monthly", priority: "0.8" },
  { url: "/comparison/focusarx-vs-focus-todo", changefreq: "monthly", priority: "0.8" },
];

router.get("/sitemap.xml", (_req, res) => {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, "") ?? "https://focusarx.site";
  const now = new Date().toISOString().split("T")[0];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...STATIC_PAGES.map((p) => [
      "  <url>",
      `    <loc>${baseUrl}${p.url}</loc>`,
      `    <lastmod>${now}</lastmod>`,
      `    <changefreq>${p.changefreq}</changefreq>`,
      `    <priority>${p.priority}</priority>`,
      "  </url>",
    ].join("\n")),
    "</urlset>",
  ].join("\n");

  res.set("Content-Type", "application/xml");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

router.get("/robots.txt", (_req, res) => {
  const baseUrl = process.env.APP_URL?.replace(/\/$/, "") ?? "https://focusarx.site";
  res.set("Content-Type", "text/plain");
  res.set("Cache-Control", "public, max-age=86400");
  res.send([
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /admin",
    "",
    `Sitemap: ${baseUrl}/api/sitemap.xml`,
  ].join("\n"));
});

export { router as sitemapRouter };
