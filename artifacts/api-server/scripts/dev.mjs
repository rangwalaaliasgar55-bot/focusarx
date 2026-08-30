import { spawn } from "node:child_process";

const child = spawn(
  process.execPath,
  ["--import", "tsx/esm", "--watch", "--env-file-if-exists=../../.env", "src/index.ts"],
  { env: { ...process.env, NODE_ENV: "development" }, stdio: "inherit" },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});