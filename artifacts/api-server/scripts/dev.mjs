import { spawn } from "node:child_process";

// `node --import tsx/esm --watch` + pino's thread-stream transport crashes on
// Node 24 ("this should not happen: undefined" from the transport worker), so
// the API never stayed up under that invocation. `tsx watch` runs its own
// watcher around a plain child process, which boots the pino-pretty transport
// worker fine. This wrapper stays to force NODE_ENV=development and forward
// the exit signal.
const child = spawn("./node_modules/.bin/tsx", ["watch", "--env-file-if-exists=../../.env", "src/index.ts"], {
  env: { ...process.env, NODE_ENV: "development" },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
