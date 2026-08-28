import { describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => {
  const instances: Array<{
    options: Record<string, unknown>;
    handlers: Map<string, () => void>;
    show: ReturnType<typeof vi.fn>;
  }> = [];
  class NotificationMock {
    static isSupported = vi.fn(() => true);
    readonly handlers = new Map<string, () => void>();
    readonly show = vi.fn();

    constructor(readonly options: Record<string, unknown>) {
      instances.push(this);
    }

    on(event: string, handler: () => void) {
      this.handlers.set(event, handler);
      return this;
    }
  }
  return { NotificationMock, instances };
});

vi.mock("electron", () => ({ Notification: electron.NotificationMock }));

import type { ApplicationSettings } from "../../src/shared/dto";
import { NotificationService } from "../../src/host/infrastructure/electron/notification.service";

describe("NotificationService", () => {
  it("respects the global policy and the selected event", () => {
    const settings = createSettings();
    const service = new NotificationService(
      { get: () => settings } as never,
      "missing-icon.png",
      vi.fn(),
    );

    expect(
      service.show({
        kind: "chatGenerationCompleted",
        title: "Готово",
        body: "Ответ готов",
      }),
    ).toBe(false);

    settings.notifications.enabled = true;
    settings.notifications.chatGenerationCompleted = false;
    expect(
      service.show({
        kind: "chatGenerationCompleted",
        title: "Готово",
        body: "Ответ готов",
      }),
    ).toBe(false);
    expect(electron.instances).toHaveLength(0);
  });

  it("shows an OS notification and focuses the app after a click", () => {
    electron.instances.length = 0;
    const settings = createSettings();
    settings.notifications.enabled = true;
    const onClick = vi.fn();
    const service = new NotificationService(
      { get: () => settings } as never,
      "missing-icon.png",
      onClick,
    );

    expect(
      service.show({
        kind: "scenarioStarted",
        title: "Сценарий запущен",
        body: "Началось выполнение.",
      }),
    ).toBe(true);
    expect(electron.instances).toHaveLength(1);
    expect(electron.instances[0]?.options).toEqual({
      title: "Сценарий запущен",
      body: "Началось выполнение.",
    });
    expect(electron.instances[0]?.show).toHaveBeenCalledOnce();

    electron.instances[0]?.handlers.get("click")?.();
    expect(onClick).toHaveBeenCalledOnce();
  });
});

function createSettings(): ApplicationSettings {
  return {
    runInBackground: true,
    launchAtLogin: false,
    notifications: {
      enabled: false,
      chatGenerationCompleted: true,
      agentQuestionAsked: true,
      scenarioStarted: true,
      scenarioCompleted: true,
      vectorizationCompleted: true,
    },
    onboarding: {
      version: 2,
      tourCompleted: false,
      completedGuides: [],
      firstLaunchAt: null,
    },
  };
}
