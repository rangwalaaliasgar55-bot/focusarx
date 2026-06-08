import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { initSocket } from "./lib/socketManager";
import { initVapid } from "./lib/pushSender";

// Export app for Vercel serverless
export default app;

// Only start the HTTP server when PORT is available (Replit / local dev)
const rawPort = process.env["PORT"];
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

  httpServer.listen(port, () => {
    logger.info({ port }, "Server listening");
  });

  httpServer.on("error", (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
}
