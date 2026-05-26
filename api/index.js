/**
 * Vercel serverless Express handler for /api/*
 * Built bundle: artifacts/api-server/dist/app.mjs (see build:vercel)
 */
import app from "../artifacts/api-server/dist/app.mjs";

export default app;

export const config = {
  maxDuration: 60,
};
