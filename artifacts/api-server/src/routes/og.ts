import { Router } from "express";

const router = Router();

// ══════════════════════════════════════════════════════════════════
// OG image automation (Workstream E)
// ══════════════════════════════════════════════════════════════════
// Serverless, zero-dependency Open Graph card generator:
//   GET /api/og?title=...&subtitle=...&tag=...&accent=...
// Renders a 1200×630 SVG brand card. Used by dynamic pages (exam
// guides, and later user share cards in Workstream K) so every
// shared link gets a unique, on-brand preview without storing
// any binary images.

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Wrap text to at most `max` lines for the card's title block. */
function wrapTitle(title: string, maxCharsPerLine = 34, maxLines = 2): string[] {
  const words = String(title).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxCharsPerLine && cur) {
      lines.push(cur.trim());
      cur = w;
      if (lines.length === maxLines) break;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur.trim());
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    // truncated — trim the last line with an ellipsis
    let last = lines[maxLines - 1];
    while (last.length > maxCharsPerLine - 1) last = last.slice(0, -1);
    lines[maxLines - 1] = last.trimEnd() + "…";
  }
  return lines;
}

function card({ title, subtitle, tag, accent, site }: {
  title: string;
  subtitle: string;
  tag: string;
  accent: string;
  site: string;
}): string {
  const t = esc(title || "FocusArx");
  const sub = esc((subtitle || "").slice(0, 110));
  const tagText = esc(tag || "FOCUSARX");
  const lines = wrapTitle(title || "FocusArx");
  const titleY = lines.length === 1 ? 400 : 370;
  const titleBlock = lines
    .map((l, i) => `<text x="80" y="${titleY + i * 78}" font-size="64" font-weight="800" fill="#ffffff" letter-spacing="-1">${esc(l)}</text>`)
    .join("\n    ");
  const subY = titleY + lines.length * 78 + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0d13"/>
      <stop offset="55%" stop-color="#141024"/>
      <stop offset="100%" stop-color="#1b1140"/>
    </linearGradient>
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1080" cy="80" r="220" fill="${accent}" opacity="0.12"/>
  <circle cx="120" cy="580" r="180" fill="#4f46e5" opacity="0.14"/>
  <rect x="80" y="86" width="26" height="26" rx="8" fill="url(#acc)"/>
  <text x="120" y="107" font-family="ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" font-size="26" font-weight="800" fill="#ffffff" letter-spacing="1">${esc(site)}</text>
  <rect x="80" y="170" rx="14" width="${tagText.length * 14 + 44}" height="44" fill="${accent}" opacity="0.18"/>
  <text x="102" y="199" font-family="ui-sans-serif,system-ui,sans-serif" font-size="22" font-weight="700" fill="${accent}" letter-spacing="2">${tagText}</text>
    ${titleBlock}
  ${sub ? `<text x="80" y="${subY}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="30" fill="#b9bdca">${sub}</text>` : ""}
  <rect x="80" y="560" width="1040" height="2" fill="#ffffff" opacity="0.08"/>
  <text x="80" y="596" font-family="ui-sans-serif,system-ui,sans-serif" font-size="22" fill="#8b90a0">${esc(site) || "focusarx.site"}</text>
</svg>`;
}

router.get("/og", (req, res) => {
  const title = String(req.query.title ?? "").slice(0, 90);
  const subtitle = String(req.query.subtitle ?? "").slice(0, 160);
  const tag = String(req.query.tag ?? "STUDY GUIDE").slice(0, 24).toUpperCase();
  const accent = String(req.query.accent ?? "#a78bfa");
  const safeAccent = /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#a78bfa";
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
  res.send(card({ title, subtitle, tag, accent: safeAccent, site: "FOCUSARX" }));
});

export const ogRouter = router;
export default router;
