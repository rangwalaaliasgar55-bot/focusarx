/**
 * A frame pack is a promise about the *whole* interface.
 *
 * The rail / top-bar / tab-bar shells are the widest thing an admin can change:
 * picking one rebuilds the navigation, so a half-wired frame does not look like
 * a bug, it looks like a product with fewer doors — the rail frame's
 * destinations simply are not there any more, and nothing throws.
 *
 * `SHELLS` is a registry of ids; the frame itself lives in `AppShell.tsx`
 * (a conditional rail, a navigation strip, the tab bar) and in `index.css` (the
 * `[data-shell=…]` rules that remove the rail and keep the tab bar at desktop
 * widths). None of those three files can import the other two's facts, so this
 * gate joins them up: a new frame id that nobody built a branch for fails here
 * rather than shipping as an empty interface.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_APPEARANCE, SHELLS, SHELL_IDS } from "./designPacks";

const SRC = join(process.cwd(), "src");
const shellSource = readFileSync(join(SRC, "components/AppShell.tsx"), "utf8");
const css = readFileSync(join(SRC, "index.css"), "utf8");

describe("the app-frame packs", () => {
  it("only offers frames the shell knows how to build", () => {
    // Every id has to be built *somewhere* — a branch in the shell for the
    // frames that change what is rendered (a rail, a strip), or a stylesheet
    // rule for the ones that are pure layout (the tab frame removes the rail
    // and keeps the bottom bar, which is CSS all the way down). An id with
    // neither renders the default frame and the pack silently does nothing.
    expect(shellSource, "the frame is never published to the DOM").toContain("data-shell={shell}");
    for (const frame of SHELLS) {
      const branch = shellSource.includes(`shell === "${frame.id}"`);
      const rule = css.includes(`[data-shell="${frame.id}"]`);
      expect(branch || rule, `nothing builds the "${frame.id}" frame`).toBe(true);
    }
  });

  it("styles every frame that is not the default one", () => {
    // The default frame is the base layout, so it needs no rule; every other id
    // must appear in the stylesheet, or selecting it changes nothing visible.
    for (const id of SHELL_IDS) {
      if (id === DEFAULT_APPEARANCE.shell) continue;
      expect(css, `index.css has no [data-shell="${id}"] rule`).toContain(`[data-shell="${id}"]`);
    }
    // The tab frame's whole point is that its bar survives a desktop viewport —
    // the base rule hides it above 1024px, so the override has to exist.
    expect(css).toContain('[data-shell="tabs"] .app-bottom-nav');
  });

  it("reads the frame from the assignment instead of hard-coding it", () => {
    // If this ever becomes a constant, the console's frame column is a lie.
    expect(shellSource).toContain("useAppearanceFields().shell");
  });

  it("documents every frame in docs/DESIGN_PACKS.md", () => {
    const doc = readFileSync(join(SRC, "../../../docs/DESIGN_PACKS.md"), "utf8");
    for (const frame of SHELLS) {
      expect(doc, `${frame.id} is missing from docs/DESIGN_PACKS.md`).toContain(frame.label);
    }
  });
});
