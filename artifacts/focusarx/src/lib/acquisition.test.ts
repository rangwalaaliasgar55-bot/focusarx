import { beforeEach, describe, expect, it } from "vitest";
import { captureAcquisition, getAcquisition, parseAcquisition } from "./acquisition";

describe("acquisition attribution", () => {
  beforeEach(() => localStorage.clear());
  it("captures source and campaign without collecting arbitrary query values", () => {
    expect(parseAcquisition("?src=ig&utm_campaign=exam&token=secret", "/focus", 100)).toEqual({ src: "ig", utm_campaign: "exam", capturedAt: 100, landingPath: "/focus" });
  });
  it("persists last-touch attribution across conversion pages", () => {
    captureAcquisition("?src=yt&utm_medium=video", "/focus");
    expect(captureAcquisition("", "/signup")).toMatchObject({ src: "yt", utm_medium: "video", landingPath: "/focus" });
  });
  it("expires old attribution", () => {
    localStorage.setItem("focusarx:acquisition:v1", JSON.stringify({ src: "ig", capturedAt: 1, landingPath: "/" }));
    expect(getAcquisition(100 * 24 * 60 * 60 * 1000)).toBeNull();
  });
});
