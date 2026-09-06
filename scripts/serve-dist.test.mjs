import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createStaticServer } from "../artifacts/focusarx/scripts/serve-dist.mjs";

async function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "focusarx-preview-test-"));
  writeFileSync(path.join(root, "index.html"), "<title>SPA fallback</title>");
  mkdirSync(path.join(root, "guide"));
  writeFileSync(path.join(root, "guide/index.html"), "<title>Prerendered guide</title>");
  const server = createStaticServer(root);
  await new Promise((resolve) => server.listen(0, "0.0.0.0", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test("malformed percent escapes return 400 without crashing the server", async (t) => {
  const base = await fixture(t);
  for (const pathname of ["/%ZZ", "/%C3"]) {
    const response = await fetch(base + pathname);
    assert.equal(response.status, 400);
    assert.equal(await response.text(), "Malformed request path");
  }
  const healthy = await fetch(base + "/");
  assert.equal(healthy.status, 200);
  assert.equal(await healthy.text(), "<title>SPA fallback</title>");
});

test("serves prerendered directory pages before falling back to the SPA", async (t) => {
  const base = await fixture(t);
  const guide = await fetch(base + "/guide?source=test");
  assert.equal(guide.status, 200);
  assert.equal(await guide.text(), "<title>Prerendered guide</title>");
  const privateRoute = await fetch(base + "/dashboard");
  assert.equal(privateRoute.status, 200);
  assert.match(privateRoute.headers.get("content-type"), /text\/html/);
  assert.equal(await privateRoute.text(), "<title>SPA fallback</title>");
});
