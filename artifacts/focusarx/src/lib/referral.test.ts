import { describe, it, expect, beforeEach, vi } from "vitest";
import { captureReferralFromUrl, tryApplyPendingReferral } from "./referral";

describe("referral capture/apply (Phase 9.12 funnel)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("captures valid codes and ignores garbage", () => {
    expect(captureReferralFromUrl("?ref=FAX-AB12CD34")).toBe("FAX-AB12CD34");
    expect(window.localStorage.getItem("focusarx-ref-code")).toBe("FAX-AB12CD34");
    expect(captureReferralFromUrl("?ref=nope")).toBeNull();
    expect(captureReferralFromUrl("")).toBeNull();
  });

  it("applies once, then stops", async () => {
    window.localStorage.setItem("focusarx-auth-token", "t");
    window.localStorage.setItem("focusarx-ref-code", "FAX-AB12CD34");
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    try {
      expect(await tryApplyPendingReferral()).toBe("applied");
      expect(window.localStorage.getItem("focusarx-ref-applied")).toBe("1");
      expect(await tryApplyPendingReferral()).toBe("none");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("defers without a token and drops invalid codes quietly", async () => {
    window.localStorage.setItem("focusarx-ref-code", "FAX-AB12CD34");
    expect(await tryApplyPendingReferral()).toBe("deferred");
    window.localStorage.setItem("focusarx-auth-token", "t");
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue(new Response("{}", { status: 400 }));
    try {
      expect(await tryApplyPendingReferral()).toBe("none");
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
