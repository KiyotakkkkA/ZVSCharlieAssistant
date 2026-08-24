#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "..", "out", "main", "cli.js");

if (!existsSync(entry)) {
  process.stderr.write(
    "CLI не собран. Выполните «npm run build» в каталоге desktop.\n",
  );
  process.exit(3);
}

await import(pathToFileURL(entry).href);
