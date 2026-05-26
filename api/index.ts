/// <reference path="./types.d.ts" />
/**
 * Vercel serverless Express handler for /api/*
 * Built bundle: artifacts/api-server/dist/app.mjs (see build:vercel)
 */
// Vercel's API typecheck step may not include sibling ambient declarations.
// This import is runtime-valid after build:vercel emits artifacts/api-server/dist/app.mjs.
// @ts-ignore
import app from "../artifacts/api-server/dist/app.mjs";

export default app;

export const config = {
  maxDuration: 60,
};
