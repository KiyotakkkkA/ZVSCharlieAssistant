import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationSettingsRepository } from "../../src/host/infrastructure/electron/application-settings.repository";

let directory: string | undefined;

afterEach(() => {
  vi.restoreAllMocks();
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

describe("ApplicationSettingsRepository", () => {
  it("uses background mode by default and persists changes", () => {
    const repository = createRepository();
    expect(repository.get()).toEqual({ runInBackground: true });

    expect(repository.update({ runInBackground: false })).toEqual({
      runInBackground: false,
    });
    expect(repository.get()).toEqual({ runInBackground: false });
    expect(JSON.parse(readFileSync(settingsPath(), "utf8"))).toEqual({
      runInBackground: false,
    });
  });

  it("falls back safely when the settings file is invalid", () => {
    const repository = createRepository();
    writeFileSync(settingsPath(), "not-json", "utf8");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(repository.get()).toEqual({ runInBackground: true });
    expect(log).toHaveBeenCalledOnce();
  });
});

function createRepository(): ApplicationSettingsRepository {
  directory = mkdtempSync(join(tmpdir(), "zvs-application-settings-"));
  return new ApplicationSettingsRepository(settingsPath());
}

function settingsPath(): string {
  if (!directory) throw new Error("Temporary directory is not initialized");
  return join(directory, "application-settings.json");
}
