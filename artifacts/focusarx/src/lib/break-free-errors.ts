import { ApiError } from "@workspace/api-client-react";

export function breakFreeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Session expired — refresh the page or sign in again.";
    if (error.status === 503) return "Server is starting up — try again in a moment.";
    if (error.status >= 500) return "Server error. If pledges or streak won't save, the database may need updating.";
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
