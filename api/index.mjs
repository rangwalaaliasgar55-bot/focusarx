/**
 * Vercel serverless entry — routes /api/* to the Express app (built to dist/app.mjs).
 * Run `pnpm --filter @workspace/api-server run build` before deploy.
 */
import app from "../artifacts/api-server/dist/app.mjs";

export default app;
