import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingStore, type OnboardingReadiness } from "../../src/renderer/stores/OnboardingStore";

const onboarding = {
  version: 1,
  wizardCompleted: false,
  tourCompleted: false,
  checklistDismissed: false,
  completedSteps: [],
  firstLaunchAt: "2026-08-24T00:00:00.000Z",
};

beforeEach(() => {
  const update = vi.fn(async ({ onboarding: patch }) => ({
    runInBackground: true,
    onboarding: { ...onboarding, ...patch },
  }));
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { desktop: { applicationSettings: { update } } },
  });
});

describe("OnboardingStore", () => {
  it("derives readiness and checklist progress from existing stores", () => {
    const store = new OnboardingStore(readiness({
      provider: true,
      profile: true,
      directory: true,
      chat: true,
      agent: true,
      scenario: false,
    }));

    expect(store.hasProvider).toBe(true);
    expect(store.hasProfile).toBe(true);
    expect(store.checklistProgress).toBe(5 / 6);
  });

  it("persists wizard completion exactly once", async () => {
    const store = new OnboardingStore(readiness({}));
    await store.completeWizard();

    expect(window.desktop.applicationSettings.update).toHaveBeenCalledTimes(1);
    expect(window.desktop.applicationSettings.update).toHaveBeenCalledWith({
      onboarding: { wizardCompleted: true },
    });
  });
});

function readiness(values: Record<string, boolean>): OnboardingReadiness {
  return {
    textProviderStore: { enabledModels: values.provider ? [{}] : [] },
    userProfileStore: { profile: values.profile ? { displayName: "Ирина" } : null },
    directoryPolicyStore: { policy: { grants: values.directory ? [{}] : [] } },
    terminalPolicyStore: { policy: { enabled: false, allowedCommands: [] } },
    automationStore: {
      agents: values.agent ? [{}] : [],
      skills: values.skill ? [{}] : [],
      scenarios: values.scenario ? [{}] : [],
    },
    secretStorageStore: { secrets: values.secret ? [{}] : [] },
    chatStore: {
      conversations: values.chat ? [{}] : [],
      messages: values.chat ? [{}] : [],
    },
    vectorStoreStore: { stores: values.vector ? [{}] : [] },
  };
}
