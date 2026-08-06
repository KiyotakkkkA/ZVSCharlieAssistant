import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
  throw new Error("Сборка zvs_tools пока настроена только для Windows");
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const profile = process.argv[2] === "debug" ? "debug" : "release";
const source = resolve(root, "target", profile, "zvs_tools.dll");
const destination = resolve(root, "../../desktop/native/zvs_tools.node");
mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
console.log(`Native addon: ${destination}`);

