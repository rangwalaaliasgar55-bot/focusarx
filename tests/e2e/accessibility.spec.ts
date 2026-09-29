import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const path of ["/", "/pricing", "/comparison/focusarx-vs-forest", "/comparison/focusarx-vs-focus-todo", "/focus-guide"]) {
  test(`${path} has no serious accessibility violations and fits viewport`, async ({ page }, testInfo) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    const serious = results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );

    // Attach the full axe payload so the HTML report (uploaded as a CI artifact)
    // carries every offending selector — the raw job log is not always
    // retrievable, so a bare `toEqual([])` diff would be undiagnosable.
    if (serious.length > 0) {
      await testInfo.attach("axe-violations.json", {
        body: JSON.stringify(serious, null, 2),
        contentType: "application/json",
      });
    }

    // A readable one-line-per-violation summary that shows up directly in the
    // assertion message: rule, impact, and the first offending element.
    const summary = serious
      .map((v) => {
        const node = v.nodes[0];
        return `  [${v.impact}] ${v.id} — ${v.help}\n    ${v.helpUrl}\n    e.g. ${node?.target?.join(" ")} :: ${node?.html?.slice(0, 200)}`;
      })
      .join("\n");
    expect(serious, `Serious/critical axe violations on ${path} (${testInfo.project.name}):\n${summary}`).toEqual([]);

    // Horizontal overflow: report the actual widest offenders (tag + classes +
    // geometry) instead of a bare boolean so the culprit element is named.
    const overflow = await page.evaluate(() => {
      const vw = window.innerWidth;
      const offenders: Array<{ tag: string; cls: string; left: number; right: number }> = [];
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > vw + 1 || r.left < -1) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.getAttribute("class") ?? "").slice(0, 120),
            left: Math.round(r.left),
            right: Math.round(r.right),
          });
        }
      }
      return {
        overflowing: document.documentElement.scrollWidth > vw + 1,
        vw,
        scrollWidth: document.documentElement.scrollWidth,
        offenders: offenders.slice(0, 12),
      };
    });
    const overflowMsg =
      `Horizontal overflow on ${path} (${testInfo.project.name}): ` +
      `scrollWidth=${overflow.scrollWidth} > innerWidth=${overflow.vw}\n` +
      overflow.offenders.map((o) => `  <${o.tag} class="${o.cls}"> left=${o.left} right=${o.right}`).join("\n");
    expect(overflow.overflowing, overflowMsg).toBe(false);
  });
}
