import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";

const rootDir = process.cwd();
const outDir = join(rootDir, "out");
const nextStaticDir = join(rootDir, ".next", "static");
const nextAppDir = join(rootDir, ".next", "server", "app");
const publicDir = join(rootDir, "public");

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(from, to) {
  if (await exists(from)) {
    await cp(from, to, { recursive: true });
  }
}

async function copyStaticPage(fileName, routePath) {
  const from = join(nextAppDir, fileName);
  if (!(await exists(from))) return false;

  const targetDir = routePath ? join(outDir, routePath) : outDir;
  await mkdir(targetDir, { recursive: true });
  await cp(from, join(targetDir, "index.html"));
  return true;
}

if (!(await exists(nextStaticDir)) || !(await exists(nextAppDir))) {
  throw new Error(
    "Next build output was not found. Run `npm run build` before `npm run cap:sync`."
  );
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await copyIfExists(publicDir, outDir);
await copyIfExists(nextStaticDir, join(outDir, "_next", "static"));

const staticPages = [
  ["index.html", ""],
  ["login.html", "login"],
  ["signup.html", "signup"],
  ["forgot-password.html", "forgot-password"],
  ["roadmap.html", "roadmap"],
  ["_not-found.html", "404"],
];

let copiedPages = 0;
for (const [fileName, routePath] of staticPages) {
  if (await copyStaticPage(fileName, routePath)) copiedPages += 1;
}

const entries = await readdir(outDir, { withFileTypes: true });
const names = entries.map((entry) => basename(entry.name)).sort();

console.log(
  `Prepared Capacitor webDir at out/ with ${copiedPages} static page(s): ${names.join(", ")}`
);
console.log(
  "Server-rendered Next routes and API routes still require CAPACITOR_SERVER_URL or a deployed backend."
);
