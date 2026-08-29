import type { Response } from "express";

/**
 * Standard error envelope: `{ error: { code, message, requestId? } }`.
 *
 * Route-level errors used to be a mix of `{ error: "Unauthorized" }` (bare
 * string) and the structured envelope, so clients could not branch reliably on
 * `error.code`. Everything the API writes now goes through these helpers. The
 * central error handler in `app.ts` additionally attaches `requestId`.
 *
 * Messages must be safe to show a user: no stack traces, no SQL, no hostnames,
 * no credentials. Detail goes to the server log instead.
 */

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

function requestIdOf(res: Response): string | undefined {
  const id = (res.req as { id?: unknown } | undefined)?.id;
  return typeof id === "string" ? id : undefined;
}

function send(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  extra?: Record<string, unknown>,
): void {
  const requestId = requestIdOf(res);
  res.status(status).json({
    error: {
      code,
      message,
      ...(requestId ? { requestId } : {}),
      ...extra,
    },
  });
}

export function sendUnauthorized(res: Response, message = "Unauthorized"): void {
  send(res, 401, "UNAUTHORIZED", message);
}

export function sendForbidden(res: Response, message = "Forbidden"): void {
  send(res, 403, "FORBIDDEN", message);
}

export function sendNotFound(res: Response, message = "Not found"): void {
  send(res, 404, "NOT_FOUND", message);
}

export function sendValidationError(
  res: Response,
  message = "The request is invalid",
  extra?: Record<string, unknown>,
): void {
  send(res, 400, "VALIDATION_ERROR", message, extra);
}

export function sendConflict(
  res: Response,
  message = "Conflict",
  extra?: Record<string, unknown>,
): void {
  send(res, 409, "CONFLICT", message, extra);
}

export function sendRateLimited(
  res: Response,
  message = "Too many requests, please try again later",
): void {
  send(res, 429, "RATE_LIMITED", message);
}

/**
 * Dependency unavailable (database down, AI provider unreachable).
 *
 * Prefer this over `sendInternal` whenever the cause is a known external
 * dependency: a 503 tells the client the request is worth retrying later, and
 * it keeps transient infrastructure faults out of the 5xx budget that is
 * supposed to represent real bugs.
 */
export function sendServiceUnavailable(
  res: Response,
  message = "Service temporarily unavailable",
): void {
  send(res, 503, "SERVICE_UNAVAILABLE", message);
}

export function sendInternal(res: Response, message = "An unexpected error occurred"): void {
  send(res, 500, "INTERNAL_ERROR", message);
}
