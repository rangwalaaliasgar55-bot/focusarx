import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

const sharedBuildOptions = {
  platform: "node",
  bundle: true,
  format: "esm",
  logLevel: "info",
  // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
  //
  // ── Do NOT externalize @opentelemetry/* ──────────────────────────────────
  // esbuild inlines the dynamic `import("@sentry/node")` in lib/sentry.ts into
  // this single-file bundle, which pulls the OpenTelemetry packages into the
  // module graph as bare top-level imports. None of them is a direct
  // dependency of @workspace/api-server, so in the pnpm layout they are
  // unresolvable from dist/app.mjs at RUNTIME: every serverless cold start
  // died with ERR_MODULE_NOT_FOUND before Express booted, and Vercel answered
  // every /api/* request with 500 FUNCTION_INVOCATION_FAILED (the all-API-500
  // incident). Bundling them keeps the bundle self-contained. If you re-add an
  // external here, add it to artifacts/api-server/package.json dependencies
  // AND verify `node -e "import('./dist/app.mjs')"` succeeds from a clean
  // install before deploying.
  external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
  sourcemap: "linked",
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
  },
};

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    ...sharedBuildOptions,
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    plugins: [
      esbuildPluginPino({ transports: ["pino-pretty"] }),
    ],
  });

  // Vercel serverless: Express app only (no listen), no pino worker transport
  await esbuild({
    ...sharedBuildOptions,
    entryPoints: [path.resolve(artifactDir, "src/app.ts")],
    outfile: path.resolve(distDir, "app.mjs"),
    plugins: [],
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
