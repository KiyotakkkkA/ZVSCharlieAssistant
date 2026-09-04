import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] === "debug" ? "debug" : "release";
const cargoEnv = {
  ...process.env,
  CARGO_TARGET_DIR: join(root, "target"),
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result;
};

const protocPackage = (() => {
  if (process.platform === "win32") return "protoc-bin-vendored-win32";
  const os = process.platform === "darwin" ? "macos" : process.platform;
  const arch = {
    x64: "x86_64",
    ia32: "x86_32",
    arm64: "aarch_64",
    ppc64: "ppcle_64",
    s390x: "s390_64",
  }[process.arch];
  if (!arch || !["linux", "macos"].includes(os)) {
    throw new Error(`Vendored protoc is unavailable for ${process.platform}/${process.arch}`);
  }
  return `protoc-bin-vendored-${os}-${arch}`;
})();

const metadata = spawnSync(
  "cargo",
  ["metadata", "--format-version", "1", "--offline"],
  {
    cwd: root,
    encoding: "utf8",
    shell: false,
    maxBuffer: 64 * 1024 * 1024,
    env: cargoEnv,
  },
);
if (metadata.error) throw metadata.error;
if (metadata.status !== 0) {
  process.stderr.write(metadata.stderr);
  process.exit(metadata.status ?? 1);
}
const packageInfo = JSON.parse(metadata.stdout).packages.find(
  (entry) => entry.name === protocPackage,
);
if (!packageInfo) {
  throw new Error(`Cargo metadata does not contain ${protocPackage}`);
}
const protoc = join(
  dirname(packageInfo.manifest_path),
  "bin",
  process.platform === "win32" ? "protoc.exe" : "protoc",
);
if (!existsSync(protoc)) throw new Error(`Vendored protoc not found: ${protoc}`);

const cargoArgs = ["build", "--offline"];
if (mode === "release") cargoArgs.push("--release");
run("cargo", cargoArgs, {
  env: { ...cargoEnv, PROTOC: protoc },
});
run(process.execPath, ["scripts/copy-native.mjs", ...(mode === "debug" ? ["debug"] : [])]);
