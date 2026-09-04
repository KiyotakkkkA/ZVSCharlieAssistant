import { readFileSync, writeFileSync } from "node:fs";
import type {
  ApplicationSettings,
  OcrProviderPreference,
  UpdateApplicationSettingsInput,
} from "../../../ipc/contracts";

const PROVIDER_PREFERENCES: readonly OcrProviderPreference[] = [
  "auto",
  "cuda",
  "directml",
  "cpu",
];

function isProviderPreference(value: unknown): value is OcrProviderPreference {
  return (PROVIDER_PREFERENCES as readonly unknown[]).includes(value);
}

const DEFAULT_SETTINGS: ApplicationSettings = {
  runInBackground: true,
  launchAtLogin: false,
  notifications: {
    enabled: false,
    chatGenerationCompleted: true,
    agentQuestionAsked: true,
    scenarioStarted: true,
    scenarioCompleted: true,
    vectorizationCompleted: true,
    downloadCompleted: true,
  },
  onboarding: {
    version: 2,
    tourCompleted: false,
    completedGuides: [],
    firstLaunchAt: null,
  },
  indexing: {
    provider: "auto",
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
    if (
      input.launchAtLogin !== undefined &&
      typeof input.launchAtLogin !== "boolean"
    ) {
      throw new TypeError("launchAtLogin must be a boolean");
    }
    validateNotificationPatch(input.notifications);
    validateOnboardingPatch(input.onboarding);
    validateIndexingPatch(input.indexing);
    const current = this.get();
    const settings: ApplicationSettings = {
      ...current,
      ...(input.runInBackground === undefined
        ? {}
        : { runInBackground: input.runInBackground }),
      ...(input.launchAtLogin === undefined
        ? {}
        : { launchAtLogin: input.launchAtLogin }),
      notifications: {
        ...current.notifications,
        ...input.notifications,
      },
      onboarding: {
        ...current.onboarding,
        ...input.onboarding,
        completedGuides: input.onboarding?.completedGuides
          ? uniqueStrings(input.onboarding.completedGuides)
          : current.onboarding.completedGuides,
      },
      indexing: {
        ...current.indexing,
        ...input.indexing,
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
  const launchAtLogin = record.launchAtLogin;
  const notifications =
    record.notifications && typeof record.notifications === "object"
      ? (record.notifications as Record<string, unknown>)
      : {};
  const onboarding =
    record.onboarding && typeof record.onboarding === "object"
      ? (record.onboarding as Record<string, unknown>)
      : {};
  const indexing =
    record.indexing && typeof record.indexing === "object"
      ? (record.indexing as Record<string, unknown>)
      : {};
  return {
    runInBackground:
      typeof runInBackground === "boolean"
        ? runInBackground
        : DEFAULT_SETTINGS.runInBackground,
    launchAtLogin:
      typeof launchAtLogin === "boolean"
        ? launchAtLogin
        : DEFAULT_SETTINGS.launchAtLogin,
    notifications: {
      enabled: readBoolean(
        notifications.enabled,
        DEFAULT_SETTINGS.notifications.enabled,
      ),
      chatGenerationCompleted: readBoolean(
        notifications.chatGenerationCompleted,
        DEFAULT_SETTINGS.notifications.chatGenerationCompleted,
      ),
      agentQuestionAsked: readBoolean(
        notifications.agentQuestionAsked,
        DEFAULT_SETTINGS.notifications.agentQuestionAsked,
      ),
      scenarioStarted: readBoolean(
        notifications.scenarioStarted,
        DEFAULT_SETTINGS.notifications.scenarioStarted,
      ),
      scenarioCompleted: readBoolean(
        notifications.scenarioCompleted,
        DEFAULT_SETTINGS.notifications.scenarioCompleted,
      ),
      vectorizationCompleted: readBoolean(
        notifications.vectorizationCompleted,
        DEFAULT_SETTINGS.notifications.vectorizationCompleted,
      ),
      downloadCompleted: readBoolean(
        notifications.downloadCompleted,
        DEFAULT_SETTINGS.notifications.downloadCompleted,
      ),
    },
    onboarding: {
      version: readNumber(
        onboarding.version,
        DEFAULT_SETTINGS.onboarding.version,
      ),
      tourCompleted: readBoolean(
        onboarding.tourCompleted,
        DEFAULT_SETTINGS.onboarding.tourCompleted,
      ),
      completedGuides: uniqueStrings(onboarding.completedGuides),
      firstLaunchAt:
        typeof onboarding.firstLaunchAt === "string"
          ? onboarding.firstLaunchAt
          : null,
    },
    indexing: {
      provider: isProviderPreference(indexing.provider)
        ? indexing.provider
        : "auto",
    },
  };
}

function createDefaultSettings(): ApplicationSettings {
  return {
    ...DEFAULT_SETTINGS,
    notifications: { ...DEFAULT_SETTINGS.notifications },
    onboarding: {
      ...DEFAULT_SETTINGS.onboarding,
      completedGuides: [],
    },
    indexing: { ...DEFAULT_SETTINGS.indexing },
  };
}

function validateNotificationPatch(
  patch: UpdateApplicationSettingsInput["notifications"],
): void {
  if (patch === undefined) return;
  if (!patch || typeof patch !== "object") {
    throw new TypeError("notifications must be an object");
  }
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value !== "boolean") {
      throw new TypeError(`notifications.${key} must be a boolean`);
    }
  }
}

function validateIndexingPatch(
  patch: UpdateApplicationSettingsInput["indexing"],
): void {
  if (patch === undefined) return;
  if (!patch || typeof patch !== "object") {
    throw new TypeError("indexing must be an object");
  }
  if (patch.provider !== undefined && !isProviderPreference(patch.provider)) {
    throw new TypeError(
      "indexing.provider must be auto, cuda, directml or cpu",
    );
  }
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
    ? [
        ...new Set(
          value.filter((item): item is string => typeof item === "string"),
        ),
      ]
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
    (typeof patch.version !== "number" ||
      !Number.isFinite(patch.version) ||
      patch.version < 0)
  ) {
    throw new TypeError("onboarding.version must be a non-negative number");
  }
  for (const key of ["tourCompleted"] as const) {
    if (patch[key] !== undefined && typeof patch[key] !== "boolean") {
      throw new TypeError(`onboarding.${key} must be a boolean`);
    }
  }
  if (
    patch.completedGuides !== undefined &&
    (!Array.isArray(patch.completedGuides) ||
      patch.completedGuides.some((item) => typeof item !== "string"))
  ) {
    throw new TypeError(
      "onboarding.completedGuides must be an array of strings",
    );
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
