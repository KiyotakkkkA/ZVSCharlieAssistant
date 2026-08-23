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
    expect(repository.get()).toEqual({
      runInBackground: true,
      onboarding: defaultOnboarding(),
    });

    expect(repository.update({ runInBackground: false })).toEqual({
      runInBackground: false,
      onboarding: defaultOnboarding(),
    });
    expect(repository.get()).toEqual({
      runInBackground: false,
      onboarding: defaultOnboarding(),
    });
    expect(JSON.parse(readFileSync(settingsPath(), "utf8"))).toEqual({
      runInBackground: false,
      onboarding: defaultOnboarding(),
    });
  });

  it("falls back safely when the settings file is invalid", () => {
    const repository = createRepository();
    writeFileSync(settingsPath(), "not-json", "utf8");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(repository.get()).toEqual({
      runInBackground: true,
      onboarding: defaultOnboarding(),
    });
    expect(log).toHaveBeenCalledOnce();
  });

  it("reads a legacy file and applies partial onboarding patches", () => {
    const repository = createRepository();
    writeFileSync(settingsPath(), JSON.stringify({ runInBackground: false }));

    expect(repository.update({ onboarding: { tourCompleted: true } })).toEqual({
      runInBackground: false,
      onboarding: { ...defaultOnboarding(), tourCompleted: true },
    });
  });

  it("discards malformed values and de-duplicates completed steps", () => {
    const repository = createRepository();
    writeFileSync(
      settingsPath(),
      JSON.stringify({
        runInBackground: "yes",
        onboarding: {
          version: "one",
          wizardCompleted: 1,
          tourCompleted: true,
          completedSteps: ["profile", 4, "profile", "chat"],
          completedGuides: ["beginning", false, "beginning", "chat"],
          firstLaunchAt: 123,
        },
      }),
    );

    expect(repository.get()).toEqual({
      runInBackground: true,
      onboarding: {
        ...defaultOnboarding(),
        tourCompleted: true,
        completedSteps: ["profile", "chat"],
        completedGuides: ["beginning", "chat"],
      },
    });
  });
});

function defaultOnboarding() {
  return {
    version: 2,
    wizardCompleted: false,
    tourCompleted: false,
    checklistDismissed: false,
    completedSteps: [],
    completedGuides: [],
    firstLaunchAt: null,
  };
}

function createRepository(): ApplicationSettingsRepository {
  directory = mkdtempSync(join(tmpdir(), "zvs-application-settings-"));
  return new ApplicationSettingsRepository(settingsPath());
}

function settingsPath(): string {
  if (!directory) throw new Error("Temporary directory is not initialized");
  return join(directory, "application-settings.json");
}
