import { defineConfig } from "vite";
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

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
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
        // Function form for accurate module matching
        manualChunks(id) {
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
