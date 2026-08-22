import { readFileSync, writeFileSync } from "node:fs";
import type {
  ApplicationSettings,
  UpdateApplicationSettingsInput,
} from "../../../ipc/contracts";

const DEFAULT_SETTINGS: ApplicationSettings = {
  runInBackground: true,
};

export class ApplicationSettingsRepository {
  constructor(private readonly path: string) {}

  get(): ApplicationSettings {
    try {
      const value = JSON.parse(readFileSync(this.path, "utf8")) as unknown;
      return parseSettings(value);
    } catch (error) {
      if (isMissingFileError(error)) return { ...DEFAULT_SETTINGS };
      console.error("Failed to read application settings", error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  update(input: UpdateApplicationSettingsInput): ApplicationSettings {
    if (typeof input.runInBackground !== "boolean") {
      throw new TypeError("runInBackground must be a boolean");
    }
    const settings: ApplicationSettings = {
      ...this.get(),
      runInBackground: input.runInBackground,
    };
    writeFileSync(this.path, `${JSON.stringify(settings, null, 2)}\n`, {
      encoding: "utf8",
      flush: true,
    });
    return settings;
  }
}

function parseSettings(value: unknown): ApplicationSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_SETTINGS };
  const runInBackground = (value as Record<string, unknown>).runInBackground;
  return {
    runInBackground:
      typeof runInBackground === "boolean"
        ? runInBackground
        : DEFAULT_SETTINGS.runInBackground,
  };
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
