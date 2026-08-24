// Wrapper around drizzle-kit push for non-TTY (Vercel) builds.
// drizzle-kit exits 0 when it cannot show a confirmation prompt, which would
// let the deploy succeed with a drifted schema. Detect that and fail the build.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const kitBin = require.resolve("drizzle-kit/bin.cjs");
const config = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle.config.ts");

const child = spawn(process.execPath, [kitBin, "push", "--config", config], {
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
});

let out = "";
const onChunk = (buf) => {
  const s = buf.toString();
  out += s;
  process.stdout.write(s);
};
child.stdout.on("data", onChunk);
child.stderr.on("data", onChunk);

child.on("close", (code) => {
  const aborted =
    /Interactive prompts require a TTY/i.test(out) ||
    /schema was NOT applied/i.test(out);

  if (aborted) {
    console.error("\ndrizzle-push: ABORTED — schema was NOT applied.\n");
    process.exit(1);
  }
  process.exit(code ?? 1);
});
