import { readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cratesRoot = resolve(desktopRoot, "../crates");

const crates = [
  { name: "tools", addon: "zvs_tools.node" },
  { name: "indexer", addon: "zvs_indexer.node" },
];

function latestInputTime(directory) {
  let latest = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "target") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) latest = Math.max(latest, latestInputTime(path));
    else if (entry.isFile()) latest = Math.max(latest, statSync(path).mtimeMs);
  }
  return latest;
}

for (const crate of crates) {
  const crateRoot = join(cratesRoot, crate.name);
  const addon = join(desktopRoot, "native", crate.addon);
  let current = false;
  try {
    current = statSync(addon).mtimeMs >= latestInputTime(crateRoot);
  } catch {
    // A missing addon or unreadable input requires a normal rebuild.
  }
  if (current) {
    console.log(`Native addon is current: ${crate.addon}`);
    continue;
  }
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["--prefix", crateRoot, "run", "build"], {
    cwd: desktopRoot,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
