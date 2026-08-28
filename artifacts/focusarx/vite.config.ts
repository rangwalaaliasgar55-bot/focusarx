import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
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
    rollupOptions: {
      output: {
        // Function form, not the object form. The object form resolved to an
        // EMPTY `vendor-react` chunk ("Generated an empty chunk: vendor-react"),
        // which silently inlined react + react-dom into the entry bundle — the
        // entry sat at 375 kB / 117 kB gzip on every single page, desktop and
        // mobile alike. The function form matches on the resolved module path,
        // so the split actually happens and each vendor group becomes its own
        // long-lived, independently cacheable file.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          const has = (...pkgs: string[]) =>
            pkgs.some((pkg) => id.includes(`/node_modules/${pkg}/`) || id.includes(`${pkg}/`));

          // React core — the single most reused module in the app. Isolated so
          // an app-code change never invalidates it for returning visitors.
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "vendor-react";

          if (has("framer-motion", "motion-dom", "motion-utils")) return "vendor-motion";
          if (has("@tanstack/react-query", "@tanstack/query-core")) return "vendor-query";
          if (has("wouter")) return "vendor-router";

          // Charts pull in the whole d3 stack (~370 kB). Only analytics and
          // dashboard need it, so it must never sit in the entry chunk.
          if (has("recharts") || /\/node_modules\/d3-/.test(id) || has("victory-vendor")) {
            return "vendor-charts";
          }

          // 3D + vision: three (~600 kB) + react-three-fiber + drei + MediaPipe.
          // Split from the app so the ~890 kB blob is fetched only by the pages
          // that actually render a 3D scene or use the camera.
          // 3D + vision. Split into three parts so the stable, enormous
          // `three` core is cached separately from the helpers that change
          // more often, and so a page that only uses MediaPipe never pays for
          // the 3D stack.
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
