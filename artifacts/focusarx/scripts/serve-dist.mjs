#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════
 * Serve the production build the way Vercel does
 * ══════════════════════════════════════════════════════════════════
 * `vite preview` falls back to index.html for any extensionless path, so
 * `/pomodoro-timer` returns the HOMEPAGE html and you cannot verify the
 * prerendered output with it. Vercel's `"handle": "filesystem"` route instead
 * resolves `/pomodoro-timer` → `dist/public/pomodoro-timer/index.html`.
 *
 * This mirrors that resolution order so what you see locally is what a
 * crawler sees in production:
 *
 *   1. exact file            /robots.txt, /llms.txt, /opengraph.jpg
 *   2. directory index       /pomodoro-timer → /pomodoro-timer/index.html
 *   3. SPA fallback          /dashboard      → /index.html
 *
 * Usage:  pnpm --filter @workspace/focusarx preview:seo
 *         curl -s localhost:4173/pomodoro-timer | grep '<title>'
 *
 * Static files only — no /api. The sitemap therefore serves the static
 * fallback from public/sitemap.xml rather than the API-generated one.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "dist", "public");
const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? "0.0.0.0";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".webmanifest": "application/manifest+json",
};

if (!existsSync(ROOT)) {
  console.error(`serve-dist: ${ROOT} not found — run the build first.`);
  process.exit(1);
}

/** Resolve a request path to a file on disk, or null. */
function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  // Block path traversal — the resolved path must stay inside ROOT.
  const target = path.resolve(ROOT, `.${path.posix.normalize(clean)}`);
  if (!target.startsWith(ROOT)) return null;

  if (existsSync(target) && statSync(target).isFile()) return target;
  const indexFile = path.join(target, "index.html");
  if (existsSync(indexFile) && statSync(indexFile).isFile()) return indexFile;
  return null;
}

const server = createServer((req, res) => {
  const urlPath = req.url ?? "/";
  let file = resolve(urlPath);
  let status = 200;

  if (!file) {
    // SPA fallback — same as vercel.json's final `/(.*)` → /index.html route.
    file = path.join(ROOT, "index.html");
    status = 200;
  }

  const ext = path.extname(file).toLowerCase();
  res.writeHead(status, {
    "Content-Type": TYPES[ext] ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`serve-dist: serving ${ROOT}`);
  console.log(`  → http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}/`);
  console.log("");
  console.log("Check the crawler view of a prerendered page:");
  console.log(`  curl -s localhost:${PORT}/pomodoro-timer | grep -o '<title>[^<]*</title>'`);
});
