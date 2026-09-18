import { describe, it, expect } from "vitest";
import { isActiveRoute } from "./navActive";

describe("isActiveRoute", () => {
  it("lights the entry for the current path", () => {
    expect(isActiveRoute("/dashboard", "/dashboard")).toBe(true);
    expect(isActiveRoute("/dashboard", "/tasks")).toBe(false);
  });

  it("ignores the query string", () => {
    // Deep links carry params (`/profile?tab=custom`). Without this the page
    // renders with nothing highlighted and the navigation looks broken.
    expect(isActiveRoute("/dashboard?range=week", "/dashboard")).toBe(true);
    expect(isActiveRoute("/dashboard", "/dashboard?range=week")).toBe(true);
    expect(isActiveRoute("/dashboard?range=week#top", "/dashboard")).toBe(true);
  });

  it("ignores a trailing slash", () => {
    expect(isActiveRoute("/messages/", "/messages")).toBe(true);
    expect(isActiveRoute("/messages", "/messages/")).toBe(true);
  });

  it("keeps a parent entry lit on a nested route", () => {
    expect(isActiveRoute("/messages/42", "/messages")).toBe(true);
    expect(isActiveRoute("/study-rooms/abc/notes", "/study-rooms")).toBe(true);
  });

  it("never lets the root entry match everything", () => {
    // "/" prefixes every route in the app. A prefix match here would light the
    // timer up on all 102 pages.
    expect(isActiveRoute("/dashboard", "/")).toBe(false);
    expect(isActiveRoute("/messages/42", "/")).toBe(false);
    expect(isActiveRoute("/", "/")).toBe(true);
  });

  it("does not match a sibling that merely shares a prefix", () => {
    // `/tasks` and `/tasks-archive` are different pages; the nested check must
    // require the separator.
    expect(isActiveRoute("/tasks-archive", "/tasks")).toBe(false);
    expect(isActiveRoute("/goals", "/goal")).toBe(false);
  });

  it("treats / and /focus as the same destination, both ways round", () => {
    // Both URLs mount the timer. This replaces the hard-coded
    // `href === "/" && location === "/focus"` special case in the mobile nav.
    expect(isActiveRoute("/focus", "/")).toBe(true);
    expect(isActiveRoute("/", "/focus")).toBe(true);
    expect(isActiveRoute("/focus?duration=25", "/")).toBe(true);
  });

  it("does not confuse the timer with other routes", () => {
    expect(isActiveRoute("/focus", "/focus-guide")).toBe(false);
    expect(isActiveRoute("/focus-guide", "/focus")).toBe(false);
  });
});
