import type { Response } from "express";

/**
 * Standard error envelope: `{ error: { code, message } }`.
 *
 * Route-level 401s used to be a mix of `{ error: "Unauthorized" }` (string)
 * and the structured envelope. This helper is the single writer for
 * authentication failures so clients can rely on `error.code === "UNAUTHORIZED"`.
 * The central error handler additionally attaches `requestId` for errors that
 * bubble up to it.
 */
export function sendUnauthorized(res: Response, message = "Unauthorized"): void {
  res.status(401).json({ error: { code: "UNAUTHORIZED", message } });
}
