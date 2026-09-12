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

test("unknown URLs answer 404 with the dedicated not-found document", async (t) => {
  const base = await fixture(t);
  // The fixture root has no 404.html, so the server must still answer 404 —
  // never the 200 + homepage prerender that made junk URLs look like
  // duplicates of the homepage to Google.
  for (const pathname of ["/totally-fake-page-xyz", "/blog/not-a-real-post", "/dash"]) {
    const response = await fetch(base + pathname);
    assert.equal(response.status, 404, `${pathname} should be a hard 404`);
  }
});

test("missing build assets answer 404 with no HTML body", async (t) => {
  const base = await fixture(t);
  const response = await fetch(base + "/assets/dashboard-DOESNOTEXIST.js");
  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type"), /text\/plain/);
  // The old catch-all answered 200 + index.html here, which the service worker
  // then cached under the asset URL and served on every later reload.
  const body = await response.text();
  assert.ok(!body.includes("<"), "an asset miss must never return markup");
});

test("the 404 document is served from disk when the build wrote one", async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "focusarx-404-test-"));
  writeFileSync(path.join(root, "index.html"), "<title>SPA fallback</title>");
  writeFileSync(path.join(root, "404.html"), "<title>Page not found | FocusArx</title>");
  const server = createStaticServer(root);
  await new Promise((resolve) => server.listen(0, "0.0.0.0", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  });

  const response = await fetch(`http://127.0.0.1:${server.address().port}/nope`);
  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.equal(await response.text(), "<title>Page not found | FocusArx</title>");
});
