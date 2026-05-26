/**
 * Vercel serverless entry: mounts the Express API at /api/*.
 * Requires DATABASE_URL (and AUTH_SECRET in production) in Vercel project env.
 */
import app from "../artifacts/api-server/src/app";

export default app;
