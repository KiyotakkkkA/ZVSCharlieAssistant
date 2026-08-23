import { readFileSync, writeFileSync } from "node:fs";
import type {
  ApplicationSettings,
  UpdateApplicationSettingsInput,
} from "../../../ipc/contracts";

const DEFAULT_SETTINGS: ApplicationSettings = {
  runInBackground: true,
  onboarding: {
    version: 2,
    wizardCompleted: false,
    tourCompleted: false,
    checklistDismissed: false,
    completedSteps: [],
    completedGuides: [],
    firstLaunchAt: null,
  },
};

export class ApplicationSettingsRepository {
  constructor(private readonly path: string) {}

  get(): ApplicationSettings {
    try {
      const value = JSON.parse(readFileSync(this.path, "utf8")) as unknown;
      return parseSettings(value);
    } catch (error) {
      if (isMissingFileError(error)) return createDefaultSettings();
      console.error("Failed to read application settings", error);
      return createDefaultSettings();
    }
  }

  update(input: UpdateApplicationSettingsInput): ApplicationSettings {
    if (
      input.runInBackground !== undefined &&
      typeof input.runInBackground !== "boolean"
    ) {
      throw new TypeError("runInBackground must be a boolean");
    }
    validateOnboardingPatch(input.onboarding);
    const current = this.get();
    const settings: ApplicationSettings = {
      ...current,
      ...(input.runInBackground === undefined
        ? {}
        : { runInBackground: input.runInBackground }),
      onboarding: {
        ...current.onboarding,
        ...input.onboarding,
        completedSteps: input.onboarding?.completedSteps
          ? uniqueStrings(input.onboarding.completedSteps)
          : current.onboarding.completedSteps,
        completedGuides: input.onboarding?.completedGuides
          ? uniqueStrings(input.onboarding.completedGuides)
          : current.onboarding.completedGuides,
      },
    };
    writeFileSync(this.path, `${JSON.stringify(settings, null, 2)}\n`, {
      encoding: "utf8",
      flush: true,
    });
    return settings;
  }
}

function parseSettings(value: unknown): ApplicationSettings {
  if (!value || typeof value !== "object") return createDefaultSettings();
  const record = value as Record<string, unknown>;
  const runInBackground = record.runInBackground;
  const onboarding =
    record.onboarding && typeof record.onboarding === "object"
      ? (record.onboarding as Record<string, unknown>)
      : {};
  return {
    runInBackground:
      typeof runInBackground === "boolean"
        ? runInBackground
        : DEFAULT_SETTINGS.runInBackground,
    onboarding: {
      version: readNumber(onboarding.version, DEFAULT_SETTINGS.onboarding.version),
      wizardCompleted: readBoolean(
        onboarding.wizardCompleted,
        DEFAULT_SETTINGS.onboarding.wizardCompleted,
      ),
      tourCompleted: readBoolean(
        onboarding.tourCompleted,
        DEFAULT_SETTINGS.onboarding.tourCompleted,
      ),
      checklistDismissed: readBoolean(
        onboarding.checklistDismissed,
        DEFAULT_SETTINGS.onboarding.checklistDismissed,
      ),
      completedSteps: uniqueStrings(onboarding.completedSteps),
      completedGuides: uniqueStrings(onboarding.completedGuides),
      firstLaunchAt:
        typeof onboarding.firstLaunchAt === "string"
          ? onboarding.firstLaunchAt
          : null,
    },
  };
}

function createDefaultSettings(): ApplicationSettings {
  return {
    ...DEFAULT_SETTINGS,
    onboarding: {
      ...DEFAULT_SETTINGS.onboarding,
      completedSteps: [],
      completedGuides: [],
    },
  };
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function uniqueStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string"))]
    : [];
}

function validateOnboardingPatch(
  patch: UpdateApplicationSettingsInput["onboarding"],
): void {
  if (patch === undefined) return;
  if (!patch || typeof patch !== "object") {
    throw new TypeError("onboarding must be an object");
  }
  if (
    patch.version !== undefined &&
    (typeof patch.version !== "number" || !Number.isFinite(patch.version) || patch.version < 0)
  ) {
    throw new TypeError("onboarding.version must be a non-negative number");
  }
  for (const key of [
    "wizardCompleted",
    "tourCompleted",
    "checklistDismissed",
  ] as const) {
    if (patch[key] !== undefined && typeof patch[key] !== "boolean") {
      throw new TypeError(`onboarding.${key} must be a boolean`);
    }
  }
  if (
    patch.completedSteps !== undefined &&
    (!Array.isArray(patch.completedSteps) ||
      patch.completedSteps.some((item) => typeof item !== "string"))
  ) {
    throw new TypeError("onboarding.completedSteps must be an array of strings");
  }
  if (
    patch.completedGuides !== undefined &&
    (!Array.isArray(patch.completedGuides) ||
      patch.completedGuides.some((item) => typeof item !== "string"))
  ) {
    throw new TypeError("onboarding.completedGuides must be an array of strings");
  }
  if (
    patch.firstLaunchAt !== undefined &&
    patch.firstLaunchAt !== null &&
    typeof patch.firstLaunchAt !== "string"
  ) {
    throw new TypeError("onboarding.firstLaunchAt must be a string or null");
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
