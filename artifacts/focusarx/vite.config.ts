import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH ?? "/";

// FocusArx V15: Performance-Optimized Configuration for 10X Speed
export default defineConfig({
  base: basePath,
  plugins: [
    react({
      // Enable React Fast Refresh with modern target
      devTarget: 'es2022' as const,
    }),
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
      "@components": path.resolve(import.meta.dirname, "src/components"),
      "@pages": path.resolve(import.meta.dirname, "src/pages"),
      "@hooks": path.resolve(import.meta.dirname, "src/hooks"),
      "@lib": path.resolve(import.meta.dirname, "src/lib"),
      "@store": path.resolve(import.meta.dirname, "src/store"),
      "@types": path.resolve(import.meta.dirname, "src/types"),
    },
    dedupe: ["react", "react-dom", "@workspace/api-client-react"],
  },
  // Optimize dependencies for faster startup
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "three",
      "@react-three/fiber",
      "@react-three/drei",
      "framer-motion",
      "@tanstack/react-query",
    ],
    exclude: ["@mediapipe/tasks-vision"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    target: "esnext",
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === "development",
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React - loaded first
          "react-core": ["react", "react-dom", "react/jsx-runtime"],
          // 3D Graphics - lazy loaded for Focus City
          "three-3d": ["three", "@react-three/fiber", "@react-three/drei"],
          // Animation & Motion
          "motion": ["framer-motion"],
          // State Management & Query
          "state-query": ["@tanstack/react-query", "zustand"],
          // UI Components - split by feature
          "ui-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-popover",
          ],
          // Media & Computer Vision
          "media-vision": ["@mediapipe/tasks-vision", "react-webcam"],
          // Utilities
          "utils": ["date-fns", "clsx", "tailwind-merge", "zod"],
        },
        // Optimized asset naming for long-term caching
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
    chunkSizeWarningLimit: 500,
    // Enable tree shaking for smaller bundles
    rollupOptions: {
      treeshake: true,
    },
  },
  server: {
    port: Number.isNaN(port) ? 5173 : port,
    strictPort: false,
    host: "0.0.0.0",
    allowedHosts: true,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 3001,
    },
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
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  },
  preview: {
    port: Number.isNaN(port) ? 4173 : port,
    host: "0.0.0.0",
    allowedHosts: true,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  },
  // CSS optimization
  css: {
    devSourcemap: process.env.NODE_ENV === "development",
  },
});
