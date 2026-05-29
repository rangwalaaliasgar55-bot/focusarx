import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-runtime-error-modal").then((m) => m.default()),
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "SOURCEMAP_ERROR") return;
        if (warning.message?.includes("Can't resolve original location")) return;
        if (warning.message?.includes("Circular chunk")) return;
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          const pkg = id.split("node_modules/").pop()?.split("/")[0] ?? "";
          if (pkg === "react" || pkg === "react-dom" || pkg === "scheduler") return "react-vendor";
          if (pkg.startsWith("@radix-ui")) return "radix-vendor";
          if (pkg === "framer-motion" || pkg === "motion") return "framer-vendor";
          if (pkg.startsWith("@tanstack")) return "tanstack-vendor";
          if (pkg === "recharts" || pkg.startsWith("d3-") || pkg === "d3") return "charts-vendor";
          if (pkg === "@mediapipe" || pkg === "react-webcam") return "vision-vendor";
          return "vendor";
        },
      },
    },
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
        target: process.env.API_PROXY_TARGET ?? "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: Number.isNaN(port) ? 4173 : port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
