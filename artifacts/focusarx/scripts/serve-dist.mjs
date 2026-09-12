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
 *   3. SPA fallback          /dashboard      → /index.html      (200)
 *   4. anything else         /totally-fake   → /404.html        (404)
 *
 * Steps 3 and 4 are read out of the real `vercel.json`, so this server cannot
 * drift from production routing: a route added to `src/App.tsx` but not to the
 * vercel.json SPA allowlist answers 404 here exactly as it would on Vercel.
 * Before the 404 step existed every unknown URL answered 200 with the homepage
 * prerender — a soft-404 Google indexes as a homepage duplicate.
 *
 * Usage:  pnpm --filter @workspace/focusarx preview:seo
 *         curl -s localhost:4173/pomodoro-timer | grep '<title>'
 *
 * Static files only — no /api. The sitemap therefore serves the static
 * fallback from public/sitemap.xml rather than the API-generated one.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
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

/** Resolve a request path to a file on disk, or null. */
function resolve(urlPath, root) {
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  // Block path traversal — the resolved path must stay inside ROOT.
  const target = path.resolve(root, `.${path.posix.normalize(clean)}`);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;

  if (existsSync(target) && statSync(target).isFile()) return target;
  const indexFile = path.join(target, "index.html");
  if (existsSync(indexFile) && statSync(indexFile).isFile()) return indexFile;
  return null;
}

const VERCEL_JSON = path.resolve(__dirname, "..", "..", "..", "vercel.json");

/**
 * The SPA fallback patterns straight out of vercel.json — the login-walled app
 * screens and `/u/<name>` profiles, which have no prerendered document but are
 * still real routes (and must answer 200, not 404). Returns null when the
 * config cannot be read, in which case this server falls back to the old
 * "everything is the SPA" behaviour rather than 404ing every page.
 */
function loadSpaFallbackPattern() {
  try {
    const config = JSON.parse(readFileSync(VERCEL_JSON, "utf8"));
    const patterns = (config.routes ?? [])
      .filter((entry) => typeof entry?.src === "string" && entry.dest === "/index.html")
      .map((entry) => entry.src);
    if (patterns.length === 0) return null;
    return new RegExp(`^(?:${patterns.join("|")})$`);
  } catch {
    return null;
  }
}

export function createStaticServer(root = ROOT) {
  const spaFallback = loadSpaFallbackPattern();

  return createServer((req, res) => {
    const requested = (req.url ?? "/").split("?")[0].split("#")[0];
    let file;
    try {
      file = resolve(req.url ?? "/", root);
    } catch (error) {
      // Malformed percent escapes must not crash the entire preview server.
      res.writeHead(error instanceof URIError ? 400 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error instanceof URIError ? "Malformed request path" : "Unable to read requested file");
      return;
    }

    const send = (target, status) => {
      const ext = path.extname(target).toLowerCase();
      res.writeHead(status, {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });
      createReadStream(target).on("error", () => res.destroy()).pipe(res);
    };

    if (file) {
      send(file, 200);
      return;
    }

    // Nothing on disk. Real SPA screens keep the 200 fallback…
    if (spaFallback?.test(requested)) {
      send(path.join(root, "index.html"), 200);
      return;
    }

    // …a missing build asset answers 404 with an empty body (never HTML, which
    // a service worker would cache under the asset URL)…
    if (/^\/assets\//.test(requested) || /\.[A-Za-z0-9]{1,10}$/.test(requested)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    // …and every other unknown URL is an honest 404.
    const notFound = path.join(root, "404.html");
    if (existsSync(notFound)) send(notFound, 404);
    else {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!existsSync(ROOT)) {
    console.error(`serve-dist: ${ROOT} not found — run the build first.`);
    process.exit(1);
  }
  const server = createStaticServer();
  server.listen(PORT, HOST, () => {
    console.log(`serve-dist: serving ${ROOT}`);
    console.log(`  → http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}/`);
    console.log("");
    console.log("Check the crawler view of a prerendered page:");
    console.log(`  curl -s localhost:${PORT}/pomodoro-timer | grep -o '<title>[^<]*</title>'`);
  });

}
