import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * jsdom environment for the console-hygiene suite.
 *
 * There is no browser binary available in this environment (the Playwright
 * download host and every Neon/CDN egress path is blocked by the sandbox
 * allowlist), so component rendering happens in jsdom instead. jsdom does not
 * implement several Web APIs the app legitimately uses, so `setup/jsdom.ts`
 * installs minimal stand-ins for exactly those — and only those.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [path.resolve(import.meta.dirname, "setup/jsdom.ts")],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    // Rendering the real app pulls in three.js / mediapipe; keep them out.
    server: { deps: { inline: [/framer-motion/] } },
  },
});
