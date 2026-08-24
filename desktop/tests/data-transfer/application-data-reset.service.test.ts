import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ApplicationDataResetService } from "../../src/host/infrastructure/data-transfer/application-data-reset.service";

let directory: string | undefined;

afterEach(() => {
  if (!directory) return;
  const target = resolve(directory);
  const temporaryRoot = resolve(tmpdir());
  const relativePath = relative(temporaryRoot, target);
  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`Refusing to remove a non-temporary path: ${target}`);
  }
  rmSync(target, { recursive: true, force: true });
  directory = undefined;
});

describe("ApplicationDataResetService", () => {
  it("removes every application data entry only after a reset is requested", () => {
    directory = mkdtempSync(join(tmpdir(), "zvs-data-reset-"));
    const service = new ApplicationDataResetService(directory);
    const database = join(directory, "storage.db");
    const localStorage = join(directory, "Local Storage");
    const processLock = join(directory, "lockfile");
    writeFileSync(database, "database", "utf8");
    writeFileSync(processLock, "current process", "utf8");
    mkdirSync(localStorage);
    writeFileSync(join(localStorage, "state"), "renderer state", "utf8");

    expect(service.applyPendingReset()).toBe(false);
    expect(existsSync(database)).toBe(true);

    service.requestReset();
    expect(service.applyPendingReset()).toBe(true);
    expect(existsSync(database)).toBe(false);
    expect(existsSync(localStorage)).toBe(false);
    expect(existsSync(processLock)).toBe(true);
    expect(service.applyPendingReset()).toBe(false);
  });
});
