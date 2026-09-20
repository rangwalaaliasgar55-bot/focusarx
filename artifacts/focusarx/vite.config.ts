import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { execSync } from "child_process";

const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH ?? "/";

// Deployment version — baked into the frontend at build time.
// Priority: Vercel deployment ID > git commit SHA > explicit env > "dev-local"
function getDeploymentVersion(): string {
  if (process.env.VERCEL_DEPLOYMENT_ID) return process.env.VERCEL_DEPLOYMENT_ID;
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12);
  if (process.env.VITE_DEPLOYMENT_VERSION) return process.env.VITE_DEPLOYMENT_VERSION;
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev-local";
  }
}

/**
 * Preload the display font's latin subset — the LCP font.
 *
 * Every page's H1 is set in Manrope Variable (`--font-display` in index.css).
 * Without a hint the browser only discovers the woff2 after the CSS has
 * downloaded *and* parsed, so the largest text on the page — usually the LCP
 * element — waits a whole round trip it does not need to wait, and with
 * `font-display: swap` that round trip is a visible reflow on the headline.
 *
 * The filename is content-hashed, so the hint cannot be a static line in
 * index.html: it has to be injected once Rollup has named the assets, which is
 * exactly the window `transformIndexHtml` with `order: "post"` gets. Only the
 * latin subset is preloaded; the cyrillic/greek/vietnamese files are never
 * fetched for an English page and would be wasted bandwidth.
 *
 * scripts/seo-validate.mjs asserts every emitted page still carries the hint,
 * so a future rewrite of the <head> cannot drop it silently.
 */
function preloadDisplayFont(): Plugin {
  const latin = /manrope-latin-wght-normal-[^/]+\.woff2$/;
  const prefix = basePath.replace(/\/?$/, "/");
  return {
    name: "focusarx:preload-display-font",
    apply: "build",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const font = Object.keys(ctx.bundle ?? {}).find((name) => latin.test(name));
        if (!font) return html;
        const tag = `    <link rel="preload" href="${prefix}${font}" as="font" type="font/woff2" crossorigin />\n`;
        return html.replace("</head>", `${tag}  </head>`);
      },
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), preloadDisplayFont()],
  define: {
    __DEPLOYMENT_VERSION__: JSON.stringify(getDeploymentVersion()),
    "import.meta.env.VITE_DEPLOYMENT_VERSION": JSON.stringify(getDeploymentVersion()),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom", "@workspace/api-client-react"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: "esnext",
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Optimize chunk loading with modulepreload hints
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        // Rollup's default (true) hoists the transitive static closure of every
        // dynamically imported chunk into the importing chunk. Because some
        // lazily-loaded pages lazy-load 3D components, that pulled three.js
        // (~890 kB with helpers) into the entry chunk's imports — and therefore
        // into a <link modulepreload> on every prerendered page. Vite's own
        // __vitePreload already parallel-fetches a dynamic import's real deps
        // at import time, so hoisting buys nothing here and costs every visitor.
        hoistTransitiveImports: false,
        // Function form for accurate module matching
        manualChunks(id, { getModuleInfo }) {
          // Vite's __vitePreload helper is shared by every module that does a
          // dynamic import. Left unassigned, Rollup can park it in a heavy
          // manual chunk (it landed in vendor-three-helpers), which then made
          // every dynamic-importing chunk — including the entry — statically
          // depend on three.js. Keep it in vendor-react, which every chunk
          // already depends on.
          if (id.includes("vite/preload-helper")) return "vendor-react";
          if (!id.includes("node_modules")) return;

          const has = (...pkgs: string[]) =>
            pkgs.some((pkg) => id.includes(`/node_modules/${pkg}/`) || id.includes(`${pkg}/`));

          // React core — most reused, cached separately
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "vendor-react";

          if (has("framer-motion", "motion-dom", "motion-utils")) return "vendor-motion";
          if (has("@tanstack/react-query", "@tanstack/query-core")) return "vendor-query";
          if (has("wouter")) return "vendor-router";

          // Charts (~370 kB) — only needed for analytics/dashboard
          if (has("recharts") || /\/node_modules\/d3-/.test(id) || has("victory-vendor")) {
            return "vendor-charts";
          }

          // 3D split: three core (600kB) separate from helpers
          if (has("@mediapipe/tasks-vision")) return "vendor-vision";
          if (has("@react-three/fiber", "@react-three/drei")) return "vendor-three-helpers";
          if (/\/node_modules\/three\//.test(id)) return "vendor-three";
          // drei's transitive deps (maath, gainmap-js, troika, camera-controls,
          // three-stdlib, …) import three. If they fall through to vendor-shared
          // the entry chunk ends up statically depending on three.js and the
          // bundle budget fails. Anything that imports three rides with the helpers.
          const info = getModuleInfo(id);
          if (info?.importedIds.some((dep) => /\/node_modules\/three\//.test(dep))) {
            return "vendor-three-helpers";
          }

          if (has("react-hook-form", "@hookform/resolvers", "zod")) return "vendor-forms";
          if (has("lucide-react", "react-icons")) return "vendor-icons";
          if (/\/node_modules\/@radix-ui\//.test(id)) return "vendor-radix";
          if (has("date-fns")) return "vendor-date";
          if (has("sonner", "cmdk", "embla-carousel-react", "vaul", "react-resizable-panels",
                 "react-day-picker", "next-themes")) {
            return "vendor-widgets";
          }

          return "vendor-shared";
        },
      },
    },
    chunkSizeWarningLimit: 700,
    minify: "esbuild",
    cssMinify: true,
  },
  server: {
    port: Number.isNaN(port) ? 5173 : port,
    strictPort: false,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/socket.io": {
        target: process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8080",
        changeOrigin: true,
        ws: true,
      },
    },
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
  preview: {
    port: 4173,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
