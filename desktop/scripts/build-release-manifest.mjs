import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const root = join(import.meta.dirname, "..");
const changelogPath = join(root, "CHANGELOG.md");
const packagePath = join(root, "package.json");
const outputPath = process.argv[2] ?? join(root, "release", "RELEASES.json");

const { version } = JSON.parse(readFileSync(packagePath, "utf8"));
const releases = parseChangelog(readFileSync(changelogPath, "utf8"));

if (releases.length === 0) {
  console.error("CHANGELOG.md has no released sections yet");
  process.exit(1);
}

const [latest] = releases;
if (latest.version !== version) {
  console.error(
    `Version mismatch: package.json is ${version}, newest changelog entry is ${latest.version}.\n` +
      "Rename the [Unreleased] section before publishing.",
  );
  process.exit(1);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `${JSON.stringify({ latest: latest.version, releases }, null, 2)}\n`,
  "utf8",
);

console.log(`Wrote ${releases.length} release(s) to ${outputPath}`);

function parseChangelog(source) {
  const releases = [];
  let current = null;
  let section = null;

  for (const line of source.split(/\r?\n/)) {
    const heading = /^##\s+\[([^\]]+)\](?:\s+[—-]\s+(.+))?\s*$/.exec(line);
    if (heading) {
      const [, name, date] = heading;
      if (name.toLowerCase() === "unreleased") {
        current = null;
        continue;
      }
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
        current = null;
        continue;
      }
      current = { version: name, date: date.trim(), notes: {} };
      releases.push(current);
      section = null;
      continue;
    }

    if (!current) continue;

    const subheading = /^###\s+(.+?)\s*$/.exec(line);
    if (subheading) {
      section = subheading[1].toLowerCase();
      current.notes[section] = [];
      continue;
    }

    const item = /^[-*]\s+(.+?)\s*$/.exec(line);
    if (item && section) {
      current.notes[section].push(item[1]);
      continue;
    }

    const continuation = /^\s+(\S.*?)\s*$/.exec(line);
    const entries = section ? current.notes[section] : undefined;
    if (continuation && entries && entries.length > 0) {
      entries[entries.length - 1] += ` ${continuation[1]}`;
    }
  }

  return releases;
}
