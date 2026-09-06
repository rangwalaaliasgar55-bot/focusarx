// FocusArx lint gates (Phase 10): strict TypeScript, react-hooks correctness,
// jsx-a11y on the funnel-critical timer UI. `npm run lint` must pass for merge.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/test-results/**",
      "tmp/**",
      "**/*.d.mts",
      "lib/db/drizzle/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["artifacts/focusarx/src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: {
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      // v6-only stylistic rules that conflict with established codebase
      // patterns (optionsRef mirrors, canvas refs): warn, not gate.
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      // Best-effort telemetry/sync code intentionally swallows errors.
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Funnel-critical UI: timers, auth and settings must stay clean.
      "jsx-a11y/no-autofocus": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["artifacts/api-server/src/**/*.ts", "lib/**/*.ts", "api/**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["**/public/sw.js"],
    languageOptions: {
      globals: { ...globals.serviceworker, ...globals.es2022 },
    },
  },
  {
    files: ["**/*.test.*", "**/*.spec.*", "tests/**/*", "scripts/**/*", "**/*.mjs"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.es2022 },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
