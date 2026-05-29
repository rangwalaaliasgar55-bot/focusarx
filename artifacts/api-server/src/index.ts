import app from "./app";
import { logger } from "./lib/logger";

// Export app for Vercel serverless (api/index.js imports this)
export default app;

// Only start the HTTP server when PORT is available (Replit / local dev)
const rawPort = process.env["PORT"];
if (rawPort) {
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }
  app.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}
