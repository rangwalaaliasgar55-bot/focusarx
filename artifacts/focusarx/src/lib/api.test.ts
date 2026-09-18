import { describe, it, expect } from "vitest";
import { errorMessage, ApiError } from "./api";

/**
 * `errorMessage` replaced 24 copies of `onError: (e: any) => toast(e.message)`.
 *
 * The old form had a bad failure mode that never showed up in testing because
 * it only fires when something unusual throws: a rejected non-Error has no
 * `.message`, so the toast rendered the literal text "undefined" next to a
 * danger icon. These cases are the reason the helper exists.
 */

describe("errorMessage", () => {
  it("prefers the server's own wording from ApiError", () => {
    expect(errorMessage(new ApiError(429, "Too many sign-in attempts, wait a few minutes"))).toBe(
      "Too many sign-in attempts, wait a few minutes",
    );
  });

  it("explains a network failure in the user's terms, not the browser's", () => {
    // `fetch` rejects with a TypeError whose message is "Failed to fetch" or
    // "NetworkError when attempting to fetch resource." — accurate, and
    // useless to someone who just wants to know whether their work is safe.
    expect(errorMessage(new TypeError("Failed to fetch"))).toMatch(/offline/i);
    expect(errorMessage(new TypeError("NetworkError when attempting to fetch resource."))).not.toMatch(
      /NetworkError/,
    );
  });

  it("never renders undefined for a non-Error rejection", () => {
    // A thrown string, a DOMException from an aborted fetch, or a rejected
    // promise with no reason at all.
    expect(errorMessage("boom")).toBe("Something went wrong. Please try again.");
    expect(errorMessage(undefined)).toBe("Something went wrong. Please try again.");
    expect(errorMessage(null)).toBe("Something went wrong. Please try again.");
    expect(errorMessage({ status: 500 })).toBe("Something went wrong. Please try again.");
    expect(errorMessage(undefined)).not.toContain("undefined");
  });

  it("treats a blank Error message as no message", () => {
    expect(errorMessage(new Error("   "))).toBe("Something went wrong. Please try again.");
  });

  it("accepts a caller-specific fallback", () => {
    expect(errorMessage(undefined, "Failed to purchase")).toBe("Failed to purchase");
    // The fallback is also used when an ApiError somehow carries no message.
    expect(errorMessage(new ApiError(500, ""), "Claim failed")).toBe("Claim failed");
  });

  it("passes through an ordinary Error's message", () => {
    expect(errorMessage(new Error("Goal title is required"))).toBe("Goal title is required");
  });
});
