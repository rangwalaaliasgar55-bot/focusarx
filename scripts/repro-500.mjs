/**
 * Reproduction harness for the production HTTP 500s.
 *
 * Boots the built Vercel serverless app (artifacts/api-server/dist/app.mjs) in
 * a child process with a controlled environment, then hits the endpoints that
 * are reported as failing in production.
 *
 * Usage: node scripts/repro-500.mjs
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "scripts", "_server-boot.mjs");

const PORT = 3899;

const scenarios = [
  {
    name: "A. production, NO env vars at all",
    env: {},
  },
  {
    name: "B. production, DATABASE_URL set, AUTH_SECRET too short (<32)",
    env: {
      DATABASE_URL: "postgresql://user:pass@db.example.com/neondb",
      AUTH_SECRET: "short-secret",
      ADMIN_PASSWORD: "a-very-long-admin-password-123",
    },
  },
  {
    name: "C. production, valid DB+AUTH, ADMIN_PASSWORD too short (<16)",
    env: {
      DATABASE_URL: "postgresql://user:pass@db.example.com/neondb",
      AUTH_SECRET: "x".repeat(48),
      ADMIN_PASSWORD: "short",
    },
  },
  {
    name: "D. production, all vars valid (DB unreachable)",
    env: {
      DATABASE_URL: "postgresql://user:pass@db.example.com/neondb",
      AUTH_SECRET: "x".repeat(48),
      ADMIN_PASSWORD: "a-very-long-admin-password-123",
      APP_URL: "https://focusarx.vercel.app",
    },
  },
  {
    name: "E. production, DATABASE_URL set to empty string",
    env: {
      DATABASE_URL: "",
      AUTH_SECRET: "x".repeat(48),
      ADMIN_PASSWORD: "a-very-long-admin-password-123",
    },
  },
];

const endpoints = [
  "/api/healthz",
  "/api/deployment",
  "/api/site/settings",
  "/api/auth/session",
  "/api/auth/login",
  "/api/track",
];

function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [appPath], {
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "production",
        PORT: String(PORT),
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      reject(new Error(`server exited with code ${code}\n${stderr}`));
    });
    // Wait for the module to finish evaluating. If import throws, the process
    // exits — which we surface as a boot failure.
    setTimeout(() => resolve({ child, stderr: () => stderr }), 1500);
  });
}

function request(pathname, method = "GET", body) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: "127.0.0.1",
        port: PORT,
        path: pathname,
        method,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          accept: "application/json",
          ...(payload
            ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) }
            : {}),
        },
        timeout: 20000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, body: data.slice(0, 300) }));
      },
    );
    req.on("error", (err) => resolve({ status: "ERR", body: err.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: "TIMEOUT", body: "" });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

for (const scenario of scenarios) {
  console.log("\n" + "=".repeat(78));
  console.log(scenario.name);
  console.log("=".repeat(78));

  let handle;
  try {
    handle = await startServer(scenario.env);
  } catch (err) {
    console.log(`BOOT FAILED: ${err.message.split("\n").slice(0, 6).join("\n")}`);
    continue;
  }

  for (const ep of endpoints) {
    const isPost = ep === "/api/auth/login" || ep === "/api/track";
    const res = await request(ep, isPost ? "POST" : "GET", isPost ? { probe: true } : undefined);
    console.log(`  ${String(res.status).padEnd(7)} ${ep.padEnd(24)} ${res.body.replace(/\s+/g, " ").slice(0, 160)}`);
  }

  const err = handle.stderr();
  if (err.trim()) {
    console.log("  --- server stderr (first 5 lines) ---");
    console.log(
      err
        .trim()
        .split("\n")
        .slice(0, 5)
        .map((l) => "  " + l.slice(0, 160))
        .join("\n"),
    );
  }
  handle.child.kill();
  await new Promise((r) => setTimeout(r, 300));
}

console.log("\ndone");
process.exit(0);
