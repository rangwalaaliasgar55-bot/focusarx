import { describe, it, expect } from "vitest";
import { networkNotice } from "./connectionCopy";

/**
 * The two error surfaces used to describe the same event differently.
 *
 * `ErrorState` read `navigator.onLine` once, at render, and said "You're
 * offline"; `QueryError` said "Check your connection, then try again" whether
 * or not the user was offline. Both now resolve their wording here, so the
 * language is decided in one place and a request that failed for a reason
 * unrelated to connectivity still falls through to the caller's own copy.
 */

describe("networkNotice", () => {
  it("tells an offline user they are offline, for each surface", () => {
    const page = networkNotice("offline", "page");
    const inline = networkNotice("offline", "inline");

    expect(page?.title).toBe("You're offline");
    expect(page?.action).toBe("Reconnect");
    // The full-page copy may promise safety; the inline one is shorter.
    expect(page?.message).toContain("nothing you did will be lost");
    expect(inline?.title).toBe("You're offline");
    expect(inline?.message).toContain("load on its own");
  });

  it("names the connection when it is slow", () => {
    const slow = networkNotice("slow", "inline");
    expect(slow?.title).toContain("slow");
    // A slow connection is a reason to try again, not a reason to panic.
    expect(slow?.action).toBe("Try again");
  });

  it("stays out of the way when the connection is not the explanation", () => {
    // This is the case both components were originally written for: the
    // request failed, so each caller supplies its own title and message.
    expect(networkNotice("online", "inline")).toBeNull();
    expect(networkNotice("online", "page")).toBeNull();
  });
});
