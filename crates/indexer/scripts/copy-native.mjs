import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
  throw new Error("Сборка zvs_indexer пока настроена только для Windows");
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const profile = process.argv[2] === "debug" ? "debug" : "release";
const buildDir = resolve(root, "target", profile);
const nativeDir = resolve(root, "../../desktop/native");
mkdirSync(nativeDir, { recursive: true });

function copyOrExplain(from, to) {
  try {
    copyFileSync(from, to);
  } catch (error) {
    if (error.code === "EBUSY" || error.code === "EPERM") {
      console.error(
        `Не удалось записать ${to}: файл занят.\nЗакройте запущенное приложение ZVS и повторите «npm run build:native».`,
      );
      process.exit(1);
    }
    throw error;
  }
}

const addon = join(nativeDir, "zvs_indexer.node");
copyOrExplain(join(buildDir, "zvs_indexer.dll"), addon);
console.log(`Native addon: ${addon}`);

const runtime = readdirSync(buildDir).filter(
  (name) =>
    name === "DirectML.dll" ||
    (name.startsWith("onnxruntime_providers_") && name.endsWith(".dll")),
);
if (!runtime.length) {
  console.warn(
    "ВНИМАНИЕ: рядом со сборкой нет DirectML.dll и onnxruntime_providers_*.dll — распознавание будет работать только на процессоре.",
  );
}
for (const name of runtime) {
  copyOrExplain(join(buildDir, name), join(nativeDir, name));
  console.log(`  ускоритель: ${name}`);
}
