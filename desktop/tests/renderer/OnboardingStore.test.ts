import { beforeEach, describe, expect, it, vi } from "vitest";
import { observable } from "mobx";
import { OnboardingStore } from "../../src/renderer/stores/OnboardingStore";

const onboarding = {
  version: 2,
  tourCompleted: false,
  completedGuides: [],
  firstLaunchAt: "2026-08-24T00:00:00.000Z",
};

const notifications = {
  enabled: false,
  chatGenerationCompleted: true,
  agentQuestionAsked: true,
  scenarioStarted: true,
  scenarioCompleted: true,
  vectorizationCompleted: true,
};

beforeEach(() => {
  const update = vi.fn(async ({ onboarding: patch }) => {
    const clonedPatch = structuredClone(patch);

    return {
      runInBackground: true,
      launchAtLogin: false,
      notifications,
      onboarding: { ...onboarding, ...clonedPatch },
    };
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { desktop: { applicationSettings: { update } } },
  });
});

describe("OnboardingStore", () => {
  it("tracks each completed guide independently", async () => {
    const store = new OnboardingStore();
    store.settings = {
      indexing: { provider: "auto" },
      runInBackground: true,
      launchAtLogin: false,
      notifications,
      onboarding: {
        ...onboarding,
        completedGuides: observable.array<string>([]),
      },
    };
    store.startGuide("chat");
    await expect(store.finishGuide()).resolves.toBeUndefined();

    expect(window.desktop.applicationSettings.update).toHaveBeenCalledWith({
      onboarding: { completedGuides: ["chat"] },
    });
    expect(store.guideActive).toBe(false);
  });
});
