import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { initSocket } from "./lib/socketManager";
import { initVapid } from "./lib/pushSender";
import { getEnv, env as envModule } from "./lib/env";

// Surface configuration problems early — but do NOT crash the process.
//
// `validateProductionEnv()` used to throw, which turned a recoverable
// misconfiguration into a boot crash loop with no way to inspect the running
// server. Instead we print a loud banner and keep listening: `/api/healthz`
// stays reachable and reports the exact problems, and the request-time config
// gate returns 503 CONFIG_ERROR with an actionable list for every data route.
// A server that boots and explains itself is far easier to operate than one
// that dies on startup.
getEnv();
const productionProblems = envModule.validateProductionEnv();
if (productionProblems.length > 0) {
  console.error(
    "[config] Production configuration incomplete:\n" +
      productionProblems.map((p) => `  - ${p}`).join("\n") +
      "\n[config] The server is running, but authenticated and data-backed routes " +
      "will return 503 CONFIG_ERROR until this is fixed.\n" +
      "[config] See docs/ENVIRONMENT.md.",
  );
}

// Export app for Vercel serverless
export default app;

// Vercel imports this module without PORT, while local `pnpm dev` should work
// out of the box with the frontend proxy's documented port. Production
// standalone hosts still provide PORT themselves.
const rawPort = process.env["PORT"] ?? (getEnv().NODE_ENV === "production" ? undefined : "8080");
if (rawPort) {
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const httpServer = http.createServer(app);
  const io = initSocket(httpServer);

  // Export io for use in route handlers
  (app as any)._io = io;

  initVapid();

  httpServer.listen(port, "0.0.0.0", () => {
    logger.info({ port }, "Server listening");
  });

  httpServer.on("error", (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
}
