import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

console.log("Pushing schema to database…");
execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" });

console.log("Regenerating Prisma client…");
execSync("npx prisma generate", { stdio: "inherit" });

console.log("Done. Restart `npm run dev` if it is running.");
